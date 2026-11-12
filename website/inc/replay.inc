<?php

// Instant replay, server side.
//
// Commands for the replay displays are appended to the ReplayCommands log:
//   START <heat>                          a heat is staged
//   RACE_STARTS <length> <showings> <%>   the gate opened: replay after
//                                         <length> ms unless REPLAY comes first
//   REPLAY <length> <showings> <%>        the heat finished: replay now
//   CANCEL                                forget the pending replay
//   TEST <length> <showings> <%>          replay now, to try the settings
// (<length> in ms, <%> the playback speed as a percent of normal.)  Each
// display (js/replay-display.js) polls replay.poll with the seq of the last
// command it has seen, so every display gets every command, however many
// there are.  If a websocket server is configured, commands also go out over
// it at once, with their seq.
//
// Displays and track cameras check in with every poll; ReplayClients keeps
// when each was last heard from, for the status on Settings and the Race
// Dashboard.  TrackCameras lists the named cameras (camera.php?name=Finish),
// in the order replays show them, each with optional tuning of its own.

require_once('inc/data.inc');
require_once('inc/sql-script.inc');
require_once('inc/ws-trigger.inc');

// A client not heard from for this many seconds counts as gone.
define('REPLAY_TIMEOUT_LIMIT', 10);
// Commands are kept this long (seconds); a display that's been away longer
// has nothing to catch up on.
define('REPLAY_COMMAND_LIFETIME', 60);
// A client's check-in is written at most this often (seconds), unless
// something about it changed, to keep database writes down.
define('REPLAY_CHECKIN_INTERVAL', 2);

// Runs $sql with $params, first creating the table (from sql/<db>/<script>)
// if it doesn't exist yet.  Returns the executed statement.
function replay_sql($script, $sql, $params = array()) {
  global $db;
  try {
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt;
  } catch (PDOException $p) {
    if (!is_no_such_table_exception($p)) {
      throw $p;
    }
  }
  run_sql_script($script);
  $stmt = $db->prepare($sql);
  $stmt->execute($params);
  return $stmt;
}

// ---------------- The command log ----------------

function latest_replay_seq() {
  $stmt = replay_sql('replay-commands-table', 'SELECT MAX(seq) FROM ReplayCommands');
  $seq = $stmt->fetchColumn();
  $stmt->closeCursor();
  return $seq ? intval($seq) : 0;
}

// Returns the commands after $seq, oldest first, as {seq, cmd}
function replay_commands_since($seq) {
  $stmt = replay_sql('replay-commands-table',
                     'SELECT seq, command FROM ReplayCommands WHERE seq > :seq ORDER BY seq',
                     array(':seq' => intval($seq)));
  $commands = array();
  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $commands[] = array('seq' => intval($row['seq']), 'cmd' => $row['command']);
  }
  return $commands;
}

function send_replay_message($cmd) {
  $now = time();
  replay_sql('replay-commands-table',
             'INSERT INTO ReplayCommands(posted, command) VALUES(:posted, :command)',
             array(':posted' => $now, ':command' => $cmd));
  replay_sql('replay-commands-table',
             'DELETE FROM ReplayCommands WHERE posted < :old',
             array(':old' => $now - REPLAY_COMMAND_LIFETIME));
  $seq = latest_replay_seq();
  // The seq lets a display that also polls skip what it's already had.
  maybe_send_ws_trigger(array('url' => read_raceinfo('_websocket_url'),
                              'topic' => 'replay-commands',
                              'type' => 'replay-cmd',
                              'cmd' => $cmd,
                              'seq' => $seq));
  return true;
}

// ---------------- Who's connected ----------------

// The client's row, or false
function replay_client($clientid) {
  $stmt = replay_sql('replay-clients-table',
                     'SELECT clientid, kind, name, status, last_contact'
                     .' FROM ReplayClients WHERE clientid = :clientid',
                     array(':clientid' => $clientid));
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  $stmt->closeCursor();
  return $row;
}

function replay_client_is_current($row) {
  return $row && $row['last_contact'] + REPLAY_TIMEOUT_LIMIT >= time();
}

// Records that a display or camera was just heard from.  Returns the
// client's row as it was before.
function replay_client_checkin($clientid, $kind, $name, $status) {
  $now = time();
  $row = replay_client($clientid);
  $params = array(':clientid' => $clientid,
                  ':kind' => $kind,
                  ':name' => substr($name, 0, 100),
                  ':status' => substr($status, 0, 250),
                  ':last_contact' => $now);
  if (!$row) {
    replay_sql('replay-clients-table',
               'INSERT INTO ReplayClients(clientid, kind, name, status, last_contact)'
               .' VALUES(:clientid, :kind, :name, :status, :last_contact)',
               $params);
    // Now and then, forget clients long gone
    replay_sql('replay-clients-table',
               'DELETE FROM ReplayClients WHERE last_contact < :old',
               array(':old' => $now - 3600));
  } else if ($now - $row['last_contact'] >= REPLAY_CHECKIN_INTERVAL ||
             $row['kind'] != $kind || $row['name'] != $params[':name'] ||
             $row['status'] != $params[':status']) {
    replay_sql('replay-clients-table',
               'UPDATE ReplayClients SET kind = :kind, name = :name, status = :status,'
               .' last_contact = :last_contact'
               .' WHERE clientid = :clientid',
               $params);
  }
  return $row;
}

