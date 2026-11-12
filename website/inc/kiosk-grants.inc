<?php
// Permissions that come with a kiosk's assignment.  Kiosks don't log in, but
// a photo stand has to upload photos and check racers in.  When the Kiosk
// Dashboard (or a scene) gives a kiosk the Photo Stand page, kiosk.php grants
// that browser's session what the page needs; once the kiosk is given some
// other page, the next request takes it away again.  (The same idea as the
// Mobile Check-In QR code; see inc/mobile-checkin-key.inc.)
//
// Only an admin can assign pages, so only an admin decides which devices may
// do this.  A device could pretend to be a photo stand's kiosk if it knew the
// stand's address; on a private event network, that's an accepted risk.

require_once('inc/data.inc');
require_once('inc/permissions.inc');

// Kiosk page (file name) => what a kiosk showing it may do
function kiosk_page_grants() {
  return array('photo-stand.kiosk' => PHOTO_UPLOAD_PERMISSION | CHECK_IN_RACERS_PERMISSION);
}

// The file name of a kiosk's page, as stored in the Kiosks table:
// "kiosks/photo-stand.kiosk#{...}" (maybe with a leading "!", and a
// backslash on Windows) => "photo-stand.kiosk"
function kiosk_page_file($page) {
  $page = ltrim(explode('#', $page, 2)[0], '!');
  $page = str_replace('\\', '/', $page);
  return basename($page);
}

// Called by kiosk.php, with the session open, for the page it's about to show.
function grant_kiosk_page_permissions($address, $page) {
  $grants = kiosk_page_grants();
  $file = kiosk_page_file($page);
  if (!isset($grants[$file])) {
    return;
  }
  $have = isset($_SESSION['permissions']) ? $_SESSION['permissions'] : 0;
  // Only what the session didn't already have, so taking it back later
  // leaves a logged-in role's permissions alone.
  $bits = $grants[$file] & ~$have;
  if (isset($_SESSION['kiosk-grant'])) {
    $bits |= $_SESSION['kiosk-grant']['bits'];
  }
  $_SESSION['kiosk-grant'] = array('address' => $address, 'page' => $file, 'bits' => $bits);
  $_SESSION['permissions'] = $have | $bits;
}

// Called on each request (action.php): a kiosk no longer showing the page it
// was granted for goes back to what it had.
function drop_stale_kiosk_grant() {
  global $db;
  if (!isset($_SESSION['kiosk-grant'])) {
    return;
  }
  $grant = $_SESSION['kiosk-grant'];
  $page = false;
  try {
    $stmt = $db->prepare('SELECT page FROM Kiosks WHERE address = :address');
    $stmt->execute(array(':address' => $grant['address']));
    $page = $stmt->fetchColumn();
    $stmt->closeCursor();
  } catch (PDOException $p) {
  }
  if ($page === false || kiosk_page_file($page) != $grant['page']) {
    $_SESSION['permissions'] &= ~$grant['bits'];
    unset($_SESSION['kiosk-grant']);
  }
}
?>
