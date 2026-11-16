// Runs the races in timer-scenarios.js through the headless timer
// (timer/headless), as a Raspberry Pi would, logged in as the Timer role,
// with the emulated FastTrack Q-series timer in place of the serial port.
// See test-timer-headless.sh.

const path = require('path');
const {install} = require('./fasttrack-q-emulator.js');
const {runScenarios} = require('./timer-scenarios.js');

const headless = path.join(__dirname, '..', '..', 'timer', 'headless');
const {start} = require(path.join(headless, 'derbynet-timer.js'));
const {Ajax, global: timerGlobal} = require(path.join(headless, 'browser-env.js'));

var root = process.argv[2] || 'http://localhost/derbynet';
if (!root.startsWith('http://')) {
  root = 'http://' + root;
}
root = root.replace(/\/$/, '');

// The test's own session, as Administrator, separate from the timer's
const admin = new Ajax(root, 'headless-timer-test');

const inProcess = {
  serverPoll(roundid = 0, heat = 1) {
    return admin.fetch('action.php?query=poll.coordinator&roundid=' + roundid + '&heat=' + heat);
  },
  serverAction(params) {
    return admin.fetch('action.php', {type: 'POST', data: params});
  },
  timerState() {
    const proxy = timerGlobal('g_timer_proxy');
    return proxy && proxy.sm && proxy.sm.state;
  },
  identified() {
    const proxy = timerGlobal('g_timer_proxy');
    return proxy && proxy.profile.key == 'FastTrack-K';
  },
  commands() {
    return fastTrack.commands;
  },
  emulator(method, ...args) {
    return fastTrack[method](...args);
  },
};

async function main() {
  const login = await admin.fetch('action.php', {
    type: 'POST',
    data: {action: 'role.login', name: 'Administrator', password: 'backstage'},
  });
  if (login.outcome.summary != 'success') {
    throw new Error('Administrator login failed: ' + JSON.stringify(login.outcome));
  }
  // The server tells the timer, with every reply, whether to keep a log
  const sendLogs = await admin.fetch('action.php', {
    type: 'POST',
    data: {action: 'settings.write', 'timer-send-logs': 1},
  });
  if (sendLogs.outcome.summary != 'success') {
    throw new Error('Turning on timer logs failed: ' + JSON.stringify(sendLogs.outcome));
  }

  // The emulator installs itself as navigator.serial, as in a browser.
  globalThis.window = globalThis;
  Object.defineProperty(globalThis, 'navigator',
                        {configurable: true, writable: true, value: {}});
  install({});

  let exited = null;
  const timer = await start({
    server: root, role: 'Timer', password: '',
    serial: navigator.serial,
    exit: code => { exited = code; },
  });
  // As for the timer page: no one is reading the results, so don't wait to reset.
  timerGlobal('Flag').delay_reset_after_race.value = 1;
  // The timer log, kept here rather than posted to the server, to check that
  // repeated polling is summarized rather than logged line by line
  const logLines = [];
  const logger = timerGlobal('g_logger');
  logger.flush = function() { logLines.push(...this.buffer); this.buffer = []; };
  // (Turned on by the server, from the setting above)

  // The last few timer events, for the diagnostics if something fails
  const events = [];
  timerGlobal('TimerEvent').register({onEvent(event, args) {
    if (event != 'GATE_OPEN' && event != 'GATE_CLOSED') {
      events.push(new Date().toISOString().slice(11, 23) + ' ' + event + ' ' + JSON.stringify(args || []));
      events.splice(0, events.length - 12);
    }
  }});

  try {
    await runScenarios(inProcess);

    console.log('   The timer log');
    logger.poll();
    const summaries = logLines.filter(line => /S \.\.\. \d+ more like th/.test(line));
    if (summaries.length == 0) {
      throw new Error('The timer log has no summaries of repeated polling');
    }
    console.log('      ok: ' + summaries.length + ' summaries of repeated polling, e.g. '
                + summaries[summaries.length - 1].replace(/^\+[0-9.]+/, ''));
    console.log('      ok: ' + logLines.length + ' log lines in all');
    if (exited !== null) {
      throw new Error('The headless timer tried to exit, with code ' + exited);
    }
    console.log('   All headless timer scenarios passed');
  } catch (error) {
    const proxy = timerGlobal('g_timer_proxy');
    const poll = await inProcess.serverPoll().catch(e => ({error: String(e)}));
    console.log('DIAGNOSTICS server: ' + JSON.stringify({
      now: new Date().toISOString(),
      timerState: poll['timer-state'],
      currentHeat: poll['current-heat'],
    }));
    console.log('DIAGNOSTICS events: ' + JSON.stringify(events));
    console.log('DIAGNOSTICS: ' + JSON.stringify({
      exited,
      portOpen: fastTrackPort.isOpen,
      closeRejections: fastTrack.closeRejections,
      probing: timerGlobal('g_prober').probe_cycle_underway,
      timerProxy: !!proxy,
      timerState: proxy && proxy.sm && proxy.sm.state,
      hostPoller: (({message_in_flight, identified, competing}) =>
                   ({message_in_flight, identified, competing}))(timerGlobal('g_host_poller') || {}),
      lastServerAnswer: new Date(timer.ajax.lastSuccess).toISOString(),
      lastRequestError: timer.ajax.lastError,
      recentCommands: fastTrack.commands.slice(-12),
    }));
    throw error;
  } finally {
    timer.stop();
  }
}

main().then(() => process.exit(0), error => {
  console.log('HEADLESS TIMER TEST FAILURE: ' + error.message);
  process.exit(1);
});
