<?php
// Check-in for stations: replay displays, track cameras and photo stands.
//
// $_POST['client']   an id for the station: kiosk-<address> for one run as a
//                    kiosk (kiosk-<address>-camera-<n> for each track camera
//                    it streams), otherwise one the page made up for itself
// $_POST['kind']     'display', 'camera' or 'stand'
// $_POST['name']     a camera's name, or what a display or stand calls itself
// $_POST['status']   a line of text describing how it's doing
// $_POST['devices']  (optional) JSON list of the names of its cameras, so the
//                    Kiosk Dashboard can choose one
// $_POST['since']    (displays) seq of the last command it's seen, or -1 if
//                    it's just started
//
// Cameras are set up in Settings > Cameras; one checking in doesn't add itself.
//
// A display gets back:
//   commands: [{seq, cmd}, ...]  the replay commands after 'since'
//   seq:      the latest seq (start from here)
//   cameras:  the track cameras that are switched on, in replay order, each
//             with any tuning of its own (0 = use the Race Dashboard's)
//
// No login needed: stations are kiosks.

require_once('inc/replay.inc');

$clientid = isset($_POST['client']) ? substr($_POST['client'], 0, 100) : '';
$kind = isset($_POST['kind']) && in_array($_POST['kind'], array('camera', 'stand'))
    ? $_POST['kind'] : 'display';
$name = isset($_POST['name']) ? trim($_POST['name']) : '';
$status = isset($_POST['status']) ? $_POST['status'] : '';
$devices = isset($_POST['devices']) && is_array(json_decode($_POST['devices'], true))
    ? $_POST['devices'] : '';

if ($clientid === '') {
  json_failure('no-client', 'No client id given.');
} else {
  replay_client_checkin($clientid, $kind, $name, $status, $devices);

  if ($kind == 'display') {
    $since = isset($_POST['since']) ? intval($_POST['since']) : -1;
    $latest = latest_replay_seq();
    json_out('commands', $since < 0 ? array() : replay_commands_since($since));
    json_out('seq', $latest);
    json_out('cameras', track_cameras(/* enabled_only */ true));
  }
  json_success();
}
?>
