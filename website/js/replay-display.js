'use strict';

// The replay display (replay.php).  It shows a kiosk page full-screen,
// records the track all the time, and when a heat finishes slides the replay
// in over the page, then back out.
//
// What it records, chosen on its setup screen:
//   - a camera on this computer, or
//   - "Track cameras": every track camera switched on in Settings > Cameras
//     (phones or laptops running camera.php?name=...), played one after
//     another in that order, each with any tuning of its own.
//
// Assumes message-poller.js, viewer-signaling.js, camera-source.js,
// replay-recorder.js and screenfull; g_websocket_url is set by the page.
//
// Commands from the server (see inc/replay.inc):
//   START <heat>                          a heat is staged
//   RACE_STARTS <length> <showings> <%>   the gate opened: replay after
//                                         <length> ms unless REPLAY comes first
//   REPLAY <length> <showings> <%>        the heat finished: replay now
//   CANCEL                                forget the pending replay
//   TEST <length> <showings> <%>          replay now, to try the settings
//
// States:
//   idle     recording; nothing expected
//   armed    START seen: a heat is staged
//   running  RACE_STARTS seen: replay on REPLAY, or when the timer runs out
//   playing  showing a replay; recording is paused
//
// A replay set off by the RACE_STARTS timer means a later REPLAY for the same
// heat is ignored, until the next START.

var g_replay = {
  state: 'idle',
  // From the latest command: the Race Dashboard's replay settings
  options: {length: 4000, showings: 2, rate: 50},
  timer: 0,               // Pending replay after RACE_STARTS
  replayed_by_timer: false,
  seq: -1,                // Last command seen; -1 until the first poll

  mode: 'local',          // 'local' or 'track'
  local: null,            // ReplayRecorder for this computer's camera
  cameras: [],            // Track cameras from the server, in replay order:
                          //   {name, skipback, showings, rate}
  track: {},              // camera name => {remote, recorder, tile}
};

function set_replay_state(state, why) {
  console.log('Replay state: ' + g_replay.state + ' -> ' + state + (why ? ' (' + why + ')' : ''));
  g_replay.state = state;
}

function clear_replay_timer() {
  clearTimeout(g_replay.timer);
  g_replay.timer = 0;
}

// The recordings a replay plays, in order, each with its tuning.
function replay_lineup() {
  let o = g_replay.options;
  if (g_replay.mode == 'local') {
    return g_replay.local ? [{name: '', recorder: g_replay.local,
                              showings: o.showings, rate: o.rate}] : [];
  }
  let lineup = [];
  g_replay.cameras.forEach(function(cam) {
    let entry = g_replay.track[cam.name];
    if (entry && entry.recorder) {
      lineup.push({name: cam.name, recorder: entry.recorder,
                   showings: cam.showings || o.showings, rate: cam.rate || o.rate});
    }
  });
  return lineup;
}

function all_recorders() {
  let recorders = g_replay.local ? [g_replay.local] : [];
  for (let name in g_replay.track) {
    if (g_replay.track[name].recorder) {
      recorders.push(g_replay.track[name].recorder);
    }
  }
  return recorders;
}

// How much each recorder keeps: its camera's own length, or the setting's.
function length_for_camera(name) {
  let cam = g_replay.cameras.find(function(c) { return c.name == name; });
  return (cam && cam.skipback) || g_replay.options.length;
}

function apply_lengths() {
  if (g_replay.local) {
    g_replay.local.set_length(g_replay.options.length);
  }
  for (let name in g_replay.track) {
    if (g_replay.track[name].recorder) {
      g_replay.track[name].recorder.set_length(length_for_camera(name));
    }
  }
}

// words: the command split on spaces, e.g. ['REPLAY', '4000', '2', '50']
function parse_replay_options(words) {
  let length = parseInt(words[1]), showings = parseInt(words[2]), rate = parseInt(words[3]);
  if (length > 0) {
    g_replay.options.length = length;
  }
  if (showings > 0) {
    g_replay.options.showings = showings;
  }
  if (rate > 0) {
    g_replay.options.rate = rate;
  }
  apply_lengths();
}

