<?php

// A role's password in config-roles.inc may be plain text, or a hash from PHP's
// password_hash() function.
function role_password_matches($supplied, $stored) {
  $info = password_get_info($stored);
  if (!empty($info['algo'])) {
    return password_verify($supplied, $stored);
  }
  return hash_equals($stored, $supplied);
}

if (isset($_POST['name'])) {
  $name = $_POST['name'];
  $password = isset($_POST['password']) ? $_POST['password'] : '';
  // Don't want the password parroted back in the response.
  $_POST['password'] = '...';
 } else {
  $name = '';
  $password = '';
}

// Array-valued parameters (e.g., name[]=x) can't match a role or a password.
if (!is_string($name)) {
  $name = '';
  $password = false;
}

$role = isset($roles[$name]) ? $roles[$name] : false;

if ($role) {
  if (is_string($password) &&
      role_password_matches($password, (string) $role['password'])) {
    $_SESSION['permissions'] = $role['permissions'];
    if (empty($name) && isset($_SESSION['setting_up'])) {
      unset($_SESSION['setting_up']);
    }

    // Some clients are scripts running from RPi's or similar devices that may
    // not have an accurate clock.  The timecheck element allows the device to
    // be set reasonably close to the date.
    json_out('timecheck', date(DATE_ISO8601));

    if ($password) {
      $_SESSION['role'] = $name;
      json_out('role', $_SESSION['role']);
      json_success();
	} else {
      // Despite the unset, it appears $_SESSION['role'] will appear
      // as an empty string in subsequent accesses.
      unset($_SESSION['role']);
      json_success();
	}
  } else {
    json_failure('login', "Incorrect password");
  }
} else {
  json_failure('role', "No such role: $name");
}
?>