// All clients heard from in the last hour, with 'connected' and 'seconds'
// (since last heard from)
function replay_clients() {
  $stmt = replay_sql('replay-clients-table',
                     'SELECT clientid, kind, name, status, last_contact FROM ReplayClients'
                     .' ORDER BY kind, name');
  $now = time();
  $clients = array();
  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $row['seconds'] = $now - $row['last_contact'];
    $row['connected'] = replay_client_is_current($row);
    $clients[] = $row;
  }
  return $clients;
}

// ---------------- Track cameras ----------------

// All track cameras, in replay order.  0 for skipback, showings or rate means
// the Race Dashboard's setting applies.
function track_cameras($enabled_only = false) {
  $stmt = replay_sql('track-cameras-table',
                     'SELECT name, sortorder, enabled, skipback, showings, rate FROM TrackCameras'
                     .($enabled_only ? ' WHERE enabled <> 0' : '')
                     .' ORDER BY sortorder, name');
  $cameras = array();
  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $cameras[] = array('name' => $row['name'],
                       'sortorder' => intval($row['sortorder']),
                       'enabled' => $row['enabled'] != 0,
                       'skipback' => intval($row['skipback']),
                       'showings' => intval($row['showings']),
                       'rate' => intval($row['rate']));
  }
  return $cameras;
}

function track_camera_exists($name) {
  $stmt = replay_sql('track-cameras-table',
                     'SELECT COUNT(*) FROM TrackCameras WHERE name = :name',
                     array(':name' => $name));
  $n = $stmt->fetchColumn();
  $stmt->closeCursor();
  return $n > 0;
}

// A camera that checks in under a new name joins the end of the list, on.
function add_track_camera($name) {
  if ($name === '' || track_camera_exists($name)) {
    return false;
  }
  $stmt = replay_sql('track-cameras-table', 'SELECT MAX(sortorder) FROM TrackCameras');
  $max = $stmt->fetchColumn();
  $stmt->closeCursor();
  replay_sql('track-cameras-table',
             'INSERT INTO TrackCameras(name, sortorder, enabled, skipback, showings, rate)'
             .' VALUES(:name, :sortorder, 1, 0, 0, 0)',
             array(':name' => $name, ':sortorder' => intval($max) + 1));
  return true;
}

// $fields: any of enabled, skipback, showings, rate
function update_track_camera($name, $fields) {
  $sets = array();
  $params = array(':name' => $name);
  foreach (array('enabled', 'skipback', 'showings', 'rate') as $field) {
    if (isset($fields[$field])) {
      $sets[] = $field.' = :'.$field;
      $params[':'.$field] = intval($fields[$field]);
    }
  }
  if (count($sets) > 0) {
    replay_sql('track-cameras-table',
               'UPDATE TrackCameras SET '.implode(', ', $sets).' WHERE name = :name', $params);
  }
}

function delete_track_camera($name) {
  replay_sql('track-cameras-table', 'DELETE FROM TrackCameras WHERE name = :name',
             array(':name' => $name));
}

// Moves a camera one place earlier ($delta = -1) or later (+1) in the order.
function move_track_camera($name, $delta) {
  $names = array_map(function($cam) { return $cam['name']; }, track_cameras());
  $i = array_search($name, $names);
  $j = $i === false ? false : $i + ($delta < 0 ? -1 : 1);
  if ($j === false || $j < 0 || $j >= count($names)) {
    return;
  }
  $names[$i] = $names[$j];
  $names[$j] = $name;
  foreach ($names as $k => $n) {
    replay_sql('track-cameras-table',
               'UPDATE TrackCameras SET sortorder = :sortorder WHERE name = :name',
               array(':sortorder' => $k + 1, ':name' => $n));
  }
}

// ---------------- Commands ----------------

function replay_tuning_args() {
  return read_raceinfo('replay-skipback', '4000')
      .' '.read_raceinfo('replay-num-showings', '2')
      .' '.read_raceinfo('replay-rate', '50');
}

// "TEST skipback showings rate  -- play a replay now, to try the settings"
function send_replay_TEST() {
  send_replay_message("TEST ".replay_tuning_args());
}

// "START video_name_root  -- a heat is staged"
function send_replay_START(&$current) {
  send_replay_message("START ".@$current['class']
                      .'_Round'.@$current['round']
                      .'_Heat'.sprintf("%02d", @$current['heat']));
}

// "REPLAY skipback showings rate  -- stop recording if recording; playback"
function send_replay_REPLAY() {
  send_replay_message("REPLAY ".replay_tuning_args());
}

// "CANCEL  -- cancel recording"
function send_replay_CANCEL() {
  send_replay_message("CANCEL");
}

// "RACE_STARTS skipback showings rate -- replay after skipback ms, unless a
// REPLAY comes first"
function send_replay_RACE_STARTS() {
  send_replay_message("RACE_STARTS ".replay_tuning_args());
}

?>
