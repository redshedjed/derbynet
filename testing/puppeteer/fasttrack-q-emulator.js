// A software stand-in for a Micro Wizard FastTrack Q-series timer connected
// through a USB-to-serial adapter.
//
// install() runs inside the browser page and replaces navigator.serial, so the
// real in-browser timer interface (prober, parser, state machine and host
// poller) runs unmodified against it.  The test controls the "track" through
// window.fastTrack.
//
// HOW FAITHFUL THIS IS
//
// The sources are the FastTrack profile (FastTrack.java), the commands listed in
// MicroWizard.java, and a transcript from a real K3 timer
// (timer/testing/testdata/fasttrack-mark-set.playback).  No Q-series transcript
// exists in this repository.  These details are therefore inferred, and should
// be compared with a real timer's log on first connection:
//   - The RV banner.  The profile only tells us it contains "Micro Wizard" and a
//     line matching "Model: Q".
//   - The result line in N2 mode.  We send the K3 layout with 4 decimal places;
//     MicroWizard.java describes N2 as "5-digit time", and also as including the
//     start switch status, whose format isn't documented here.
//   - How the timer treats commands it doesn't recognize.  We ignore them.
//   - Replies to RE, N1 and N2, and how a real timer reports a car that never
//     finishes (we send 0.000, like the unused lanes in the K3 transcript).
//
// This doesn't exercise the operating system's serial driver, a USB adapter or
// the cable.

