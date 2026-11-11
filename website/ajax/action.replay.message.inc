<?php
// The older replay protocol, for outside replay apps (see docs/Developers-
// Replay Messages).  DerbyNet's own replay kiosk uses replay.poll instead.
//
// $_POST['status']           the app's status code (see below)
// $_POST['finished-replay']  0/1, not used
//
// Answers with the replay commands sent since the last request, or HELLO when
// the app has just (re)connected.  Every such app shares one place in the
// command log, as they always shared one queue.
//
// TODO: Permissions?  Presently accepting this without authentication.

require_once('inc/replay.inc');

$status_text = array(0 => 'Ready',
                     1 => 'Recording',
                     2 => 'Playing',
                     -1 => 'Connecting...',
                     -2 => 'No video source chosen',
                     -3 => 'No audio source chosen',
                     -4 => 'Recording error');
$status = isset($_POST['status']) ? intval($_POST['status']) : 0;

$app = replay_client('replay-app');
if (!replay_client_is_current($app)) {
  // Just connected: nothing to catch up on
  $queue = array('HELLO');
  $last_seq = latest_replay_seq();
} else {
  $queue = array();
  $last_seq = $app['last_seq'];
  foreach (replay_commands_since($last_seq) as $command) {
    $queue[] = $command['cmd'];
    $last_seq = $command['seq'];
  }
}
replay_client_checkin('replay-app', 'display', 'Replay app',
                      isset($status_text[$status]) ? $status_text[$status] : 'Status '.$status,
                      $last_seq);

json_out('replay', $queue);
json_success();
?>
