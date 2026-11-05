<?php

// $_POST['repo'] - Name of the repository ('head' or 'car')
// $_POST['image_name'] - Base filename of the image
// $_POST['left'], top, right, bottom, original_height, original_width - cropping parameters, all in pixels

if (!have_permission(ASSIGN_RACER_IMAGE_PERMISSION)) {
  json_not_authorized();
  return true;  // A falsy result would make action.php report "Unrecognized action"
}

require_once('inc/photo-config.inc');

$image_name = basename($_POST['image_name']);

$photo_repository = photo_repository(isset($_POST['repo']) ? $_POST['repo'] : 'head');

$original = $photo_repository->lookup(RENDER_ORIGINAL);
$cropped = $photo_repository->lookup(RENDER_CROPPED);

$source_file_path = $original->file_path($image_name);

list($source_width, $source_height, $image_type) = getimagesize($source_file_path);

$im = open_image($source_file_path, $image_type);

$target_file_path = $cropped->target_file_path($image_name);

$x = $_POST['left'] * $source_width / $_POST['original_width'];
$y = $_POST['top'] * $source_height / $_POST['original_height'];
$height = ($_POST['bottom'] - $_POST['top']) * $source_height / $_POST['original_height'];
$width = ($_POST['right'] - $_POST['left']) * $source_width / $_POST['original_width'];
$crop = imagecreatetruecolor($width, $height);
imagecopy($crop, $im, 0,0, $x, $y, $width, $height);

/* PHP 5.5 and up, only!
$crop = imagecrop($im, array('x' => $_POST['left'] * $source_width / $_POST['original_width'],
                             'y' => $_POST['top'] * $source_height / $_POST['original_height'],
                             'height' => ($_POST['bottom'] - $_POST['top']) 
                                 * $source_height / $_POST['original_height'],
                             'width' => ($_POST['right'] - $_POST['left']) 
                                 * $source_width / $_POST['original_width']));
                                 */
write_image($crop, $target_file_path, $image_type);
imagedestroy($crop);
imagedestroy($im);

$cropped->delete_dependents($image_name);

$sql = 'UPDATE RegistrationInfo'
    .' SET '.$photo_repository->column_name().' = :photo'
    .' WHERE '.$photo_repository->column_name().' = :original';
if (take_action_silently($sql,
                         array(':photo' => $target_file_path,
                               ':original' => $original->file_path($image_name)))) {
  json_success();
} else {
  json_sql_failure($sql);
}

json_out('cache-breaker', time());

?>