<?php

// Images used by the print documents live together in print/img, rather than
// in the documents' own directories.
function print_image_path($filename) {
  return dirname(dirname(__FILE__)) . DIRECTORY_SEPARATOR . 'img'
      . DIRECTORY_SEPARATOR . $filename;
}

function load_document_files_from($dir) {
  if (is_dir($dir)) {
    if ($dh = opendir($dir)) {
      while (($subdir = readdir($dh)) !== false) {
        if ($subdir !== "." && $subdir !== ".." && is_dir($dir . DIRECTORY_SEPARATOR . $subdir)) {
          require_once( $dir . DIRECTORY_SEPARATOR . $subdir . DIRECTORY_SEPARATOR . "document.inc" );
        }
      }
      closedir($dh);
    }
  }
}

?>