function handle_replay_message(cmdline) {
  console.log('* Replay message:', cmdline);
  let words = cmdline.trim().split(/\s+/);
  switch (words[0]) {
  case 'HELLO':
    break;
  case 'START':
    // (The heat's name follows, but isn't needed now that replays aren't saved.)
    g_replay.replayed_by_timer = false;
    if (g_replay.state != 'playing') {
      set_replay_state('armed', 'START');
    }
    break;
  case 'RACE_STARTS':
    parse_replay_options(words);
    if (g_replay.state != 'playing') {
      set_replay_state('running', 'RACE_STARTS');
      clear_replay_timer();
      g_replay.timer = setTimeout(function() {
        g_replay.timer = 0;
        g_replay.replayed_by_timer = true;
        trigger_replay('timer after RACE_STARTS');
      }, g_replay.options.length);
    }
    break;
  case 'REPLAY':
    parse_replay_options(words);
    if (g_replay.replayed_by_timer) {
      console.log('Already replayed this heat (by the timer); ignoring REPLAY');
    } else {
      trigger_replay('REPLAY');
    }
    break;
  case 'CANCEL':
    clear_replay_timer();
    if (g_replay.state != 'playing') {
      set_replay_state('idle', 'CANCEL');
    }
    break;
  case 'TEST':
    parse_replay_options(words);
    trigger_replay('TEST');
    break;
  default:
    console.log('Unrecognized replay message: ' + cmdline);
  }
}

// Freezes the recordings now, and shows them after the kiosk's delay (if any).
function trigger_replay(why) {
  clear_replay_timer();
  if (g_replay.state == 'playing') {
    console.log('Already showing a replay; ignoring ' + why);
    return;
  }
  if (replay_lineup().length == 0) {
    console.log('No camera stream; nothing to replay (' + why + ')');
    set_replay_state('idle', 'no camera');
    return;
  }
  all_recorders().forEach(function(r) { r.stop(); });
  set_replay_state('playing', why);
  // replay.php's setup screen can hold the replay back a little; a kiosk
  // doesn't.
  let delay = $("#delay").length > 0 ? $("#delay")[0].valueAsNumber * 1000 : 0;
  setTimeout(show_replay, delay > 0 ? delay : 0);
}

// For the click shield's right-click: replay what's just been recorded.
function on_replay() {
  trigger_replay('by hand');
}

function show_replay() {
  let lineup = replay_lineup();
  let canvas = document.getElementById("playback");
  canvas.width = $(window).width();
  canvas.height = $(window).height();
  // Name each camera on screen only when there's more than one
  let labeled = lineup.length > 1;

  announce_to_interior('replay-started');
  $("#playback-background").show('slide', function() {
    // One camera after another
    lineup.reduce(function(prev, item) {
      return prev.then(function() {
        return item.recorder.play(canvas, {showings: item.showings, rate: item.rate,
                                           label: labeled ? item.name : ''});
      });
    }, Promise.resolve())
      .then(function() {
        $("#playback-background").hide('slide');
        announce_to_interior('replay-ended');
        set_replay_state('idle', 'replay done');
        // (The cameras may have changed while the replay played.)
        all_recorders().forEach(function(r) { r.start(); });
      });
  });
}

// Posts a message to the page running in the interior iframe.
function announce_to_interior(msg) {
  document.querySelector("#interior").contentWindow.postMessage(msg, '*');
}

// ---------------- Checking in, and listening for commands ----------------

// What this display calls itself on Settings > Cameras: as a kiosk, its
// location's name; otherwise, the kiosk address it was opened with, if any.
var g_display_name = window.g_replay_kiosk ? g_replay_kiosk.name
    : (new URLSearchParams(window.location.search).get('address') || 'Replay display');
// As a kiosk, kiosk-<address>: what the Kiosk Dashboard knows it by
var g_client_id = window.g_replay_kiosk ? 'kiosk-' + g_replay_kiosk.address
                                        : tab_id_string('display-');

// A command, from polling or the websocket: each is handled once, in order.
function take_command(seq, cmd) {
  if (seq !== undefined) {
    if (seq <= g_replay.seq) {
      return;
    }
    g_replay.seq = seq;
  }
  handle_replay_message(cmd);
}

function display_status() {
  let parts = [g_replay.state];
  if (g_replay.mode == 'local') {
    parts.push(g_replay.local ? "this computer's camera" : 'no camera');
  } else {
    g_replay.cameras.forEach(function(cam) {
      let entry = g_replay.track[cam.name];
      // (The display's own webcam has no remote connection to check.)
      let ok = entry && entry.recorder && (!entry.remote || entry.remote.connected());
      parts.push(cam.name + (ok ? ' ok' : ' waiting'));
    });
    if (g_replay.cameras.length == 0) {
      parts.push('no track cameras');
    }
  }
  return parts.join(', ');
}

