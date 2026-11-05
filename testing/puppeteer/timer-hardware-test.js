// Runs races through the real in-browser timer interface and the real server,
// with an emulated FastTrack Q-series timer on the serial port.  Expects racing
// to be on, with a 4-lane schedule for roundid 1 of at least 5 heats and racers
// available for roundid 2; see test-timer-hardware.sh.

const puppeteer = require('puppeteer');
const {install} = require('./fasttrack-q-emulator.js');

var root = process.argv[2] || 'http://localhost/derbynet';
if (!root.startsWith('http://')) {
  root = 'http://' + root;
}
root = root.replace(/\/$/, '');

// Server's timer states, from website/inc/timer-state.inc
const TIMER_STAGING = 3;
const TIMER_RUNNING = 4;
const TIMER_UNHEALTHY = 5;

var page;
const pageErrors = [];
const consoleLines = [];

function fail(message) {
  throw new Error(message);
}

function check(condition, message) {
  if (!condition) {
    fail(message);
  }
  console.log('      ok: ' + message);
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(description, test, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await test();
    if (value) {
      return value;
    }
    if (Date.now() > deadline) {
      fail('Timed out waiting for ' + description);
    }
    await sleep(100);
  }
}

// Requests go through the page, so they share its login session.
async function serverPoll(roundid = 0, heat = 1) {
  return page.evaluate(async (roundid, heat) => {
    const response = await fetch('action.php?query=poll.coordinator&roundid=' + roundid
                                 + '&heat=' + heat);
    return response.json();
  }, roundid, heat);
}

async function serverAction(params) {
  const result = await page.evaluate(async (params) => {
    const response = await fetch('action.php',
                                 {method: 'POST', body: new URLSearchParams(params)});
    return response.json();
  }, params);
  if (result.outcome.summary != 'success') {
    fail('Action failed: ' + JSON.stringify(params) + ': ' + JSON.stringify(result.outcome));
  }
}

function timerState() {
  return page.evaluate(() => window.g_timer_proxy && g_timer_proxy.sm && g_timer_proxy.sm.state);
}

function waitForState(state, timeoutMs) {
  return waitFor('timer state ' + state,
                 async () => (await timerState()) == state, timeoutMs);
}

function commands() {
  return page.evaluate(() => fastTrack.commands);
}

function emulator(method, ...args) {
  return page.evaluate((method, args) => fastTrack[method](...args), method, args);
}

function checkTime(results, lane, expected) {
  const row = results.find(r => r.lane == lane);
  if (expected === undefined) {
    check(!row, 'Lane ' + lane + ' has no recorded result');
    return;
  }
  if (!row) {
    fail('Lane ' + lane + ' has no recorded result; expected ' + expected);
  }
  const actual = parseFloat(row.time);
  // The server displays 3 decimal places, and the timer may send 4.
  check(Math.abs(actual - expected) <= 0.001,
        'Lane ' + lane + ' recorded ' + row.time + ', expected ' + expected);
}

// Runs the current heat from staging through recorded results.
//   times: what the timer reports, by lane letter
//   expected: what the server should record, by lane number
//   maskedLanes: lanes the interface should tell the timer to ignore
//   beforeStart: called after the gate is closed, before the race starts
async function runHeat(name, {times, expected, maskedLanes = [], beforeStart}) {
  console.log('   ' + name);
  const poll = await serverPoll();
  const roundid = poll['current-heat'].roundid;
  const heat = poll['current-heat'].heat;
  console.log('      round ' + roundid + ', heat ' + heat);

  await waitForState('MARK');
  // Masks go out one at a time after MG, with a pause between them.  On a 4-lane
  // track, lane F is always masked, and it's the last one sent.
  await waitFor('lane masks to be sent to the timer',
                async () => (await commands()).includes('MF'));
  await waitFor('polling to reach the timer',
                async () => (await commands()).includes('LR'));
  const sent = await commands();
  for (const lane of 'ABCD') {
    const shouldMask = maskedLanes.includes(lane);
    if (sent.includes('M' + lane) != shouldMask) {
      fail('Lane ' + lane + (shouldMask ? ' was not masked' : ' was masked unexpectedly')
           + ': ' + sent.join(' '));
    }
  }
  check(true, 'Lane masks match the heat: ' + (maskedLanes.join(',') || 'none'));

  await emulator('closeGate');
  await waitForState('SET');
  await waitFor('the server to show staging', async () =>
    (await serverPoll())['timer-state'].state == TIMER_STAGING);

  if (beforeStart) {
    await beforeStart();
  }

  await emulator('armRace', times);
  await emulator('openGate');
  await waitForState('RUNNING');
  await waitFor('the server to show the race running', async () =>
    (await serverPoll())['timer-state'].state == TIMER_RUNNING);

  const results = await waitFor('results to be recorded', async () => {
    const rows = (await serverPoll(roundid, heat))['heat-results'];
    return rows.length > 0 ? rows : null;
  });
  for (const lane of [1, 2, 3, 4]) {
    checkTime(results, lane, expected[lane]);
  }

  await emulator('clearCommands');
}

