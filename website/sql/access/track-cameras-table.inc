<?php
// Named track cameras, in the order replays show them.  A 0 for skipback,
// showings or rate means "use the Race Dashboard's replay setting".  See
// inc/replay.inc.
return array(

"CREATE TABLE TrackCameras ("
."  name       VARCHAR(50),"
."  sortorder  INTEGER,"
."  enabled    INTEGER,"
."  skipback   INTEGER,"  // ms
."  showings   INTEGER,"
."  rate       INTEGER"   // percent of normal speed
."  )",

);
?>
