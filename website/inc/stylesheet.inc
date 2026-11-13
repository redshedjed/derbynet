<?php
// Pages listed here are laid out for phones, so they get a viewport tag.
// Every other page keeps the browser's default on a phone: the desktop layout,
// zoomed out, which shows everything, just small.  Without this list, those
// pages would run off the side of a phone screen.  Add a page once it fits a
// 390px-wide screen (see the UI modernization plan, Phases 3 and 4).
$mobile_ready_pages = array(
  'about.php',
  'awards-editor.php',
  'awards-presentation.php',
  'coordinator.php',
  'export.php',
  'fakeroster.php',
  'history.php',
  'import-snapshot.php',
  'index.php',
  'judging.php',
  'kiosk-dashboard.php',
  'login.php',
  'mcheckin.php',
  'ondeck.php',
  'photo-thumbs.php',
  'print.php',  // had its own viewport tag before
  'quickref.php',
  'racer-results.php',
  'scenes.php',
  'slideshow.php',
  'standings.php',
  'system-info.php',
  'vote.php',
);
if (in_array(basename($_SERVER['SCRIPT_NAME']), $mobile_ready_pages)) {
  echo "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>\n";
}
?>
<link rel="stylesheet" type="text/css" href="css/global.css"/>