async function connect() {
  console.log('   Connecting');
  await waitFor('the timer to be identified', () => page.evaluate(() =>
    window.g_timer_proxy && g_timer_proxy.profile.key == 'FastTrack-K'), 60000);
  // Setup commands are sent once, right after the timer's been identified, with
  // a pause between them.
  const setupAfterProbe = sent => sent.slice(sent.lastIndexOf('RV') + 1, sent.lastIndexOf('RV') + 5);
  const setup = await waitFor('setup commands', async () => {
    const found = setupAfterProbe(await commands());
    return found.length == 4 ? found : null;
  });
  check(setup.join(' ') == 'RE N1 N2 RF', 'Setup commands are in order: ' + setup.join(' '));
  await waitFor('the interface to report the timer to the server', async () => {
    const state = (await serverPoll())['timer-state'].state;
    return state != 1 && state != 6;  // Not "not connected", not "searching"
  });
  check(true, 'Server knows the timer is connected');
}

async function printDiagnostics() {
  const state = await page.evaluate(() => ({
    portOpen: fastTrackPort.isOpen,
    closeRejections: fastTrack.closeRejections,
    probing: g_prober.probe_cycle_underway,
    timerProxy: !!window.g_timer_proxy,
    recentCommands: fastTrack.commands.slice(-12),
  }));
  console.log('DIAGNOSTICS: ' + JSON.stringify(state));
  console.log('DIAGNOSTICS page errors: ' + JSON.stringify(pageErrors.slice(-4)));
  console.log('DIAGNOSTICS console: ' + JSON.stringify(consoleLines.slice(-6)));
}

async function main() {
  const browser = await puppeteer.launch();
  try {
    page = (await browser.pages())[0];
    page.on('pageerror', error => {
      pageErrors.push(String(error.message || error));
      console.log('PAGE ERROR: ' + pageErrors[pageErrors.length - 1]);
    });
    page.on('console', msg => consoleLines.push(msg.text()));

    await page.goto(root + '/login.php');
    await Promise.all([
      page.waitForNavigation(),
      page.evaluate(() => window.handle_login('RaceCoordinator', 'doyourbest')),
    ]);

    await page.evaluateOnNewDocument(install, {});
    await page.goto(root + '/timer.php');
    // By default the interface waits 10 seconds after a race before resetting
    // the timer.  There's no one to read the results here.
    await page.evaluate(() => { Flag.delay_reset_after_race.value = 1; });

    await connect();

    await runHeat('A normal heat', {
      times: {A: 3.1234, B: 2.9876, C: 3.4567, D: 3.2109},
      expected: {1: 3.1234, 2: 2.9876, 3: 3.4567, 4: 3.2109},
    });

    await runHeat('A car that never finishes', {
      times: {A: 3.1111, B: 2.9222, D: 3.2333},
      // The timer's 0.0000 becomes 9.9999, which the server shows as 10.000
      expected: {1: 3.1111, 2: 2.9222, 3: 9.9999, 4: 3.2333},
    });

    await runHeat('A tie', {
      times: {A: 3.0005, B: 3.0005, C: 3.5, D: 3.75},
      expected: {1: 3.0005, 2: 3.0005, 3: 3.5, 4: 3.75},
    });

    await runHeat('The gate bounces while cars are staged', {
      times: {A: 3.4, B: 3.3, C: 3.2, D: 3.1},
      expected: {1: 3.4, 2: 3.3, 3: 3.2, 4: 3.1},
      beforeStart: async () => {
        // Too brief to count as a start (see the min-gate-time flag)
        await emulator('openGate');
        await sleep(200);
        await emulator('closeGate');
        await sleep(1000);
        check((await timerState()) == 'SET', 'A brief gate opening did not start the race');
      },
    });

    console.log('   The timer cable comes unplugged');
    await emulator('unplug');
    await waitFor('the server to be told about the lost connection', async () =>
      (await serverPoll())['timer-state'].state == TIMER_UNHEALTHY);
    check(true, 'Server shows a timer problem');
    await emulator('clearCommands');
    await emulator('plugIn');
    await connect();

    await runHeat('A heat after reconnecting', {
      times: {A: 2.8, B: 2.9, C: 3.0, D: 3.1},
      expected: {1: 2.8, 2: 2.9, 3: 3.0, 4: 3.1},
    });

    // With lane 3 unused, the timer is told to ignore it.  It still reports the
    // lane as 0.000, which must not be recorded as a result.
    await serverAction({action: 'settings.write', 'unused-lane-mask': 4, 'n-lanes': 4});
    await serverAction({action: 'schedule.generate', roundid: 2});
    await serverAction({action: 'heat.select', roundid: 2, now_racing: 1});
    await runHeat('A heat with an unused lane', {
      times: {A: 3.01, B: 3.02, D: 3.04},
      expected: {1: 3.01, 2: 3.02, 4: 3.04},
      maskedLanes: ['C'],
    });

    console.log('   All timer hardware scenarios passed');
  } catch (error) {
    await printDiagnostics();
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.log('TIMER HARDWARE TEST FAILURE: ' + error.message);
  process.exit(1);
});
