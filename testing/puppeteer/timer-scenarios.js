// The races that timer-hardware-test.js (the timer page, in a browser) and
// headless-timer-test.js (the same code in Node, as on a Pi) both run, against
// the real server and an emulated FastTrack Q-series timer
// (fasttrack-q-emulator.js).  Expects racing to be on, with a 4-lane schedule
// for roundid 1 of at least 5 heats and racers available for roundid 2; see
// test-timer-hardware.sh.
//
// Each test supplies the same calls, made wherever its timer runs:
//   serverPoll(roundid, heat)  poll.coordinator, as JSON
//   serverAction(params)       an action, as JSON
//   timerState()               the timer interface's state machine state
//   identified()               true once the FastTrack has been identified
//   commands()                 every command the emulated timer has received
//   emulator(method, ...args)  call the emulated track (closeGate, armRace...)

// Server's timer states, from website/inc/timer-state.inc
const TIMER_STAGING = 3;
const TIMER_RUNNING = 4;
const TIMER_UNHEALTHY = 5;

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

async function runScenarios(t) {
  async function serverAction(params) {
    const result = await t.serverAction(params);
    if (result.outcome.summary != 'success') {
      fail('Action failed: ' + JSON.stringify(params) + ': ' + JSON.stringify(result.outcome));
    }
  }

  function waitForState(state, timeoutMs) {
    return waitFor('timer state ' + state,
                   async () => (await t.timerState()) == state, timeoutMs);
  }

  // Runs the current heat from staging through recorded results.
  //   times: what the timer reports, by lane letter
  //   expected: what the server should record, by lane number
  //   maskedLanes: lanes the interface should tell the timer to ignore
  //   beforeStart: called after the gate is closed, before the race starts
  async function runHeat(name, {times, expected, maskedLanes = [], beforeStart}) {
    console.log('   ' + name);
    const poll = await t.serverPoll();
    const roundid = poll['current-heat'].roundid;
    const heat = poll['current-heat'].heat;
    console.log('      round ' + roundid + ', heat ' + heat);

    await waitForState('MARK');
    // Masks go out one at a time after MG, with a pause between them.  On a 4-lane
    // track, lane F is always masked, and it's the last one sent.
    await waitFor('lane masks to be sent to the timer',
                  async () => (await t.commands()).includes('MF'));
    await waitFor('polling to reach the timer',
                  async () => (await t.commands()).includes('LR'));
    const sent = await t.commands();
    for (const lane of 'ABCD') {
      const shouldMask = maskedLanes.includes(lane);
      if (sent.includes('M' + lane) != shouldMask) {
        fail('Lane ' + lane + (shouldMask ? ' was not masked' : ' was masked unexpectedly')
             + ': ' + sent.join(' '));
      }
    }
    check(true, 'Lane masks match the heat: ' + (maskedLanes.join(',') || 'none'));

    await t.emulator('closeGate');
    await waitForState('SET');
    await waitFor('the server to show staging', async () =>
      (await t.serverPoll())['timer-state'].state == TIMER_STAGING);

    if (beforeStart) {
      await beforeStart();
    }

    await t.emulator('armRace', times);
    await t.emulator('openGate');
    await waitForState('RUNNING');
    await waitFor('the server to show the race running', async () =>
      (await t.serverPoll())['timer-state'].state == TIMER_RUNNING);

    const results = await waitFor('results to be recorded', async () => {
      const rows = (await t.serverPoll(roundid, heat))['heat-results'];
      return rows.length > 0 ? rows : null;
    });
    for (const lane of [1, 2, 3, 4]) {
      checkTime(results, lane, expected[lane]);
    }

    await t.emulator('clearCommands');
  }

  async function connect() {
    console.log('   Connecting');
    await waitFor('the timer to be identified', () => t.identified(), 60000);
    // Setup commands are sent once, right after the timer's been identified, with
    // a pause between them.
    const setupAfterProbe = sent => sent.slice(sent.lastIndexOf('RV') + 1, sent.lastIndexOf('RV') + 5);
    const setup = await waitFor('setup commands', async () => {
      const found = setupAfterProbe(await t.commands());
      return found.length == 4 ? found : null;
    });
    check(setup.join(' ') == 'RE N1 N2 RF', 'Setup commands are in order: ' + setup.join(' '));
    await waitFor('the interface to report the timer to the server', async () => {
      const state = (await t.serverPoll())['timer-state'].state;
      return state != 1 && state != 6;  // Not "not connected", not "searching"
    });
    check(true, 'Server knows the timer is connected');
  }

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
      await t.emulator('openGate');
      await sleep(200);
      await t.emulator('closeGate');
      await sleep(1000);
      check((await t.timerState()) == 'SET', 'A brief gate opening did not start the race');
    },
  });

  console.log('   The timer cable comes unplugged');
  await t.emulator('unplug');
  await waitFor('the server to be told about the lost connection', async () =>
    (await t.serverPoll())['timer-state'].state == TIMER_UNHEALTHY);
  check(true, 'Server shows a timer problem');
  await t.emulator('clearCommands');
  await t.emulator('plugIn');
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
}

module.exports = {runScenarios, sleep};
