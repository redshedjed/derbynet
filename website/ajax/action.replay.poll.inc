<?php
// Check-in for replay displays (replay.php) and track cameras (camera.php).
//
// $_POST['client']  an id the page made up for itself
// $_POST['kind']    'display' or 'camera'
// $_POST['name']    a camera's name, or what a display calls itself
// $_POST['status']  a line of text describing how it's doing
// $_POST['since']   (displays) seq of the last command it's seen, or -1 if
//                   it's just started
//
// A camera checking in under a new name is added to the track cameras.
//
// A display gets back:
//   commands: [{seq, cmd}, ...]  the replay commands after 'since'
//   seq:      the latest seq (start from here)
//   cameras:  the track cameras that are switched on, in replay order, each
//             with any tuning of its own (0 = use the Race Dashboard's)
//
// No login needed: displays and cameras are kiosks.

require_once('inc/replay.inc');

$clientid = isset($_POST['client']) ? substr($_POST['client'], 0, 50) : '';
$kind = (isset($_POST['kind']) && $_POST['kind'] == 'camera') ? 'camera' : 'display';
$name = isset($_POST['name']) ? trim($_POST['name']) : '';
$status = isset($_POST['status']) ? $_POST['status'] : '';

if ($clientid === '') {
  json_failure('no-client', 'No client id given.');
} else {
  replay_client_checkin($clientid, $kind, $name, $status);

  if ($kind == 'camera') {
    add_track_camera(substr($name, 0, 50));
  } else {
    $since = isset($_POST['since']) ? intval($_POST['since']) : -1;
    $latest = latest_replay_seq();
    json_out('commands', $since < 0 ? array() : replay_commands_since($since));
    json_out('seq', $latest);
    json_out('cameras', track_cameras(/* enabled_only */ true));
  }
  json_success();
}
?>
