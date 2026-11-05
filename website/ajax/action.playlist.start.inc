<?php

if (!have_permission(CONTROL_RACE_PERMISSION)) {
  json_not_authorized();
  return true;  // A falsy result would make action.php report "Unrecognized action"
}

require_once('inc/playlist.inc');
require_once('inc/racing-state.inc');

activate_playlist_entry(first_playlist_entry());
set_racing_state(1);

json_success();

?>