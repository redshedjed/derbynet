<?php
// For Settings > Cameras: the track cameras, and every replay display and
// camera heard from in the last hour.
//
// cameras: [{name, sortorder, enabled, skipback, showings, rate, kiosk, device}]
// kiosks:  {address: name} for each kiosk a camera comes from
// clients: [{clientid, kind, name, status, last_contact, seconds, connected}]
// defaults: the Race Dashboard's replay settings, for "Default" choices

require_once('inc/replay.inc');
require_once('inc/kiosks.inc');

if (!have_permission(SET_UP_PERMISSION)) {
  json_not_authorized();
} else {
  $cameras = track_cameras();
  json_out('cameras', $cameras);
  $kiosks = array();
  foreach ($cameras as $cam) {
    if ($cam['kiosk'] !== '') {
      $kiosks[$cam['kiosk']] = kiosk_display_name($cam['kiosk']);
    }
  }
  json_out('kiosks', (object) $kiosks);
  json_out('clients', replay_clients());
  json_out('defaults', array('skipback' => intval(read_raceinfo('replay-skipback', '4000')),
                             'showings' => intval(read_raceinfo('replay-num-showings', '2')),
                             'rate' => intval(read_raceinfo('replay-rate', '50'))));
  json_success();
}
?>
