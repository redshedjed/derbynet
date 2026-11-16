'use strict';

// navigator.serial (the browser's Web Serial API), on top of the serialport
// package, so the timer code in derbynet-timer/src/js runs unchanged in Node.
// Only the parts that code uses: getPorts(), requestPort(), and ports with
// getInfo(), open(), close(), setSignals(), and readable/writable streams.
//
// Unlike a browser, there's no "pick a port" dialog: every USB serial port is
// offered, or just the one named by TIMER_PORT.

const { SerialPort } = require('serialport');

class NodeSerialPort {
  readable = null;
  writable = null;

  constructor(path) {
    this.path = path;
    this.info = {};
    this.sp = null;
  }

  getInfo() {
    // serialport reports USB ids as hex strings; Web Serial as numbers
    const info = {};
    if (this.info.vendorId && this.info.productId) {
      info.usbVendorId = parseInt(this.info.vendorId, 16);
      info.usbProductId = parseInt(this.info.productId, 16);
    }
    return info;
  }

  async open({ baudRate, dataBits = 8, stopBits = 1, parity = 'none' }) {
    if (this.sp) {
      throw new DOMException('The port is already open.', 'InvalidStateError');
    }
    const sp = new SerialPort({ path: this.path, baudRate, dataBits, stopBits,
                                parity, autoOpen: false });
    await new Promise((resolve, reject) => {
      sp.open(err => err ? reject(new DOMException(String(err.message || err),
                                                   'NetworkError'))
                         : resolve());
    });
    this.sp = sp;

    let controller;
    this.readable = new ReadableStream({
      start(c) { controller = c; },
    });
    sp.on('data', data => {
      try { controller.enqueue(new Uint8Array(data)); } catch (e) { /* closed */ }
    });
    // Unplugging the adapter closes the port with an error: the reader sees
    // it, as in a browser, and the timer code reports a lost connection.
    sp.on('close', err => {
      if (this.sp === sp) {
        this.sp = null;
      }
      try {
        if (err) {
          controller.error(new DOMException('The device has been lost.', 'NetworkError'));
        } else {
          controller.close();
        }
      } catch (e) { /* already closed */ }
    });
    sp.on('error', err => {
      try { controller.error(err); } catch (e) { /* already closed */ }
    });

    this.writable = new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => {
          sp.write(Buffer.from(chunk), err => {
            if (err) {
              reject(err);
            } else {
              sp.drain(err2 => err2 ? reject(err2) : resolve());
            }
          });
        });
      },
    });
  }

  async setSignals({ dataTerminalReady, requestToSend, break: brk } = {}) {
    if (!this.sp) {
      throw new DOMException('The port is closed.', 'InvalidStateError');
    }
    const flags = {};
    if (dataTerminalReady !== undefined) flags.dtr = dataTerminalReady;
    if (requestToSend !== undefined) flags.rts = requestToSend;
    if (brk !== undefined) flags.brk = brk;
    await new Promise((resolve, reject) => {
      this.sp.set(flags, err => err ? reject(err) : resolve());
    });
  }

  async close() {
    const sp = this.sp;
    this.sp = null;
    this.readable = null;
    this.writable = null;
    if (sp && sp.isOpen) {
      await new Promise(resolve => sp.close(() => resolve()));
    }
  }
}

// port: a device path to use instead of scanning, e.g. /dev/ttyUSB0
function makeSerial(port) {
  const ports = new Map();  // path -> NodeSerialPort, so each port is one object
  function portFor(path) {
    if (!ports.has(path)) {
      ports.set(path, new NodeSerialPort(path));
    }
    return ports.get(path);
  }

  return {
    async getPorts() {
      let list = [];
      try {
        list = await SerialPort.list();
      } catch (e) {
        console.error('Listing serial ports failed:', e.message || e);
      }
      if (port) {
        const p = portFor(port);
        p.info = list.find(info => info.path === port) || {};
        return [p];
      }
      // USB adapters only: the Pi's built-in serial ports never have a timer
      // on them, and probing them would slow every scan.
      return list
        .filter(info => info.vendorId || /tty(USB|ACM)/.test(info.path))
        .map(info => {
          const p = portFor(info.path);
          p.info = info;
          return p;
        });
    },

    async requestPort() {
      const found = await this.getPorts();
      if (found.length === 0) {
        throw new DOMException('No port selected by the user.', 'NotFoundError');
      }
      return found[0];
    },

    addEventListener() {},
  };
}

module.exports = { makeSerial };
