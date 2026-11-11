<?php @session_start();
require_once('inc/banner.inc');
require_once('inc/data.inc');
session_write_close();
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Replay Recording</title>
<?php
require('inc/stylesheet.inc');
require('inc/servername.inc');

$server = server_name();
$path = request_path();

$url = $server . $path;

$last = strrpos($url, '/');
if ($last === false) {
  $last = -1;
}

// Don't force http !
$kiosk_url = '//'.substr($url, 0, $last + 1).'kiosk.php';
if (isset($_REQUEST['address'])) {
  $kiosk_url .= "?address=".$_REQUEST['address'];
}
?>
<link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css"/>
<link rel="stylesheet" type="text/css" href="css/replay.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/ajax-setup.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/screenfull.min.js"></script>
<script type="text/javascript" src="js/message-poller.js"></script>
<script type="text/javascript" src="js/viewer-signaling.js"></script>
<script type="text/javascript" src="js/circular-frame-buffer.js"></script>
<script type="text/javascript" src="js/video-device-picker.js"></script>
<script type="text/javascript">

g_websocket_url = <?php echo json_encode(read_raceinfo('_websocket_url', '')); ?>;
// If using websockets to listen for replay messages, this variable will hold
// the websocket object.
var g_trigger_websocket;

// Avoid starting another poll request if another one is still in flight.
g_poll_in_flight = false;

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
            // Called after success (or error)
            g_poll_in_flight = false;
          },
         });
}

function listen_for_replay_messages() {
  if (g_websocket_url != "") {
    // g_trigger_websocket is the websocket on which we listen for replay messages
    g_trigger_websocket = new MessagePoller(make_id_string('replay-'),
                                            function(msg) { handle_replay_message(msg.cmd); },
                                            ['replay-commands']);
    // Even though we're using the websocket for triggering, poll every 5s (as
    // opposed to several times per second), so we get credit for being
    // connected.
    setInterval(poll_once_for_replay, 5000);
  } else {
    setInterval(poll_once_for_replay, 250);
  }
}

// If a replay is triggered by timing out after a RACE_STARTS, then ignore any
// subsequent REPLAY messages until the next START.
//
// If a replay is triggered by a REPLAY message that arrives before the timeout
// (as most will), then we just cancel the g_replay_timeout.
g_preempted = false;


var g_remote_poller;
var g_recorder;

var g_replay_options = {
  count: 2,
  rate: 50,  // expressed as a percentage
  length: 4000  // ms
};

function parse_replay_options(cmdline) {
  g_replay_options.length = parseInt(cmdline.split(" ")[1]);
  if (g_recorder) {
    g_recorder.set_recording_length(g_replay_options.length);
  }
  g_replay_options.count = parseInt(cmdline.split(" ")[2]);
  g_replay_options.rate = parseInt(cmdline.split(" ")[3]);
}

// If non-zero, holds the timeout ID of a pending timeout that will trigger a
// replay based on the start of a heat.
var g_replay_timeout = 0;
// Milliseconds short of g_replay_length to start a replay after a race start.
var g_replay_timeout_epsilon = 0;

function handle_replay_message(cmdline) {
  console.log('* Replay message:', cmdline);
  if (cmdline.startsWith("HELLO")) {
  } else if (cmdline.startsWith("TEST")) {
    parse_replay_options(cmdline);
    on_replay();
  } else if (cmdline.startsWith("START")) {  // Setting up for a new heat
    // START carries a heat name (e.g., Bears_Round1_Heat02), which isn't
    // needed now that replays aren't saved.
    g_preempted = false;
  } else if (cmdline.startsWith("REPLAY")) {
    // REPLAY skipback showings rate
    // (Must be exactly one space between fields:)
    parse_replay_options(cmdline);
    if (!g_preempted) {
      clearTimeout(g_replay_timeout);
      console.log('Triggering replay from REPLAY message');
      on_replay();
    }
  } else if (cmdline.startsWith("CANCEL")) {
    clearTimeout(g_replay_timeout);
  } else if (cmdline.startsWith("RACE_STARTS")) {
    // This message signals that the start gate has actually opened (if that can
    // be detected).  The START message identifies what heat is queued next.
    parse_replay_options(cmdline);
    g_replay_timeout = setTimeout(
      function() {
        g_preempted = true;
        console.log('Triggering replay from timeout after RACE_STARTS');
        on_replay();
      },
      g_replay_options.length - g_replay_timeout_epsilon);
  } else {
    console.log("Unrecognized replay message: " + cmdline);
  }
}

$(function() {
  listen_for_replay_messages();
  console.log('Replay page (re)loaded');
});

function on_stream_ready(stream) {
  $("#waiting-for-remote").addClass('hidden');
  g_recorder = new CircularFrameBuffer(stream, g_replay_options.length);
  g_recorder.start_recording();
  document.getElementById("preview").srcObject = stream;
}

function on_remote_stream_ready(stream) {
  let resize = function(w, h) {
    $("#recording-stream-info").removeClass('hidden');
    $("#recording-stream-size").text(w + 'x' + h);
  };
  resize(-1, -1);  // Says we've got a stream, even if no frames yet.
  on_stream_ready(stream);
  g_recorder.on_resize(resize);
}

