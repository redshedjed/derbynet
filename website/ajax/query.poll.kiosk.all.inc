<?php
require_once('inc/kiosks.inc');

json_out('current-scene', read_raceinfo('current_scene', ''));

json_out('kiosks', all_kiosks());
json_out('kiosk-pages', all_kiosk_pages());
?>
