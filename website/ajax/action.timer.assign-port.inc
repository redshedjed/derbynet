<?php

// $_POST['port'], empty for no choice

if (!have_permission(CONTROL_RACE_PERMISSION)) {
  json_not_authorized();
  return true;  // A falsy result would make action.php report "Unrecognized action"
}

try {
  execute_once('UPDATE TimerSettings SET pending = :value'
               .' WHERE kind = :kind AND key = :key',
               array(':kind' => 'ports',
                     ':key' => 'ports',
                     ':value' => $_POST['port']));
} catch (PDOException $p) {
}

json_success();
?>
