<?php @session_start(); ?>
<?php
require_once('inc/data.inc');
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/banner.inc');
require_once('inc/plural.inc');

require_permission(CHECK_IN_RACERS_PERMISSION);

?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Fake Timer</title>
<?php require('inc/stylesheet.inc'); ?>
<link rel="stylesheet" type="text/css" href="css/mobile.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/mobile.js"></script>
<script type="text/javascript" src="js/fake-timer.js"></script>
<style type="text/css">
/* Fake Timer: an intro note, the simulated timer (lane count, the heat
   it's ready for, Start, a time and a Stop button per lane), and Auto Mode. */
.frontmatter p {
  margin: var(--space-1) 0;
}

.timer_card {
  text-align: center;
}
#lane-count-div {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-3);
}
#lane-count-div label {
  font-size: var(--text-base);
}
#lane-count {
  width: 4em;
  font-size: var(--text-lg);
  /* Weirdly, sans-serif makes the control widen considerably in Safari,
     much more than the text would require. */
}

/* "Ready for heat 4 of Fake Lions, round 1" */
p#summary {
  margin: var(--space-4) 0;
  font-size: var(--text-xl);
  text-align: center;
}
p#summary .heatno,
p#summary .round-class,
p#summary .roundno {
  font-weight: bold;
  font-size: inherit;
}

.timer_card #start-button {
  min-width: 200px;
}

/* A time and a Stop button per lane */
#timer-sim {
  margin: var(--space-4) auto 0 auto;
  border-collapse: collapse;
  background: transparent;
}
#timer-sim th {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
#timer-sim td {
  padding: var(--space-1) var(--space-2);
  border: 0;
}
#timer-sim-times {
  font-size: 40px;
  font-variant-numeric: tabular-nums;
}
#timer-sim-times td {
  border-bottom: 1px solid var(--gray-200);
}
.block_buttons #timer-sim input[type='button'] {
  width: 120px;
  min-height: 40px;
  font-size: var(--text-base);
  color: var(--color-brand);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}
.block_buttons #timer-sim input[type='button']:hover {
  border-color: var(--color-brand);
  background-color: var(--color-surface-sunken);
}

#auto-mode-div {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}
#auto-mode-outer-div p {
  margin: var(--space-2) 0 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
</head>
<body>
<?php make_banner('Fake Timer', false /* no back button */); ?>

<div class="page-content narrow fake_timer">

<div class='notice notice-info frontmatter'>
<p>This page acts like a timer connected to DerbyNet, so you can try racing
without a real one.  It works <b>only while this page is open</b>, and <b>only
while <a href="coordinator.php" target="_blank">Racing</a> or
<a href="timer.php" target="_blank">Simulated Racing</a> is on</b>.</p>
<p>We <b><i>strongly</i></b> encourage connecting and testing your real timer
before race day.</p>
</div>

<section class="card card-accent accent-during timer_card">
<div id='lane-count-div'>
  <label for="lane-count">Number of lanes on the track:</label>
  <input id="lane-count" type="number" class="not-mobile" min="2" max="8"
         value="<?php echo get_lane_count(); ?>"/>
</div>

<div class='block_buttons'>

<p id="summary">Not racing.</p>

<input id='start-button' type='button' value='Start' onclick='start_timer();' disabled='1'/>

<table id='timer-sim'>
  <tr id='timer-sim-headers'>
      <th>Lane 1</th>
      <th>Lane 2</th>
      <th>Lane 3</th>
      <th>Lane 4</th>
  </tr>

  <tr id='timer-sim-times' data-time='0'>
      <td data-running='1'/>
      <td data-running='1'/>
      <td data-running='1'/>
      <td data-running='1'/>
  </tr>

  <tr id='timer-sim-stop-buttons'>
      <td><input type='button' value='Stop' onclick='stop_timer(this);'/></td>
      <td><input type='button' value='Stop' onclick='stop_timer(this);'/></td>
      <td><input type='button' value='Stop' onclick='stop_timer(this);'/></td>
      <td><input type='button' value='Stop' onclick='stop_timer(this);'/></td>
  </tr>
</table>

</div>
</section>

<section id='auto-mode-outer-div' class="card card-accent accent-other">
  <div id='auto-mode-div'>
      <label for='auto-mode-checkbox'>Auto Mode</label>
      <input id='auto-mode-checkbox' type='checkbox' class='flipswitch'/>
  </div>
  <p>Auto mode acts like a very efficient race crew: it stages and starts
     each heat a few seconds after the server sets it ready.</p>
</section>

</div><!-- page-content -->

</body>
</html>
