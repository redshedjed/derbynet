<?php @session_start();
require_once('inc/banner.inc');
require_once('inc/data.inc');
session_write_close();
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Replay Camera</title>
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

g_websocket_url = <?php echo json_encode(read_raceinfo('_websocket_url', '')); ?>;

function on_add_client() {
  // Adding a new client may give new information about the ideal width and
  // height for the video stream.
  g_camera.restart();
}

var g_client_manager = new ViewClientManager(on_add_client);
var g_camera;

$(function() {
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
    },
    on_trouble: function(message) {
      $("#no-camera-warning").empty().append(message).removeClass('hidden');
    },
  });
  g_camera.start();
});

function toggle_preview() {
  $("#preview").toggleClass('hidden', !document.getElementById('show-preview').checked);
  return false;
}

</script>
</head>
<body>
<?php make_banner('Replay Camera'); ?>

<div id="log" <?php if (!isset($_GET['debug'])) echo 'class="hidden"'; ?> ></div>

<div class="block_buttons">
  <video id="preview" autoplay="true" muted="true" playsinline="true"></video>

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
