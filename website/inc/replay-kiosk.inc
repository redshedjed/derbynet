<?php
// The layer for a kiosk whose location (Kiosk Editor) shows replays, or has a
// camera of its own.  Included by kiosk.php; $g_kiosk_address and $kpage come
// from there.
//
// The kiosk's own page (Now Racing, Live Camera, Standings...) fills the
// window in a frame, as kiosk.php?address=...&inner=1, and changes with
// scenes as usual.  Over it:
//   - Show replays: this layer records the track cameras switched on in
//     Settings > Cameras, and when a heat finishes slides the replay in over
//     the page, then back out.
//   - A camera of its own: this display's webcam is the track camera of that
//     name, sending its picture to every replay display (this one included).
// If either setting changes, the page in the frame notices
// (js/kiosk-poller.js) and reloads this whole window.

$inner_url = 'kiosk.php?'.http_build_query(array('address' => $g_kiosk_address, 'inner' => 1));
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Replay</title>
<link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css"/>
<link rel="stylesheet" type="text/css" href="css/replay.css"/>
<style type="text/css">
html, body {
  margin: 0;
  overflow: hidden;
  background: black;
}
/* (This page doesn't load global.css, which usually supplies this.) */
.hidden {
  display: none;
}
</style>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/ajax-setup.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/message-poller.js"></script>
<script type="text/javascript" src="js/viewer-signaling.js"></script>
<script type="text/javascript" src="js/camera-signaling.js"></script>
<script type="text/javascript" src="js/camera-source.js"></script>
<script type="text/javascript" src="js/track-camera.js"></script>
<script type="text/javascript" src="js/replay-recorder.js"></script>
<script type="text/javascript">
var g_websocket_url = <?php echo json_encode(read_raceinfo('_websocket_url', '')); ?>;
// Tells js/replay-display.js to run as a kiosk: no setup screen, and this
// kiosk's page beneath.
var g_replay_kiosk = {
  address: <?php echo json_encode($g_kiosk_address); ?>,
  inner_url: <?php echo json_encode($inner_url); ?>,
  name: <?php echo json_encode($kpage['name'] !== '' ? $kpage['name'] : madlib_string($g_kiosk_address)); ?>,
  replays: <?php echo json_encode(!empty($kpage['replays'])); ?>,
  camera: <?php echo json_encode($kpage['camera']); ?>
};
</script>
<script type="text/javascript" src="js/replay-display.js"></script>
</head>
<body>
  <div id="fps" class="hidden"></div>
  <iframe id="interior" class="full-window"></iframe>
  <div id="playback-background" class="hidden full-window">
    <canvas id="playback" class="full-window"></canvas>
  </div>
  <!-- This display's own camera, if it has one (unseen; replays show it) -->
  <video id="own-camera" class="hidden" autoplay="autoplay" muted="muted" playsinline="playsinline"></video>
</body>
</html>
