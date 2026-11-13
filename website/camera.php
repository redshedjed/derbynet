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
<link rel="stylesheet" type="text/css" href="css/mobile.css"/>
<link rel="stylesheet" type="text/css" href="css/camera.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/mobile.js"></script>
<script type="text/javascript" src="js/message-poller.js"></script>
<script type="text/javascript" src="js/camera-signaling.js"></script>
<script type="text/javascript" src="js/camera-source.js"></script>
<script type="text/javascript" src="js/track-camera.js"></script>
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

function on_rename() {
  let name = $("#camera-name").val().trim();
  if (name && name != g_camera_name) {
    // Start over under the new name
    window.location.search = '?name=' + encodeURIComponent(name);
  }
  return false;
}

// See js/track-camera.js.  (The Track Camera kiosk page does the same, with
// its name and camera chosen on the Kiosk Dashboard.)
var g_station;
$(function() {
  $("#camera-name").val(g_camera_name);
  g_station = new TrackCameraStation({
    name: g_camera_name,
    client_id: tab_id_string('camera-'),
    video: document.getElementById("preview"),
    picker: $("#device-picker"),
    remember_as: 'track-camera',
    on_status: function(status) { $("#camera-status").text(status); },
    on_stream: function() { $("#no-camera-warning").addClass('hidden'); },
    on_trouble: function(message) {
      $("#no-camera-warning").empty().append(message).removeClass('hidden');
    },
  });
  g_station.start();
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

<div class="page-content narrow">
<section class="card card-accent accent-during">
  <h2 class="card-title">This Camera</h2>
  <form id="camera-name-form" class="form-row" onsubmit="return on_rename();">
    <label for="camera-name">Name</label>
    <input type="text" id="camera-name" class="not-mobile" maxlength="50" autocomplete="off"/>
    <input type="submit" class="btn btn-secondary btn-sm" value="Rename"/>
  </form>

  <div id="device-picker-div" class="form-row">
    <label for="device-picker">Camera</label>
    <select id="device-picker" data-wrapper-class="mselect-inline"><option>Please wait</option></select>
  </div>

  <div id="no-camera-warning" class="hidden"></div>

  <div class="form-row">
    <input type="checkbox" id="show-preview" checked="checked"
        onclick="toggle_preview();"/>
    <label for="show-preview">Show preview</label>
  </div>

  <video id="preview" autoplay="true" muted="true" playsinline="true"></video>
  <p id="camera-status"></p>
</section>
</div>

</body>
</html>