function on_device_selection(selectq) {
  // mobile_select_refresh(selectq);
  // If a stream is already open, stop it.
  stream = document.getElementById("preview").srcObject;
  if (stream != null) {
    stream.getTracks().forEach(function(track) {
      track.stop();
    });
  }	

  let device_id = selectq.find(':selected').val();

  if (typeof(navigator.mediaDevices) == 'undefined') {
    $("#no-camera-warning").toggleClass('hidden', device_id == 'remote');
  }

  if (device_id == 'remote') {
    if (g_remote_poller) {
      g_remote_poller.close();
      g_remote_poller = null;
    }
    $("#waiting-for-remote").removeClass('hidden');
    let id = make_id_string("viewer-");
    console.log("Viewer id is " + id);
    g_remote_poller = new RemoteCamera(
      id,
      {width: $(window).width(),
       height: $(window).height()},
      on_remote_stream_ready);
  } else {
    if (g_remote_poller) {
      g_remote_poller.close();
      g_remote_poller = null;
    }
    $("#recording-stream-info").addClass('hidden');
    navigator.mediaDevices.getUserMedia(
      { video: {
          deviceId: device_id,
          width: { ideal: $(window).width() },
          height: { ideal: $(window).height() }
        }
      })
    .then(on_stream_ready);
  }
}

$(function() {
    if (typeof(navigator.mediaDevices) == 'undefined') {
      $("#no-camera-warning").removeClass('hidden');
      if (window.location.protocol == 'http:') {
        var https_url = "https://" + window.location.hostname + window.location.pathname;
        $("#no-camera-warning").append("<p>You may need to switch to <a href='" +  https_url + "'>" + https_url + "</a></p>");
      }
    } else {
      navigator.mediaDevices.ondevicechange = function(event) {
        build_device_picker($("#device-picker"), /*include_remote*/true, on_device_selection, on_setup);
      };
    }

    build_device_picker($("#device-picker"), /*include_remote*/true, on_device_selection);
});

// Posts a message to the page running in the interior iframe.
function announce_to_interior(msg) {
  document.querySelector("#interior").contentWindow.postMessage(msg, '*');
}

function on_replay() {
  console.log('* on_replay');

  // If this is a replay triggered after RACE_START, make sure we don't start
  // another replay for the same heat.
  if (g_replay_timeout > 0) {
    clearTimeout(g_replay_timeout);
  }
  g_replay_timeout = 0;

  if (!g_recorder) {
    // No camera stream has started yet, so there's nothing to play back.
    console.log('No camera stream; nothing to replay');
    return;
  }

  g_recorder.stop_recording();

  var delay = $("#delay")[0].valueAsNumber * 1000;
  if (delay > 0) {
    setTimeout(start_playback, delay);
  } else {
    console.log('Direct playback');
    start_playback();
  }
}

function start_playback() {
  let playback = document.querySelector("#playback");
  playback.width = $(window).width();
  playback.height = $(window).height();

  announce_to_interior('replay-started');

  $("#playback-background").show('slide', function() {
      g_recorder.playback(playback,
                          g_replay_options.count,
                          g_replay_options.rate,
                          /* on_precanvas */ null,
                          /* on_playback_finished */ null,
                          function() {
                            $("#playback-background").hide('slide');
                            announce_to_interior('replay-ended');
                            g_recorder.start_recording();
                          });
    });
}

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

</script>
</head>
<body>
  <div id="fps"></div>

  <div id="debug" <?php if (!isset($_GET['debug'])) echo 'class="hidden"'; ?> >
    <div id="log">
    </div>
  </div>

<iframe id="interior" class="hidden full-window">
</iframe>

<div id="click-shield" class="hidden full-window"
     onclick="on_setup(); return false;"
     oncontextmenu="on_replay(); return false;">
</div>

<div id="playback-background" class="hidden full-window">
  <canvas id="playback" class="full-window">
  </canvas>
</div>

<div id="replay-setup" class="full-window block_buttons">
  <?php make_banner('Replay'); ?>

  <div id="no-camera-warning" class="hidden">
     <h2 id='reject'>Access to cameras is blocked.</h2>
  </div>

  <div id="preview-container">
    <video id="preview" autoplay="true" muted="true" playsinline="true">
    </video>
    <div id="waiting-for-remote" class="hidden">
      <p>Waiting for remote camera to connect...</p>
    </div>
  </div>

    <div id="device-picker-div">
      <select id="device-picker"><option>Please wait</option></select>
    </div>
    <p id="recording-stream-info" class="hidden">
      Recording at <span id="recording-stream-size"></span>
    </p>

  <div id="replay-setup-controls" style="margin-left: 25%; margin-right: 25%;">

    <p>
    <input type="checkbox" id="go-fullscreen" checked="checked"/>
    <label for="go-fullscreen">Change to fullscreen?</label>
    </p>

    <label for="inner_url">URL:</label>
    <input type="text" name="inner_url" id="inner_url" size="50"
           value="<?php echo htmlspecialchars($kiosk_url, ENT_QUOTES, 'UTF-8'); ?>"/>

    <p style="font-size: 1em; margin-left: 10%;">Delay playback by:
    <input type="number" name="delay" id="delay" min="0" step="0.1" value="0.0" size="8"
           style="font-size: 1em; width: 5em; "/>
    (s) after heat ends
    </p>

    <input type="button" value="Proceed" onclick="on_proceed();"/>
  </div>
</div>

</body>
</html>
