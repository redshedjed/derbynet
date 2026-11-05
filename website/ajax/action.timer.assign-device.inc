<?php

// $_POST['device'], empty for no choice

if (!have_permission(CONTROL_RACE_PERMISSION)) {
  json_not_authorized();
  return true;  // A falsy result would make action.php report "Unrecognized action"
}

try {
  execute_once('INSERT INTO TimerSettings(kind, pending)'
               .' VALUES(:kind, :value)',
               array(':kind' => 'pending-device',
                     ':value' => $_POST['device']));
} catch (PDOException $p) {
}

json_success();
?>
