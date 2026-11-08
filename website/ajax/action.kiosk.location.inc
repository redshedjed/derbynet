<?php
// Kiosk locations (the Kiosk Editor page): the places a display can be.
//
// $_POST['op']:
//   add    -- $_POST['name'], $_POST['note']
//   edit   -- $_POST['name'] (current), $_POST['new_name'], $_POST['note'];
//             renaming also renames it in every scene, and on any display
//             that has it as its name
//   delete -- $_POST['name']; also drops it from every scene, and any display
//             that has it as its name goes back to having none
//   order  -- $_POST['names'], comma-separated, in the new order
// Responds with the locations, as 'locations'.

require_once('inc/scenes.inc');

function location_index($locations, $name) {
  foreach ($locations as $i => $loc) {
    if (strtolower($loc['name']) == strtolower($name)) {
      return $i;
    }
  }
  return -1;
}

if (!have_permission(SET_UP_PERMISSION)) {
  json_not_authorized();
} else {
  $op = isset($_POST['op']) ? $_POST['op'] : '';
  $locations = kiosk_locations();
  $name = isset($_POST['name']) ? trim($_POST['name']) : '';
  $note = isset($_POST['note']) ? trim($_POST['note']) : '';
  $ok = true;

  if ($op == 'add') {
    if ($name == '') {
      json_failure('no-name', 'A location needs a name.');
      $ok = false;
    } else if (location_index($locations, $name) >= 0) {
      json_failure('duplicate', 'There\'s already a location named '.$name.'.');
      $ok = false;
    } else {
      $locations[] = array('name' => $name, 'note' => $note);
    }
  } else if ($op == 'edit') {
    $i = location_index($locations, $name);
    $new_name = isset($_POST['new_name']) ? trim($_POST['new_name']) : $name;
    if ($i < 0) {
      json_failure('no-such', 'No location named '.$name.'.');
      $ok = false;
    } else if ($new_name == '') {
      json_failure('no-name', 'A location needs a name.');
      $ok = false;
    } else if (strtolower($new_name) != strtolower($name) && location_index($locations, $new_name) >= 0) {
      json_failure('duplicate', 'There\'s already a location named '.$new_name.'.');
      $ok = false;
    } else {
      if ($new_name != $locations[$i]['name']) {
        $old = $locations[$i]['name'];
        $stmt = $db->prepare('UPDATE SceneKiosk SET kiosk_name = :new WHERE kiosk_name = :old');
        $stmt->execute(array(':new' => $new_name, ':old' => $old));
        $stmt = $db->prepare('UPDATE Kiosks SET name = :new WHERE name = :old');
        $stmt->execute(array(':new' => $new_name, ':old' => $old));
      }
      $locations[$i] = array('name' => $new_name, 'note' => $note);
    }
  } else if ($op == 'delete') {
    $i = location_index($locations, $name);
    if ($i < 0) {
      json_failure('no-such', 'No location named '.$name.'.');
      $ok = false;
    } else {
      $old = $locations[$i]['name'];
      $stmt = $db->prepare('DELETE FROM SceneKiosk WHERE kiosk_name = :name');
      $stmt->execute(array(':name' => $old));
      $stmt = $db->prepare('UPDATE Kiosks SET name = \'\' WHERE name = :name');
      $stmt->execute(array(':name' => $old));
      array_splice($locations, $i, 1);
    }
  } else if ($op == 'order') {
    $reordered = array();
    foreach (explode(',', isset($_POST['names']) ? $_POST['names'] : '') as $n) {
      $i = location_index($locations, $n);
      if ($i >= 0) {
        $reordered[] = $locations[$i];
        array_splice($locations, $i, 1);
      }
    }
    $locations = array_merge($reordered, $locations);  // any left out keep their places at the end
  } else {
    json_failure('unknown-op', 'Unrecognized operation.');
    $ok = false;
  }

  if ($ok) {
    write_kiosk_locations($locations);
    json_success();
  }
  json_out('locations', kiosk_locations());
}
?>
