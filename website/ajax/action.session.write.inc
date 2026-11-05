<?php

// $_POST['session_<key>'] = <value>
//
// This action is available to anonymous users, and permissions are stored in
// the session, so a client may only write the keys and values listed here.
$writable_session_keys = array(
  'barcode-action' => array('locate', 'checkin', 'racer-photo', 'car-photo'),
);

$written = array();
$rejected = false;
foreach ($_POST as $key => $val) {
  if (substr($key, 0, strlen("session_")) == "session_") {
    $session_key = substr($key, strlen("session_"));
    if (isset($writable_session_keys[$session_key]) &&
        in_array($val, $writable_session_keys[$session_key], true)) {
      $_SESSION[$session_key] = $val;
      $written[$session_key] = $val;
    } else {
      $rejected = true;
    }
  }
}

json_out('session', $written);

if ($rejected) {
  json_not_authorized();
} else {
  json_success();
}

?>