// Avoid starting another poll request while one is still in flight.
var g_poll_in_flight = false;
var g_last_cameras_json = null;

function poll_once_for_replay() {
  if (g_poll_in_flight) {
    return;
  }
  g_poll_in_flight = true;
  $.ajax("action.php",
         {type: 'POST',
          data: {action: 'replay.poll',
                 client: g_client_id,
                 kind: 'display',
                 name: g_display_name,
                 status: display_status(),
                 since: g_replay.seq},
          success: function(data) {
            if (!data.outcome || data.outcome.summary != 'success') {
              return;
            }
            data.commands.forEach(function(c) { take_command(c.seq, c.cmd); });
            if (data.seq > g_replay.seq) {
              // First poll: start from the latest command, not before.
              g_replay.seq = data.seq;
            }
            let cameras_json = JSON.stringify(data.cameras);
            if (cameras_json != g_last_cameras_json) {
              g_last_cameras_json = cameras_json;
              g_replay.cameras = data.cameras;
              apply_lengths();
              sync_track_cameras();
            }
          },
          complete: function() {
            g_poll_in_flight = false;
          },
         });
}

// If using websockets to listen for replay messages, this holds the
// MessagePoller.
var g_trigger_websocket;

function listen_for_replay_messages() {
  if (g_websocket_url != "") {
    g_trigger_websocket = new MessagePoller(make_id_string('replay-'),
                                            function(msg) { take_command(msg.seq, msg.cmd); },
                                            ['replay-commands']);
    // Commands come over the websocket; polling just checks in, catches
    // anything missed, and picks up changes to the track cameras.
    setInterval(poll_once_for_replay, 2000);
  } else {
    setInterval(poll_once_for_replay, 250);
  }
  poll_once_for_replay();
}

// ---------------- This computer's camera ----------------

function use_local_stream(stream) {
  leave_track_mode();
  if (g_replay.local) {
    g_replay.local.close();
  }
  g_replay.local = new ReplayRecorder(stream, {length_ms: g_replay.options.length});
  // If a replay is showing, recording starts when it's over.
  if (g_replay.state != 'playing') {
    g_replay.local.start();
  }
}

// ---------------- Track cameras ----------------

function enter_track_mode() {
  g_replay.mode = 'track';
  if (g_replay.local) {
    g_replay.local.close();
    g_replay.local = null;
  }
  $("#preview").addClass('hidden');
  $("#track-previews").removeClass('hidden');
  sync_track_cameras();
}

function leave_track_mode() {
  g_replay.mode = 'local';
  for (let name in g_replay.track) {
    disconnect_track_camera(name);
  }
  $("#preview").removeClass('hidden');
  $("#track-previews").addClass('hidden');
}

function disconnect_track_camera(name) {
  let entry = g_replay.track[name];
  if (entry.remote) {
    entry.remote.close();
  }
  if (entry.recorder) {
    entry.recorder.close();
  }
  entry.tile.remove();
  delete g_replay.track[name];
}

// Connects to the track cameras that are switched on, and lets go of any
// that aren't any more.
function sync_track_cameras() {
  if (g_replay.mode != 'track') {
    return;
  }
  let wanted = g_replay.cameras.map(function(cam) { return cam.name; });
  for (let name in g_replay.track) {
    if (wanted.indexOf(name) < 0) {
      disconnect_track_camera(name);
    }
  }
  wanted.forEach(function(name) {
    if (!g_replay.track[name]) {
      connect_track_camera(name);
    }
  });
  // Show them in replay order
  wanted.forEach(function(name) {
    $("#track-previews").append(g_replay.track[name].tile);
  });
  $("#no-track-cameras").toggleClass('hidden', wanted.length > 0).appendTo("#track-previews");
}

function connect_track_camera(name) {
  let tile = $("<div class='track-tile'>"
               + "<video autoplay muted playsinline disablepictureinpicture></video>"
               + "<div class='track-tile-label'></div>"
               + "</div>");
  tile.find('.track-tile-label').text(name + ': waiting for the camera');
  let entry = {remote: null, recorder: null, tile: tile};
  g_replay.track[name] = entry;
  if (g_own_camera && g_own_camera.name == name) {
    // This display's own webcam: its picture is right here
    if (g_own_camera.stream()) {
      use_camera_stream(name, g_own_camera.stream());
    }
    return;
  }
  entry.remote = new RemoteCamera(
    make_id_string('viewer-'),
    {width: $(window).width(), height: $(window).height()},
    function(stream) { use_camera_stream(name, stream); },
    name);
}

