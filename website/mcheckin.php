<?php @session_start();
require_once('inc/banner.inc');
require_once('inc/authorize.inc');

require_once('inc/data.inc');
require_once('inc/mobile-checkin-key.inc');

// Who can use Mobile Check-In: someone logged in who can check racers in, or
// a phone that scanned the QR code on Race Check-In, whose link carries the
// secret key.  The key is taken off the address once it has been accepted.
if (isset($_GET['key'])) {
  if (is_mobile_checkin_key($_GET['key'])) {
    grant_mobile_checkin($_GET['key']);
    session_write_close();
    header('Location: mcheckin.php');
    exit(0);
  }
  // A key from an old QR code: they'll have to log in, or scan the new one
}
drop_stale_mobile_checkin();
require_permission(CHECK_IN_RACERS_PERMISSION);

// Mobile check-in also takes photos, and can undo a check-in
$_SESSION['permissions'] |=
    REVERT_CHECK_IN_PERMISSION |
    PHOTO_UPLOAD_PERMISSION
;
session_write_close();
?><!DOCTYPE html>
<html>
<head>

<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Mobile Check-In</title>
<link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css"/>
<?php require('inc/stylesheet.inc'); ?>
<link rel="stylesheet" type="text/css" href="css/mobile.css"/>
<link rel="stylesheet" type="text/css" href="css/camera.css"/>
<link rel="stylesheet" type="text/css" href="css/mcheckin.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/mobile.js"></script>
<!-- webrtc adapter: recommended for use with quaggajs -->
<script type="text/javascript" src="js/adapter.js"></script>
<script type="text/javascript" src="js/video-device-picker.js"></script>
<script type="text/javascript" src="js/zxing.js"></script>
<script type="text/javascript" src="js/mcheckin.js"></script>
<script type="text/javascript">
//window.addEventListener('resize', function(event) { report_trouble('resize event'); });
//window.addEventListener('orientationchange', function(event) { report_trouble('orientationchange event'); });
$(function() {
  refresh_racer_list();
});
</script>
</head>
<body>
<?php make_banner('Mobile Check-In', 'checkin.php'); ?>

<div id="greetings-background" class="hidden"><!-- Added "hidden" as an experiment -->
  <div id="greetings" class="block_buttons">
    <p id="step1">Point your camera at the barcode identifying a racer.  Then:</p>
    <p>Tap <img src="img/photo-headshot.png"/> to capture a picture of the racer.</p>
    <p>Use the switch to mark the racer as checked in.</p>
    <p>Tap <img src="img/photo-car.png"/> to capture a picture of the car.</p>

    <input type="button" value="Start" onclick="dismiss_greetings()"/>
 </div>
</div>


<div id="trouble" class="hidden" onclick="close_trouble();"> </div>

<div id="announce-hover" class="hidden" onclick="close_announce_hover();"></div>

<div id="camera-div" class='hidden'>
  <div id="device-picker-div">
    <button type="button" id="list-button" class="btn btn-secondary btn-sm"
            onclick="on_done_click();">&#x2039; Racers</button>
    <select id="device-picker" ><option>Please wait</option></select>
  </div>

  <div id="preview-container">
    <video id="preview" autoplay muted playsinline> </video>
    <div id="preview-overlay">
      <div id="preview-overlay-content">
         Point at a racer's barcode
      </div>
    </div>
  </div>
</div>

<div id="racer-list">
  <div id="racer-filter-bar">
    <input type="search" id="racer-filter" placeholder="Find a racer: name, car number or group"
           autocomplete="off" oninput="filter_racer_list();"/>
  </div>
  <ul class="mlistview"></ul>
  <p id="racer-list-empty" class="hidden">No racers match.</p>
  <div id="switch-to-camera-button" onclick="on_switch_to_camera_cllicked();">Scan a Barcode</div>
</div>

<audio id="beep" src="img/barcode.mp3"></audio>
<div id="flash-overlay"></div>

<!-- The chosen racer: their photos and check-in, over the camera -->
<div id="slide-in">
  <div id="slide-in-inner">
    <div id="racer-head">
      <div id="racer-div"></div>
      <button type="button" id="done-button" class="btn btn-sm"
              onclick="on_done_click();">Done</button>
    </div>
    <div id="controls">
      <div id="controls-inner">

        <div id="head-button" class="escutcheon" onclick="capture_photo('head');">
          <div class="thumbnail-carrier" >
            <img class="thumbnail" src="img/photo-headshot.png"/>
          </div>
          <div class="escutcheon-label">Racer photo</div>
          <div id="autocrop-button" title="Crop racer photos to the face"
               onclick="event.stopPropagation(); on_autocrop_button_click();">Crop: Off</div>
        </div>

        <div id="checkin-button" class="escutcheon" onclick="on_checkin_button_click();">
          <div id="checkin-button-text">No racer selected</div>
        </div>

        <div id="car-button" class="escutcheon" onclick="capture_photo('car');">
          <div class="thumbnail-carrier">
            <img class="thumbnail" src="img/photo-car.png"/>
          </div>
          <div class="escutcheon-label">Car photo</div>
        </div>
      </div>
    </div>
  </div>
</div>


<img id="logo-bug" src="img/derbynet.png"/>

</body>
</html>
