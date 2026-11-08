<?php
// $_POST: (nothing)
// Makes a new Mobile Check-In key, so QR codes shown before stop working.

require_once('inc/mobile-checkin-key.inc');

if (have_permission(CHECK_IN_RACERS_PERMISSION)) {
  json_out('key', new_mobile_checkin_key());
  json_success();
} else {
  json_not_authorized();
}
?>
