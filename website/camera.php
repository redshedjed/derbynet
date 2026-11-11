<?php @session_start();
require_once('inc/banner.inc');
require_once('inc/data.inc');
session_write_close();
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Track Camera</title>
<link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css"/>
<?php require('inc/stylesheet.inc'); ?>
<link rel="stylesheet" type="text/css" href="css/camera.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/message-poller.js"></script>
<script type="text/javascript" src="js/camera-signaling.js"></script>
<script type="text/javascript" src="js/camera-source.js"></script>
<script type="text/javascript">

var g_websocket_url = <?php echo json_encode(read_raceinfo('_websocket_url', '')); ?>;

// A track camera: a phone or webcam at the track, sending its picture to the
// replay displays.  Its name ("Start", "Finish") is how Settings > Cameras
// lists it, and sets the order replays show the cameras in.  The name comes
// from camera.php?name=..., or what this browser used last time.
function camera_name_from_page() {
  let from_url = new URLSearchParams(window.location.search).get('name');
  let remembered = null;
  try {
    remembered = window.localStorage.getItem('derbynet-track-camera-name');
  } catch (e) {
  }
  let name = (from_url || remembered || 'Track').trim().substring(0, 50);
  return name || 'Track';
}

var g_camera_name = camera_name_from_page();
try {
  window.localStorage.setItem('derbynet-track-camera-name', g_camera_name);
} catch (e) {
}

function on_add_client() {
  // A new display may want a bigger picture than the camera is sending.
  let stream = g_camera && g_camera.stream();
  let ideal = g_client_manager.ideal();
  let settings = stream ? stream.getVideoTracks()[0].getSettings() : {};
  if (!stream || ideal.width > (settings.width || 0) || ideal.height > (settings.height || 0)) {
    g_camera.restart();
  }
}

var g_client_manager = new ViewClientManager(g_camera_name, on_add_client);
var g_camera;

// Lets the server (and so Settings and the Race Dashboard) know this camera
// is here.
var g_client_id = tab_id_string('camera-');
function check_in() {
  let stream = g_camera && g_camera.stream();
  let status;
  if (!stream) {
    status = 'No camera';
  } else {
    let s = stream.getVideoTracks()[0].getSettings();
    let n = g_client_manager.connected_count();
    status = s.width + 'x' + s.height + ', sending to ' + n + (n == 1 ? ' display' : ' displays');
  }
  $("#camera-status").text(status);
  $.ajax('action.php',
         {type: 'POST',
          data: {action: 'replay.poll',
                 client: g_client_id,
                 kind: 'camera',
                 name: g_camera_name,
                 status: status}});
}

function on_rename() {
  let name = $("#camera-name").val().trim();
  if (name && name != g_camera_name) {
    // Start over under the new name
    window.location.search = '?name=' + encodeURIComponent(name);
  }
  return false;
}

$(function() {
  $("#camera-name").val(g_camera_name);
  g_camera = new CameraSource({
    video: document.getElementById("preview"),
    picker: $("#device-picker"),
    remember_as: 'track-camera',
    // As big as the biggest replay screen watching this camera
    constraints: function() {
      let c = {};
      let ideal = g_client_manager.ideal();
      if (ideal.width) {
        c.width = {ideal: ideal.width};
      }
      if (ideal.height) {
        c.height = {ideal: ideal.height};
      }
      return c;
    },
    on_stream: function(stream) {
      $("#no-camera-warning").addClass('hidden');
      g_client_manager.setstream(stream);
      let tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        logstream("Video stream width is " + tracks[0].getSettings().width);
      }
      check_in();
    },
    on_trouble: function(message) {
      $("#no-camera-warning").empty().append(message).removeClass('hidden');
    },
  });
  g_camera.start();
  check_in();
  setInterval(check_in, 2000);
});

function toggle_preview() {
  $("#preview").toggleClass('hidden', !document.getElementById('show-preview').checked);
  return false;
}

</script>
</head>
<body>
<?php make_banner('Track Camera'); ?>

<div id="log" <?php if (!isset($_GET['debug'])) echo 'class="hidden"'; ?> ></div>

<div class="block_buttons">
  <form id="camera-name-form" onsubmit="return on_rename();">
    <label for="camera-name">Camera name:</label>
    <input type="text" id="camera-name" maxlength="50" autocomplete="off"/>
    <input type="submit" class="btn btn-secondary btn-sm" value="Rename"/>
  </form>

  <video id="preview" autoplay="true" muted="true" playsinline="true"></video>
  <p id="camera-status"></p>

  <div id="no-camera-warning" class="hidden"></div>

  <div id="device-picker-div">
    <select id="device-picker"><option>Please wait</option></select>
  </div>

  <div>
    <input type="checkbox" id="show-preview" checked="checked"
        onclick="toggle_preview();"/>
    <label for="show-preview">Show preview?</label>
  </div>
</div>

</body>
</html>
