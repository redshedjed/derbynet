'use strict';

// The replay kiosk (replay.php).  It shows a kiosk page full-screen, records
// the track camera all the time, and when a heat finishes slides the replay
// in over the page, then back out.
//
// Assumes message-poller.js, viewer-signaling.js, camera-source.js,
// replay-recorder.js and screenfull; g_websocket_url is set by the page.
//
// Commands from the server (see docs/Developers- Replay Messages):
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
  options: {length: 4000, showings: 2, rate: 50},
  recorder: null,         // ReplayRecorder for the camera in use
  timer: 0,               // Pending replay after RACE_STARTS
  replayed_by_timer: false,
};

function set_replay_state(state, why) {
  console.log('Replay state: ' + g_replay.state + ' -> ' + state + (why ? ' (' + why + ')' : ''));
  g_replay.state = state;
}

function clear_replay_timer() {
  clearTimeout(g_replay.timer);
  g_replay.timer = 0;
}

// words: the command split on spaces, e.g. ['REPLAY', '4000', '2', '50']
function parse_replay_options(words) {
  let length = parseInt(words[1]), showings = parseInt(words[2]), rate = parseInt(words[3]);
  if (length > 0) {
    g_replay.options.length = length;
    if (g_replay.recorder) {
      g_replay.recorder.set_length(length);
    }
  }
  if (showings > 0) {
    g_replay.options.showings = showings;
  }
  if (rate > 0) {
    g_replay.options.rate = rate;
  }
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

// Freezes the recording now, and shows it after the kiosk's delay (if any).
function trigger_replay(why) {
  clear_replay_timer();
  if (g_replay.state == 'playing') {
    console.log('Already showing a replay; ignoring ' + why);
    return;
  }
  if (!g_replay.recorder) {
    console.log('No camera stream; nothing to replay (' + why + ')');
    set_replay_state('idle', 'no camera');
    return;
  }
  g_replay.recorder.stop();
  set_replay_state('playing', why);
  let delay = $("#delay")[0].valueAsNumber * 1000;
  setTimeout(show_replay, delay > 0 ? delay : 0);
}

// For the click shield's right-click: replay what's just been recorded.
function on_replay() {
  trigger_replay('by hand');
}

function show_replay() {
  let recorder = g_replay.recorder;
  let canvas = document.getElementById("playback");
  canvas.width = $(window).width();
  canvas.height = $(window).height();

  announce_to_interior('replay-started');
  $("#playback-background").show('slide', function() {
    recorder.play(canvas, {showings: g_replay.options.showings, rate: g_replay.options.rate})
      .then(function(played) {
        if (!played) {
          console.log('Nothing to play back');
        }
        $("#playback-background").hide('slide');
        announce_to_interior('replay-ended');
        set_replay_state('idle', 'replay done');
        // The camera may have changed while the replay played
        if (g_replay.recorder) {
          g_replay.recorder.start();
        }
      });
  });
}

// Posts a message to the page running in the interior iframe.
function announce_to_interior(msg) {
  document.querySelector("#interior").contentWindow.postMessage(msg, '*');
}

// ---------------- Listening for commands ----------------

// Avoid starting another poll request while one is still in flight.
var g_poll_in_flight = false;

function poll_once_for_replay() {
  if (g_poll_in_flight) {
    return;
  }
  g_poll_in_flight = true;
  $.ajax("action.php",
         {type: 'POST',
          data: {action: 'replay.message',
                 status: 0,
                 'finished-replay': 0},
          success: function(data) {
            for (let i = 0; i < data.replay.length; ++i) {
              handle_replay_message(data.replay[i]);
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
                                            function(msg) { handle_replay_message(msg.cmd); },
                                            ['replay-commands']);
    // Commands come over the websocket; polling every 5s just tells the
    // server this kiosk is still here.
    setInterval(poll_once_for_replay, 5000);
  } else {
    setInterval(poll_once_for_replay, 250);
  }
}

// ---------------- The camera ----------------

function use_stream(stream, on_resize) {
  $("#waiting-for-remote").addClass('hidden');
  if (g_replay.recorder) {
    g_replay.recorder.close();
  }
  g_replay.recorder = new ReplayRecorder(stream, {length_ms: g_replay.options.length,
                                                  on_resize: on_resize});
  // If a replay is showing, recording starts when it's over.
  if (g_replay.state != 'playing') {
    g_replay.recorder.start();
  }
  document.getElementById("preview").srcObject = stream;
}

var g_remote_poller;

function close_remote_camera() {
  if (g_remote_poller) {
    g_remote_poller.close();
    g_remote_poller = null;
  }
}

function use_remote_camera() {
  close_remote_camera();
  $("#no-camera-warning").addClass('hidden');
  $("#waiting-for-remote").removeClass('hidden');
  let id = make_id_string("viewer-");
  console.log("Viewer id is " + id);
  g_remote_poller = new RemoteCamera(
    id,
    {width: $(window).width(),
     height: $(window).height()},
    function(stream) {
      // Says we've got a stream, even before its size is known
      $("#recording-stream-info").removeClass('hidden');
      $("#recording-stream-size").text('...');
      use_stream(stream, function(w, h) { $("#recording-stream-size").text(w + 'x' + h); });
    });
}

// A camera on this computer, or "Remote Camera" for a phone running camera.php
var g_camera;

// Shows the capture rate while recording, if it's poor.
function report_capture_rate() {
  let r = g_replay.recorder;
  let fps = (r && r.recording) ? r.capture_fps() : 0;
  let poor = r && r.recording && fps < 20;
  $("#fps").toggleClass('hidden', !poor).text(poor ? 'rec ' + fps + ' fps' : '')
    .css('background-color', fps < 10 ? 'red' : 'yellow');
}

$(function() {
  g_camera = new CameraSource({
    video: document.getElementById("preview"),
    picker: $("#device-picker"),
    remember_as: 'replay',
    constraints: () => ({width: {ideal: $(window).width()},
                         height: {ideal: $(window).height()}}),
    extra_choices: [{value: 'remote', label: 'Remote Camera'}],
    on_extra_choice: use_remote_camera,
    on_stream: function(stream) {
      close_remote_camera();
      $("#no-camera-warning").addClass('hidden');
      $("#recording-stream-info").addClass('hidden');
      use_stream(stream, null);
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

// ---------------- Setup screen ----------------

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

$(window).on('resize', function(event) { on_setup(); });
