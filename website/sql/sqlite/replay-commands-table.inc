<?php
// Replay commands (START, RACE_STARTS, REPLAY, CANCEL, TEST), in order.  Each
// replay display reads the ones after the last seq it saw, so every display
// gets every command.  Rows are kept about a minute.  See inc/replay.inc.
return array(

"CREATE TABLE ReplayCommands ("
."  seq      INTEGER PRIMARY KEY,"
."  posted   INTEGER,"  // Unix timestamp
."  command  VARCHAR(250)"
."  )",

);
?>