function install(options) {
  const LANES = 'ABCDEF';
  const PLACES = '!"#$%&';
  const BAUD = 9600;
  // 10 bits per byte on the wire: start bit, 8 data bits, stop bit
  const MS_PER_BYTE = 10 * 1000 / BAUD;
  // USB-to-serial adapters hand over bytes in irregular chunks, so a line can
  // arrive in several reads.  A fixed pattern keeps test runs repeatable.
  const CHUNK_SIZES = [1, 7, 3, 16, 2, 5, 11, 4];

  const settings = Object.assign({
    banner: 'Copyright (C) 2023 Micro Wizard\r\n'
      + 'Model: Q1 Version 1.00 Serial Number 12345\r\n',
    trackLanes: 4,
    // How long the timer waits for a car that never finishes
    dnfTimeoutSeconds: 5,
  }, options);

  class FastTrackEmulator {
    gateClosed = false;
    unplugged = false;
    maskedLanes = new Set();
    decimals = 3;
    armedTimes = null;
    raceTimer = null;
    commands = [];   // Every command received, in order
    sentLines = [];  // Everything the timer has transmitted
    closeRejections = [];  // Which stream was locked, for each refused port.close()
    port = null;

    // ---- What the test does to the "track" ----

    closeGate() { this.gateClosed = true; }

    // times maps lane letter to seconds, e.g., {A: 3.1234, B: 2.9}.  A lane
    // that's missing or null never finishes.
    armRace(times) { this.armedTimes = times; }

    openGate() {
      this.gateClosed = false;
      if (this.armedTimes) {
        const times = this.armedTimes;
        this.armedTimes = null;
        this._runRace(times);
      }
    }

    // Disconnect the cable between the timer and the adapter.  The adapter's
    // serial port stays present, but nothing answers on it.
    unplug() { this.unplugged = true; }
    plugIn() { this.unplugged = false; }

    clearCommands() { this.commands = []; }

    // ---- Timer internals ----

    _runRace(times) {
      const finishing = LANES.split('')
        .filter(lane => times[lane] && !this.maskedLanes.has(lane));
      const everyLaneFinishes = this._activeLaneCount() == finishing.length;
      const seconds = everyLaneFinishes
        ? Math.max(0, ...finishing.map(lane => times[lane]))
        : settings.dnfTimeoutSeconds;
      this.raceTimer = setTimeout(() => {
        this.raceTimer = null;
        if (!this.unplugged) {
          this._transmit(this._resultLine(times, finishing));
        }
      }, seconds * 1000);
    }

    // The timer watches every lane on the track that isn't masked.
    _activeLaneCount() {
      return LANES.slice(0, settings.trackLanes).split('')
        .filter(lane => !this.maskedLanes.has(lane)).length;
    }

    _resultLine(times, finishing) {
      const fields = LANES.split('').map(lane => {
        if (finishing.includes(lane)) {
          // Tied cars share a place
          const ahead = finishing.filter(other => times[other] < times[lane]).length;
          return lane + '=' + times[lane].toFixed(this.decimals) + PLACES[ahead];
        }
        return lane + '=' + (0).toFixed(this.decimals) + ' ';
      });
      return fields.join(' ').trimEnd() + '\r\n';
    }

    _respond(command) {
      if (command == 'RV') return 'RV\r\n' + settings.banner;
      if (command == 'RG') return 'RG' + (this.gateClosed ? '1' : '0') + '\r\n';
      // Every feature present, including laser reset
      if (command == 'RF') return 'RF\r\n1111 1111\r\n';
      if (command == 'MG') {
        this.maskedLanes.clear();
        return 'MG\r\n';
      }
      if (/^M[A-F]$/.test(command)) {
        this.maskedLanes.add(command[1]);
        return command + '\r\n*\r\n';
      }
      if (command == 'N1') this.decimals = 3;
      if (command == 'N2') this.decimals = 4;
      if (['RE', 'N1', 'N2', 'LR', 'LG', 'LN', 'LO'].includes(command)) {
        return command + '\r\n*\r\n';
      }
      return null;
    }

    _transmit(text) {
      this.sentLines.push(text);
      if (this.port) {
        this.port.deliver(text);
      }
    }

    receive(command) {
      this.commands.push(command);
      if (this.unplugged) {
        return;
      }
      const response = this._respond(command);
      if (response) {
        this._transmit(response);
      }
    }
  }

  const timer = new FastTrackEmulator();

  // Implements the parts of the Web Serial API's SerialPort that DerbyNet uses.
  class FakeSerialPort {
    readable = null;
    writable = null;
    isOpen = false;
    baudMatches = false;
    controller = null;
    pending = [];
    pumping = false;
    chunkIndex = 0;

    getInfo() {
      // An FTDI adapter, a common choice for these timers
      return {usbVendorId: 0x0403, usbProductId: 0x6001};
    }

    async open(params) {
      if (this.isOpen) {
        throw new DOMException('The port is already open.', 'InvalidStateError');
      }
      this.isOpen = true;
      // At the wrong speed, neither end can make sense of the other.
      this.baudMatches = params.baudRate == BAUD;
      const port = this;
      this.readable = new ReadableStream({
        start(controller) { port.controller = controller; },
        cancel() { port.controller = null; port.pending = []; },
      });
      const decoder = new TextDecoder();
      this.writable = new WritableStream({
        write(chunk) {
          if (port.baudMatches) {
            timer.port = port;
            timer.receive(decoder.decode(chunk));
          }
        },
      });
      timer.port = this.baudMatches ? this : null;
    }

    async close() {
      // As in the real API, a stream with an active reader or writer can't be
      // closed out from under it.
      if ((this.readable && this.readable.locked) ||
          (this.writable && this.writable.locked)) {
        timer.closeRejections.push((this.readable && this.readable.locked) ? 'readable' : 'writable');
        throw new TypeError('Cannot close a port with a locked stream.');
      }
      if (this.readable) {
        await this.readable.cancel();
      }
      if (this.writable) {
        await this.writable.abort();
      }
      this.readable = null;
      this.writable = null;
      this.controller = null;
      this.pending = [];
      this.isOpen = false;
      if (timer.port == this) {
        timer.port = null;
      }
    }

    deliver(text) {
      if (!this.isOpen) {
        return;
      }
      this.pending.push(...new TextEncoder().encode(text));
      if (!this.pumping) {
        this.pumping = true;
        setTimeout(() => this._pump(), 2);
      }
    }

    _pump() {
      if (this.pending.length == 0 || !this.controller) {
        this.pumping = false;
        return;
      }
      const size = CHUNK_SIZES[this.chunkIndex++ % CHUNK_SIZES.length];
      const bytes = this.pending.splice(0, size);
      try {
        this.controller.enqueue(new Uint8Array(bytes));
      } catch (e) {
        // The stream closed between chunks; the rest of the bytes are lost.
        this.pending = [];
        this.pumping = false;
        return;
      }
      setTimeout(() => this._pump(), Math.max(1, bytes.length * MS_PER_BYTE));
    }
  }

  const port = new FakeSerialPort();
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: {
      getPorts: async () => [port],
      requestPort: async () => port,
      addEventListener: () => {},
    },
  });

  window.fastTrack = timer;
  window.fastTrackPort = port;
}

module.exports = {install};
