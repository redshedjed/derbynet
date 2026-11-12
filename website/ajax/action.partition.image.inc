<?php
// Choose a den's (partition's) emblem.
//
// $_POST['partitionid']
// $_POST['image']: an emblem reference (inc/emblems.inc), or '' for the default
// $_FILES['upload']: instead of 'image', an image from outside DerbyNet; a copy
//    is saved in user_images and becomes the den's emblem.
//
// Responds with partition-images (inc/emblems.inc partition_images()) and the
// emblems to choose from.

// (Early exits return true: action.php takes a false return as "no such action".)

require_once('inc/emblems.inc');
require_once('inc/partitions.inc');

if (!have_permission(SET_UP_PERMISSION)) {
  json_not_authorized();
  return true;
}

$partitionid = isset($_POST['partitionid']) ? $_POST['partitionid'] : '';
if (read_single_value('SELECT COUNT(*) FROM Partitions WHERE partitionid = :partitionid',
                      array(':partitionid' => $partitionid)) == 0) {
  json_failure('no-partition', 'No such '.partition_label_lc());
  return true;
}

if (isset($_FILES['upload'])) {
  $ref = save_user_image($_FILES['upload']);
  if (is_array($ref)) {
    json_failure($ref[0], $ref[1]);
    return true;
  }
} else {
  $ref = isset($_POST['image']) ? $_POST['image'] : '';
  if ($ref !== '' && !is_valid_emblem_ref($ref)) {
    json_failure('no-image', 'No such image: '.$ref);
    return true;
  }
}

// Keep only the dens that still exist
$chosen = array();
$old = chosen_partition_images();
foreach ($db->query('SELECT partitionid FROM Partitions') as $row) {
  $id = $row['partitionid'];
  if (isset($old[$id])) {
    $chosen[$id] = $old[$id];
  }
}
if ($ref === '') {
  unset($chosen[$partitionid]);
} else {
  $chosen[$partitionid] = $ref;
}
write_chosen_partition_images($chosen);

json_out('partition-images', partition_images());
json_out('emblems', emblem_choices());
json_success();
?>
