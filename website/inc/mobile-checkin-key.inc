<?php
// The secret in the Mobile Check-In QR code (Race Check-In's phone button).
// Opening mcheckin.php?key=<this> lets that phone check racers in and take
// photos without logging in.  Made the first time it's asked for; making a
// new one stops old QR codes from working.

require_once('inc/data.inc');

function mobile_checkin_key() {
  $key = read_raceinfo('mobile-checkin-key', '');
  if ($key == '') {
    $key = new_mobile_checkin_key();
  }
  return $key;
}

function new_mobile_checkin_key() {
  // (Starts with letters, so it's never taken for a number)
  $key = 'mc'.bin2hex(random_bytes(16));
  write_raceinfo('mobile-checkin-key', $key);
  return $key;
}

function is_mobile_checkin_key($key) {
  $ours = read_raceinfo('mobile-checkin-key', '');
  return $ours != '' && is_string($key) && hash_equals($ours, $key);
}

// A phone let in by the QR code: it may check racers in, take photos, and
// undo a check-in, for as long as the key it scanned is still the current one
function grant_mobile_checkin($key) {
  $_SESSION['mobile-checkin-key'] = $key;
  $_SESSION['permissions'] |= CHECK_IN_RACERS_PERMISSION | REVERT_CHECK_IN_PERMISSION
                              | PHOTO_UPLOAD_PERMISSION;
}

// Once someone makes a new code, phones let in by the old one go back to
// what their role allows.  (Checked on each request; it only changes
// $_SESSION for good where the session is still open for writing.)
function drop_stale_mobile_checkin() {
  global $roles;
  if (isset($_SESSION['mobile-checkin-key'])
      && !is_mobile_checkin_key($_SESSION['mobile-checkin-key'])) {
    $role = isset($_SESSION['role']) ? $_SESSION['role'] : '';
    $_SESSION['permissions'] = isset($roles[$role]) ? $roles[$role]['permissions']
                                                    : $roles['']['permissions'];
    unset($_SESSION['mobile-checkin-key']);
  }
}
?>
