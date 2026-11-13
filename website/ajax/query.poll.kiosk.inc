<?php
require_once('inc/data.inc');
require_once('inc/kiosks.inc');
require_once('inc/scenes.inc');

maybe_apply_playlist_scene();

if (isset($_GET['address'])) {
  $kiosk_page = kiosk_page($_GET['address']);
  // The names of the kiosk's cameras (js/kiosk-poller.js), for assigning them
  // track cameras on the Kiosk Dashboard
  if (isset($_GET['devices']) && is_array(json_decode($_GET['devices'], true))) {
    require_once('inc/replay.inc');
    replay_client_checkin('kiosk-'.$_GET['address'].'-devices', 'kiosk', '', '', $_GET['devices']);
  }
}

json_out('kiosk-setting', $kiosk_page);

?>
