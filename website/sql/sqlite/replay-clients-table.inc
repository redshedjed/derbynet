<?php
// Stations -- replay displays, track cameras and photo stands -- that have
// checked in recently, for the status shown on Settings, the Race Dashboard and
// the Kiosk Dashboard.  A station run as a kiosk checks in as kiosk-<address>
// (its own webcam, as kiosk-<address>-camera).  See inc/replay.inc.
return array(

"CREATE TABLE ReplayClients ("
."  clientid      VARCHAR(100),"
."  kind          VARCHAR(20),"   // 'display', 'camera' or 'stand' (photo stand)
."  name          VARCHAR(100),"  // Camera name, or what a display or stand calls itself
."  status        VARCHAR(250),"
."  last_contact  INTEGER,"       // Unix timestamp
."  devices       VARCHAR(1000)"  // JSON list of its camera names, for choosing one remotely
."  )",

);
?>