// Records a track camera's picture, from now on, for replays.
function use_camera_stream(name, stream) {
  let entry = g_replay.track[name];
  if (!entry) {
    return;
  }
  let tile = entry.tile;
  if (entry.recorder) {
    entry.recorder.close();
  }
  entry.recorder = new ReplayRecorder(stream, {
    length_ms: length_for_camera(name),
    on_resize: function(w, h) { tile.find('.track-tile-label').text(name + ': ' + w + 'x' + h); }});
  if (g_replay.state != 'playing') {
    entry.recorder.start();
  }
  tile.find('.track-tile-label').text(name + ': connected');
  tile.find('video')[0].srcObject = stream;
}

// ---------------- Setup ----------------

// Shows the capture rate while recording, if it's poor.
function report_capture_rate() {
  let worst = null;
  all_recorders().forEach(function(r) {
    if (r.recording) {
      let fps = r.capture_fps();
      if (worst === null || fps < worst) {
        worst = fps;
      }
    }
  });
  let poor = worst !== null && worst < 20;
  $("#fps").toggleClass('hidden', !poor).text(poor ? 'rec ' + worst + ' fps' : '')
    .css('background-color', worst < 10 ? 'red' : 'yellow');
}

var g_camera;
// As a kiosk whose location has a camera of its own: that TrackCameraStation
var g_own_camera = null;

$(function() {
  if (window.g_replay_kiosk) {
    // A kiosk (inc/replay-kiosk.inc): no setup screen; the kiosk's page
    // beneath.  (No frame-rate warning: that's for replay.php's setup, not a
    // TV.)
    $("#interior").attr('src', g_replay_kiosk.inner_url);
    if (g_replay_kiosk.camera) {
      // This display's own webcam is a track camera
      g_own_camera = new TrackCameraStation({
        name: g_replay_kiosk.camera,
        client_id: 'kiosk-' + g_replay_kiosk.address + '-camera',
        video: document.getElementById('own-camera'),
        on_stream: function(stream) { use_camera_stream(g_replay_kiosk.camera, stream); },
      });
      g_own_camera.start();
    }
    if (g_replay_kiosk.replays) {
      enter_track_mode();
      listen_for_replay_messages();
    }
    console.log('Replay kiosk (re)loaded');
    return;
  }

  $(window).on('resize', function(event) { on_setup(); });

  // "Remote Camera" became "Track cameras"
  try {
    if (window.localStorage.getItem('derbynet-camera-replay') == 'remote') {
      window.localStorage.setItem('derbynet-camera-replay', 'track');
    }
  } catch (e) {
  }

  g_camera = new CameraSource({
    video: document.getElementById("preview"),
    picker: $("#device-picker"),
    remember_as: 'replay',
    constraints: () => ({width: {ideal: $(window).width()},
                         height: {ideal: $(window).height()}}),
    extra_choices: [{value: 'track', label: 'Track cameras (from Settings)'}],
    on_extra_choice: function() {
      $("#no-camera-warning").addClass('hidden');
      enter_track_mode();
    },
    on_stream: function(stream) {
      $("#no-camera-warning").addClass('hidden');
      use_local_stream(stream);
    },
    on_trouble: function(message) {
      $("#no-camera-warning").empty().append(message).removeClass('hidden');
    },
    // Back to the setup screen, so it's clear which camera is in use now
    on_device_lost: function() { on_setup(); },
  });
  g_camera.start();

  listen_for_replay_messages();
  setInterval(report_capture_rate, 1000);
  console.log('Replay page (re)loaded');
});

function on_proceed() {
  $("#interior").attr('src', $("#inner_url").val());

  if (document.getElementById('go-fullscreen').checked) {
    if (screenfull.enabled) {
      // Temporarily remove resize handler while switching to fullscreen, to
      // avoid having to click "Proceed" again.
      $(window).off('resize');
      screenfull.request();
      setTimeout(function() {
          $(window).on('resize', function(event) { on_setup(); });
        }, 2000);
    }
  }

  $("#replay-setup").hide('slide', {direction: 'down'});
  $("#playback-background").hide('slide').removeClass('hidden');
  $("#interior").removeClass('hidden');
  $("#click-shield").removeClass('hidden');
}

function on_setup() {
  $("#click-shield").addClass('hidden');
  $("#replay-setup").show('slide', {direction: 'down'});
}
