<?php
// Changes the track cameras (Settings > Cameras).
//
// $_POST['name']  the camera
// $_POST['op']    'add', 'update', 'delete', 'up' or 'down'
// For 'update', any of:
//   $_POST['enabled']   0/1
//   $_POST['skipback']  replay length in ms (0 = the Race Dashboard's)
//   $_POST['showings']  times to show it (0 = the Race Dashboard's)
//   $_POST['rate']      percent of normal speed (0 = the Race Dashboard's)

require_once('inc/replay.inc');

if (!have_permission(SET_UP_PERMISSION)) {
  json_not_authorized();
} else {
  $name = isset($_POST['name']) ? substr(trim($_POST['name']), 0, 50) : '';
  $op = isset($_POST['op']) ? $_POST['op'] : '';
  if ($name === '') {
    json_failure('no-name', 'No camera name given.');
  } else if ($op == 'add') {
    if (add_track_camera($name)) {
      json_success();
    } else {
      json_failure('exists', 'There is already a camera called '.$name.'.');
    }
  } else if ($op == 'update') {
    update_track_camera($name, $_POST);
    json_success();
  } else if ($op == 'delete') {
    delete_track_camera($name);
    json_success();
  } else if ($op == 'up' || $op == 'down') {
    move_track_camera($name, $op == 'up' ? -1 : 1);
    json_success();
  } else {
    json_failure('bad-op', 'Unrecognized op: '.$op);
  }
  json_out('cameras', track_cameras());
}
?>
