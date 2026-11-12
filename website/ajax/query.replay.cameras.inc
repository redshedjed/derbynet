<?php
// The track cameras, in replay order: for choosing one on the Kiosk Dashboard
// and Scene Editor (the Live Camera kiosk page).
//
// cameras: [{name, enabled}]

require_once('inc/replay.inc');

json_out('cameras', array_map(function($cam) {
                                return array('name' => $cam['name'], 'enabled' => $cam['enabled']);
                              }, track_cameras()));
json_success();
?>
