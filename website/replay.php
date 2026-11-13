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
// inner=1: this page does the replays, so the kiosk beneath shouldn't add
// its own replay layer (see inc/replay-kiosk.inc), whatever its location.
$kiosk_query = array('inner' => 1);
if (isset($_REQUEST['address'])) {
  $kiosk_query = array('address' => $_REQUEST['address'], 'inner' => 1);
}
$kiosk_url = '//'.substr($url, 0, $last + 1).'kiosk.php?'.http_build_query($kiosk_query);
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
<script type="text/javascript" src="js/camera-source.js"></script>
<script type="text/javascript" src="js/replay-recorder.js"></script>
<script type="text/javascript">
var g_websocket_url = <?php echo json_encode(read_raceinfo('_websocket_url', '')); ?>;
</script>
<script type="text/javascript" src="js/replay-display.js"></script>
</head>
<body>
  <div id="fps" class="hidden"></div>

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

  <div id="no-camera-warning" class="hidden"></div>

  <div id="preview-container">
    <video id="preview" autoplay="true" muted="true" playsinline="true" disablepictureinpicture="disablepictureinpicture">
    </video>
    <!-- "Track cameras": one tile per camera, in replay order -->
    <div id="track-previews" class="hidden">
      <p id="no-track-cameras" class="hidden">No track cameras are switched on.  Open
        <b>camera.php?name=Finish</b> (for example) on a phone or laptop at the track;
        it appears in <b>Settings &gt; Cameras</b>.</p>
    </div>
  </div>

    <div id="device-picker-div">
      <select id="device-picker"><option>Please wait</option></select>
    </div>

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
