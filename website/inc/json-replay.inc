<?php

require_once('inc/replay.inc');

// Replay status for the Race Dashboard: how many displays are showing
// replays, and whether each track camera that's switched on is connected.
function json_replay() {
  $displays = 0;
  $cameras_up = array();
  $last_contact = 0;
  foreach (replay_clients() as $client) {
    if (!$client['connected']) {
      continue;
    }
    $last_contact = max($last_contact, $client['last_contact']);
    if ($client['kind'] == 'display') {
      ++$displays;
    } else if ($client['kind'] == 'camera') {
      $cameras_up[$client['name']] = true;
    }  // (A photo stand doesn't figure in replays.)
  }
  $missing = array();
  foreach (track_cameras(/* enabled_only */ true) as $cam) {
    if (!isset($cameras_up[$cam['name']])) {
      $missing[] = $cam['name'];
    }
  }

  if ($displays == 0) {
    $msg = 'NOT CONNECTED';
    $icon = 'img/status/not_connected.png';
  } else {
    $msg = $displays.($displays == 1 ? ' display' : ' displays');
    if (count($cameras_up) > 0) {
      $msg .= ', '.(count($cameras_up) == 1 ? 'camera ' : 'cameras ')
          .implode(', ', array_keys($cameras_up));
    }
    if (count($missing) > 0) {
      $msg .= '.  Not connected: '.implode(', ', $missing);
      $icon = 'img/status/trouble.png';
    } else {
      $icon = 'img/status/ok.png';
    }
  }
  return array(
    'last_contact' => $last_contact,
    'icon' => $icon,
    'connected' => $displays > 0,
    'displays' => $displays,
    'missing_cameras' => $missing,
    'message' => $msg);
}

?>
