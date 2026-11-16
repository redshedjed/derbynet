// Runs races through the real in-browser timer interface and the real server,
// with an emulated FastTrack Q-series timer on the serial port.  The races
// are in timer-scenarios.js; see test-timer-hardware.sh.

const puppeteer = require('puppeteer');
const {install} = require('./fasttrack-q-emulator.js');
const {runScenarios} = require('./timer-scenarios.js');

var root = process.argv[2] || 'http://localhost/derbynet';
if (!root.startsWith('http://')) {
  root = 'http://' + root;
}
root = root.replace(/\/$/, '');

var page;
const pageErrors = [];
const consoleLines = [];

// Everything goes through the page: requests share its login session, and the
// timer and emulator live in it.
const viaPage = {
  serverPoll(roundid = 0, heat = 1) {
    return page.evaluate(async (roundid, heat) => {
      const response = await fetch('action.php?query=poll.coordinator&roundid=' + roundid
                                   + '&heat=' + heat);
      return response.json();
    }, roundid, heat);
  },
  serverAction(params) {
    return page.evaluate(async (params) => {
      const response = await fetch('action.php',
                                   {method: 'POST', body: new URLSearchParams(params)});
      return response.json();
    }, params);
  },
  timerState() {
    return page.evaluate(() => window.g_timer_proxy && g_timer_proxy.sm && g_timer_proxy.sm.state);
  },
  identified() {
    return page.evaluate(() =>
      window.g_timer_proxy && g_timer_proxy.profile.key == 'FastTrack-K');
  },
  commands() {
    return page.evaluate(() => fastTrack.commands);
  },
  emulator(method, ...args) {
    return page.evaluate((method, args) => fastTrack[method](...args), method, args);
  },
};

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
      page.evaluate(() => window.handle_login('Administrator', 'backstage')),
    ]);

    await page.evaluateOnNewDocument(install, {});
    await page.goto(root + '/timer.php');
    // By default the interface waits 10 seconds after a race before resetting
    // the timer.  There's no one to read the results here.
    await page.evaluate(() => { Flag.delay_reset_after_race.value = 1; });

    await runScenarios(viaPage);
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
