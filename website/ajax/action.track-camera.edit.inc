<?php
// Changes the track cameras: Settings > Cameras sets them up; the Kiosk
// Dashboard says where each comes from.
//
// $_POST['name']  the camera
// $_POST['op']    'add', 'rename', 'update', 'delete', 'up', 'down' or 'assign'
// For 'rename':   $_POST['new_name']
// For 'update', any of:
//   $_POST['enabled']   0/1
//   $_POST['skipback']  replay length in ms (0 = the Race Dashboard's)
//   $_POST['showings']  times to show it (0 = the Race Dashboard's)
//   $_POST['rate']      percent of normal speed (0 = the Race Dashboard's)
// For 'assign' (the Kiosk Dashboard, when a kiosk is signed in):
//   $_POST['kiosk']     the kiosk's address ('' for no source)
//   $_POST['device']    which of the kiosk's cameras, by its name
//
// Setting cameras up is for the Administrator; assigning them to a kiosk's
// cameras is also for whoever runs the Kiosk Dashboard.

require_once('inc/replay.inc');

$op = isset($_POST['op']) ? $_POST['op'] : '';
if (!have_permission($op == 'assign' ? (SET_UP_PERMISSION | CONTROL_RACE_PERMISSION)
                                     : SET_UP_PERMISSION)) {
  json_not_authorized();
} else {
  $name = isset($_POST['name']) ? substr(trim($_POST['name']), 0, 50) : '';
  if ($name === '') {
    json_failure('no-name', 'No camera name given.');
  } else if ($op != 'add' && !track_camera_exists($name)) {
    json_failure('no-camera', 'There is no camera called '.$name.'.');
  } else if ($op == 'add') {
    if (add_track_camera($name)) {
      json_success();
    } else {
      json_failure('exists', 'There is already a camera called '.$name.'.');
    }
  } else if ($op == 'rename') {
    $new_name = isset($_POST['new_name']) ? substr(trim($_POST['new_name']), 0, 50) : '';
    if (rename_track_camera($name, $new_name)) {
      json_success();
    } else {
      json_failure('bad-name', $new_name === '' ? 'No new name given.'
                   : 'There is already a camera called '.$new_name.'.');
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
  } else if ($op == 'assign') {
    $kiosk = isset($_POST['kiosk']) ? substr(trim($_POST['kiosk']), 0, 100) : '';
    $device = isset($_POST['device']) ? substr(trim($_POST['device']), 0, 250) : '';
    set_camera_source($name, $kiosk, $device);
    json_success();
  } else {
    json_failure('bad-op', 'Unrecognized op: '.$op);
  }
  json_out('cameras', track_cameras());
}
?>
