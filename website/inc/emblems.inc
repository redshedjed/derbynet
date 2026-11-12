<?php
// Emblems: the images that mark a den (partition) or a range of car numbers,
// e.g. on car tags.
//
// An emblem is named by a reference:
//   "emblem3"            emblem3.* from the image set (normally Generic), or
//                        an override in an imagery folder (image_file_path)
//   "user/wolf-den.png"  a file in website/user_images: images chosen from
//                        outside the project are copied there.  The folder is
//                        not part of the project (.gitignore).
//
// Each den has an emblem: the one chosen in Racing Groups, else by default
// the image set's emblem0, emblem1, ... in den order.  The choices are in
// RaceInfo 'partition-images', JSON {partitionid: reference}.

require_once('inc/path-info.inc');

define('USER_IMAGE_EXTENSIONS', 'png,jpg,jpeg,gif');

function user_images_dir() {
  return dirname(__FILE__, 2).DIRECTORY_SEPARATOR.'user_images';
}

// File names in user_images that can be emblems, sorted
function user_image_files() {
  $files = array();
  $dir = user_images_dir();
  if (is_dir($dir)) {
    $allowed = explode(',', USER_IMAGE_EXTENSIONS);
    foreach (scandir($dir) as $f) {
      if ($f[0] == '.' || !is_file($dir.DIRECTORY_SEPARATOR.$f)) continue;
      if (in_array(strtolower(pathinfo($f, PATHINFO_EXTENSION)), $allowed)) {
        $files[] = $f;
      }
    }
  }
  natcasesort($files);
  return array_values($files);
}

// The image set's numbered emblems: emblem0, emblem1, ...
function set_emblem_stems() {
  static $stems = false;
  if ($stems === false) {
    $stems = array();
    for ($i = 0; file_exists(image_file_path("emblem{$i}")); ++$i) {
      $stems[] = "emblem{$i}";
    }
  }
  return $stems;
}

// Every emblem to choose from: the image set's, then the user images.  An
// emblem's index in this list is how the car tags options name it.
function all_emblem_image_stems() {
  $refs = set_emblem_stems();
  foreach (user_image_files() as $f) {
    $refs[] = 'user/'.$f;
  }
  return $refs;
}

function is_user_image_ref($ref) {
  return substr($ref, 0, 5) == 'user/';
}

function is_valid_emblem_ref($ref) {
  return is_string($ref) && in_array($ref, all_emblem_image_stems(), true);
}

// The file for an emblem reference, or false
function emblem_ref_path($ref) {
  if (!is_string($ref) || $ref === '') return false;
  if (is_user_image_ref($ref)) {
    $name = substr($ref, 5);
    if (basename($name) !== $name || $name[0] == '.') return false;
    $path = user_images_dir().DIRECTORY_SEPARATOR.$name;
    return is_file($path) ? $path : false;
  }
  if (!preg_match('/^emblem[0-9]*$/', $ref)) return false;
  return image_file_path($ref);
}

// The URL (relative to the website) for an emblem reference
function emblem_ref_url($ref) {
  if (is_user_image_ref($ref)) {
    return 'user_images/'.rawurlencode(substr($ref, 5));
  }
  return 'image.php/'.$ref;
}

// A short label for an emblem reference
function emblem_ref_label($ref) {
  if (is_user_image_ref($ref)) {
    return pathinfo(substr($ref, 5), PATHINFO_FILENAME);
  }
  if (preg_match('/^emblem([0-9]+)$/', $ref, $m)) {
    return 'Emblem '.$m[1];
  }
  return $ref;
}

// $i is a zero-based index into all_emblem_image_stems()
function path_to_emblem_image($i) {
  $refs = all_emblem_image_stems();
  return isset($refs[$i]) ? emblem_ref_path($refs[$i]) : false;
}

// The emblems to choose from, for a picker: array of {image, url, label, user}
function emblem_choices() {
  $choices = array();
  foreach (all_emblem_image_stems() as $ref) {
    $choices[] = array('image' => $ref,
                       'url' => emblem_ref_url($ref),
                       'label' => emblem_ref_label($ref),
                       'user' => is_user_image_ref($ref));
  }
  return $choices;
}

// The emblems chosen for dens: partitionid => reference
function chosen_partition_images() {
  $chosen = json_decode(read_raceinfo('partition-images', '{}'), true);
  return is_array($chosen) ? $chosen : array();
}

function write_chosen_partition_images($chosen) {
  write_raceinfo('partition-images', json_encode((object) $chosen));
}

// Each den's emblem, in den order: array of {partitionid, name, image, url,
// label, default}.  A den with no choice (or whose chosen image is gone) gets
// the image set's emblem for its place in the order.
function partition_images() {
  global $db;
  $chosen = chosen_partition_images();
  $set_stems = set_emblem_stems();
  $result = array();
  $i = 0;
  foreach ($db->query('SELECT partitionid, name FROM Partitions ORDER BY sortorder') as $row) {
    $id = $row['partitionid'];
    $ref = isset($chosen[$id]) ? $chosen[$id] : null;
    $is_default = $ref === null || emblem_ref_path($ref) === false;
    if ($is_default) {
      $ref = count($set_stems) > 0 ? $set_stems[$i % count($set_stems)] : null;
    }
    $result[] = array('partitionid' => $id,
                      'name' => $row['name'],
                      'image' => $ref,
                      'url' => $ref === null ? null : emblem_ref_url($ref),
                      'label' => $ref === null ? '' : emblem_ref_label($ref),
                      'default' => $is_default);
    ++$i;
  }
  return $result;
}

// Saves an uploaded image ($_FILES entry) in user_images.  Returns the new
// reference, or array(code, message) on failure.  The file name is kept
// (made safe); a different image of the same name gets a numbered name, and
// the same image again reuses the existing file.
function save_user_image($upload) {
  if (!isset($upload['error']) || $upload['error'] != UPLOAD_ERR_OK) {
    return array('upload', 'The upload failed.');
  }
  $info = @getimagesize($upload['tmp_name']);
  $types = array(IMAGETYPE_PNG => 'png', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_GIF => 'gif');
  if ($info === false || !isset($types[$info[2]])) {
    return array('image-type', 'Choose a PNG, JPEG or GIF image.');
  }
  $ext = $types[$info[2]];

  $dir = user_images_dir();
  if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
    return array('no-folder', 'Can\'t create the folder '.$dir);
  }

  $stem = pathinfo(basename($upload['name']), PATHINFO_FILENAME);
  $stem = trim(preg_replace('/[^-a-zA-Z0-9_]+/', '-', $stem), '-');
  if ($stem === '') $stem = 'image';
  $stem = substr($stem, 0, 60);

  $hash = md5_file($upload['tmp_name']);
  for ($n = 1; ; ++$n) {
    $name = $stem.($n == 1 ? '' : '-'.$n).'.'.$ext;
    $path = $dir.DIRECTORY_SEPARATOR.$name;
    if (!file_exists($path)) break;
    if (md5_file($path) === $hash) {
      return 'user/'.$name;
    }
  }
  if (!@move_uploaded_file($upload['tmp_name'], $path)) {
    return array('cant-write', 'Can\'t save the image in '.$dir);
  }
  return 'user/'.$name;
}
?>
