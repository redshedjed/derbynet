#!/usr/bin/env node
'use strict';

// The DerbyNet timer interface without a browser: the same code as the timer
// page (derbynet-timer/src/js), run in Node for a Pi with no screen.  It finds
// the timer on a USB serial port, logs in to the server, and passes heats and
// results between them, as the timer page does.
//
//   node derbynet-timer.js http://localhost/derbynet [options]
//
//   --port PATH      Use this serial port, e.g. /dev/ttyUSB0, instead of trying
//                    every USB serial port.  (Or TIMER_PORT.)
//   --role NAME      Log in as this role (default Timer).  (Or TIMER_ROLE.)
//   --password PW    That role's password (default none).  (Or TIMER_PASSWORD.)
//
// The server URL can also come from DERBYNET_SERVER.  Timer settings (lane
// count, FastTrack gate release, ...) are set from the server, as for the timer
// page.
//
// Exits, for its service to restart it, if the server stops answering for a
// minute (a standby may have taken over), or if another timer interface is
// already connected to the server.

const os = require('os');
const fs = require('fs');
const path = require('path');
const env = require('./browser-env.js');

// The timer's scripts, in the order templates/timer.html loads them
const SCRIPTS = [
  'port_wrapper.js', 'ports.js', 'profiles.js', 'detector.js', 'events.js',
  'result.js', 'state_machine.js', 'timer_proxy.js', 'flags.js', 'role_finder.js',
  'host_poller.js', 'logger.js', 'prober.js', 'remote_start.js',
  'runtime_conditions.js', 'gui.js', 'main.js',
];

const SUPERVISE_MS = 5000;
const SERVER_LOST_MS = 60000;
const COMPETING_EXIT_MS = 30000;

function readVersion(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8'));
  } catch (e) {
    return { branch: 'dev', revision: 0, date: '' };
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// options: server, port, role, password, jsDir, and for tests, serial (a
// navigator.serial stand-in) and exit (called instead of process.exit).
async function start(options) {
  const exit = options.exit || (code => process.exit(code));
  const jsDir = options.jsDir || path.join(__dirname, '..', 'derbynet-timer', 'src', 'js');
  const version = readVersion(__dirname);
  const userAgent = 'DerbyNet-headless-timer/' + version.branch + '-' + version.revision
        + ' (' + os.hostname() + ')';

  // As in a browser, a failure in one event handler doesn't stop the rest.
  process.on('unhandledRejection', err => console.error('Unhandled:', err));
  process.on('uncaughtException', err => console.error('Uncaught:', err));

  let competing = false;
  const serial = options.serial
        || require('./web-serial.js').makeSerial(options.port);
  const { ajax, ready } = env.install({
    jsDir, serverUrl: options.server, userAgent, version, serial,
    onModal(selector) {
      if (selector === '#competing-modal' && !competing) {
        competing = true;
        console.error('Another timer interface is connected to the server;'
                      + ' trying again in ' + COMPETING_EXIT_MS / 1000 + 's.');
        setTimeout(() => exit(4), COMPETING_EXIT_MS);
      }
    },
  });

  for (const file of SCRIPTS) {
    env.runScript(path.join(jsDir, file));
  }
  const Gui = env.global('Gui');
  Gui.trouble_message = err => console.error('Timer trouble:', String(err));
  // Draws the page's port list, waiting for each entry to appear: no page, so
  // nothing to draw.
  globalThis.update_ports_list = async () => {};

  console.log('DerbyNet timer ' + version.branch + '-' + version.revision
              + ', server ' + options.server
              + (options.port ? ', port ' + options.port : ''));

  // The timer page relies on the browser's login; log in as the role here.
  for (let reported = ''; ;) {
    let problem;
    try {
      const data = await ajax.fetch('action.php', {
        type: 'POST',
        data: { action: 'role.login', name: options.role, password: options.password },
      });
      if (data?.outcome?.summary === 'success') {
        break;
      }
      problem = 'login as ' + options.role + ' refused: '
        + (data?.outcome?.description || JSON.stringify(data));
    } catch (e) {
      problem = 'server not answering: ' + (e.cause?.code || e.cause?.message || e.message);
    }
    if (problem !== reported) {
      console.error(problem + '; retrying');
      reported = problem;
    }
    await sleep(5000);
  }
  console.log('Logged in as ' + options.role);

  for (const fn of ready) {
    try {
      fn();
    } catch (e) {
      console.error('Start-up handler failed:', e);
    }
  }

  // The timer page stops scanning after a few passes, until someone presses
  // Scan; with no one to press it, scan again whenever no timer is connected.
  // Ports are listed afresh each time, so a timer plugged in later is found.
  const supervisor = setInterval(async () => {
    if (competing) {
      return;
    }
    if (Date.now() - ajax.lastSuccess > SERVER_LOST_MS) {
      console.error('No answer from the server for ' + SERVER_LOST_MS / 1000 + 's; restarting.');
      clearInterval(supervisor);
      exit(3);
      return;
    }
    const prober = env.global('g_prober');
    if (!env.global('g_timer_proxy') && !prober.probe_cycle_underway) {
      const ports = await navigator.serial.getPorts();
      if (ports.length > 0) {
        globalThis.g_ports = ports;
        prober.probe_until_found();
      }
    }
  }, SUPERVISE_MS);

  return { ajax, stop() { clearInterval(supervisor); } };
}

function parseArgs(argv) {
  const options = {
    server: process.env.DERBYNET_SERVER,
    port: process.env.TIMER_PORT || '',
    role: process.env.TIMER_ROLE || 'Timer',
    password: process.env.TIMER_PASSWORD || '',
  };
  for (let i = 0; i < argv.length; ++i) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) usage('missing value for ' + a);
      return argv[++i];
    };
    if (a === '--port') options.port = value();
    else if (a === '--role') options.role = value();
    else if (a === '--password') options.password = value();
    else if (a === '-h' || a === '--help') usage();
    else if (a.startsWith('-')) usage('unknown option ' + a);
    else options.server = a;
  }
  if (!options.server) usage('no server URL');
  if (!/^https?:\/\//.test(options.server)) options.server = 'http://' + options.server;
  options.server = options.server.replace(/\/+$/, '');
  return options;
}

function usage(problem) {
  if (problem) console.error('derbynet-timer: ' + problem);
  console.error('Usage: derbynet-timer.js SERVER_URL [--port PATH] [--role NAME] [--password PW]');
  process.exit(problem ? 2 : 0);
}

if (require.main === module) {
  start(parseArgs(process.argv.slice(2)));
}

module.exports = { start };
