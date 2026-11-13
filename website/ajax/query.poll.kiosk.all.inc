<?php
require_once('inc/kiosks.inc');
require_once('inc/replay.inc');

json_out('current-scene', read_raceinfo('current_scene', ''));

json_out('kiosks', all_kiosks());
// The track cameras (Settings > Cameras), to assign to a kiosk's cameras
json_out('track-cameras', array_map(function($cam) { return $cam['name']; }, track_cameras()));
json_out('kiosk-pages', all_kiosk_pages());
?>
