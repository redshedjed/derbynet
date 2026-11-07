<?php

// Set "current" award being presented

// $_POST['key'] is one of:
// award-<awardid>
// speed-<place>
// speed-<place>-<den>
// speed-<place>-<den>-<rank>

// If present, $_POST['reveal'] is 0 or 1

require_once('inc/photo-config.inc');
require_once('inc/standings.inc');
require_once('inc/ordinals.inc');

// The award presentation kiosk clears the current award when it starts up
// (key '', reveal 0).  Kiosks don't log in, so that one request is allowed
// without permission; choosing or revealing an award still needs it.
$clear_only = isset($_POST['key']) && $_POST['key'] === ''
    && (!isset($_POST['reveal']) || !$_POST['reveal']);

if (have_permission(PRESENT_AWARDS_PERMISSION) || $clear_only) {
  $successful = false;
  if (isset($_POST['key'])) {
    $key = $_POST['key'];
    write_raceinfo('current_award_key', $key);
    $successful = true;
  }
  if (isset($_POST['reveal'])) {
    write_raceinfo('reveal_current_award', $_POST['reveal'] ? 1 : 0);
    $successful = true;
  }
  if ($successful) {
    json_success();
  }
} else {
  json_not_authorized();
}
?>
