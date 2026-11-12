<?php
// Replay displays and track cameras that have checked in recently, for the
// status shown on Settings and the Race Dashboard.  See inc/replay.inc.
return array(

"CREATE TABLE ReplayClients ("
."  clientid      VARCHAR(50),"
."  kind          VARCHAR(20),"   // 'display' or 'camera'
."  name          VARCHAR(100),"  // Camera name, or what the display calls itself
."  status        VARCHAR(250),"
."  last_contact  INTEGER"        // Unix timestamp
."  )",

);
?>
