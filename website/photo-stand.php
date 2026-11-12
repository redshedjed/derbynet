<?php @session_start();
// Photo Stand: a camera and a barcode scanner at a table, taking racer or car
// photos.  Scan a racer's barcode and the photo is taken and uploaded (and
// the racer checked in, if chosen); or take the photo with the Space bar
// first, then scan to say whose it is.  See js/photo-stand.js.
//
// This is the logged-in version, set up on the page itself.  A kiosk can be a
// photo stand too (kiosks/photo-stand.kiosk), set up from the Kiosk
// Dashboard, with no login.
//
// The barcode scanner types like a keyboard, ending each barcode with Enter.
require_once('inc/data.inc');
require_once('inc/authorize.inc');
require_once('inc/banner.inc');

// The Photo role (the photo station) only shows on the login page with ?all
if (!have_permission(PHOTO_UPLOAD_PERMISSION)) {
  header('Location: login.php?all&next=photo-stand.php');
  exit(0);
}
session_write_close();

$g_stand_kiosk = null;
require('inc/photo-stand-page.inc');
?>
