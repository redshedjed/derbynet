<?php @session_start();
// The DerbyNet Quick Reference: where to find each task, for anyone logged in
// (the people running the event) -- not for visitors.  The full guides are in
// the repository's docs folder.
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/banner.inc');

if (!@$_SESSION['role']) {
  header('Location: login.php?next=quickref.php');
  exit(0);
}

// A task, and where to find it: $how is HTML, using <b> for page and button
// names
function task($what, $how) {
  echo '<dt>'.htmlspecialchars($what, ENT_QUOTES, 'UTF-8')."</dt>\n";
  echo '<dd>'.$how."</dd>\n";
}
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Quick Reference</title>
<?php require('inc/stylesheet.inc'); ?>
<style type="text/css">
.quickref .card-title {
  font-size: var(--text-xl);
}
.quickref dl {
  margin: var(--space-2) 0 0 0;
}
.quickref dt {
  font-weight: bold;
  margin-top: var(--space-3);
}
.quickref dd {
  margin: 2px 0 0 0;
}
.quickref .legend {
  color: var(--color-text-muted, inherit);
}
</style>
</head>
<body>
<?php make_banner('Quick Reference', 'index.php'); ?>
<div class="page-content narrow quickref">

<section class="card card-accent accent-ink">
<p class="legend"><b>Bold</b> names are pages and buttons. <b>Page</b> &#8594;
<b>Button</b> means: open the page from the home page, then click the button.
The full guides are in the docs folder of DerbyNet's source.</p>
</section>

<section class="card card-accent accent-before">
<h2 class="card-title">Before race day</h2>
<dl>
<?php
task('Work through the set-up', '<b>Set-Up</b>: the <b>Getting Ready for Race Day</b> list, top to bottom.');
task('Number of lanes; take a lane out of use',
     '<b>Set-Up</b> &#8594; <b>Settings</b> &#8594; Track and Timer. Click a lane to take it out of use.');
task('Load the racers', '<b>Set-Up</b> &#8594; <b>Import Roster</b> (a CSV spreadsheet). For practice: <b>Fake Roster</b>.');
task('Divide the field for racing', '<b>Set-Up</b> &#8594; <b>Racing Groups</b>. Subgroups and aggregates are set up there too.');
task('Plan the order of rounds', '<b>Set-Up</b> &#8594; <b>Rounds Playlist</b> (optional).');
task('Add awards', '<b>Set-Up</b> &#8594; <b>Import Awards</b>, or <b>Judging</b> &#8594; <b>Edit Awards</b>.');
task('Number of speed trophies', '<b>Set-Up</b> &#8594; <b>Settings</b> &#8594; Awards.');
task('Print check-in cards, car stickers, certificates', '<b>Printables</b>.');
task('Plan the screens', '<b>Set-Up</b> &#8594; <b>Kiosk Editor</b> (locations), then <b>Scene Editor</b> (what each location shows in each scene).');
task('Name the track cameras', '<b>Set-Up</b> &#8594; <b>Settings</b> &#8594; Cameras &#8594; <b>Add Camera</b>.');
task('Clear out practice data', '<b>Set-Up</b> &#8594; <b>Purge Data</b>, then choose what to delete.');
?>
</dl>
</section>

<section class="card card-accent accent-during">
<h2 class="card-title">Check-in</h2>
<dl>
<?php
task('Check in a racer', '<b>Race Check-In</b>: find the racer, flip <b>Checked In</b>. Or scan their check-in card.');
task('Choose what a barcode scan does', '<b>Race Check-In</b> &#8594; <b>Barcode Responses</b>.');
task('Check in from phones', '<b>Race Check-In</b> &#8594; <b>Mobile</b>: helpers scan the QR code. <b>New Code</b> shuts the old one out.');
task('Add a walk-up racer', '<b>Race Check-In</b> &#8594; <b>New Racer</b>.');
task('Change or delete a racer', '<b>Race Check-In</b>: click the racer, then edit, or <b>Delete Racer</b>.');
task('Check in or renumber a whole group', '<b>Race Check-In</b> &#8594; <b>Bulk</b>.');
task('Take a photo at check-in', '<b>Race Check-In</b>: click the racer or car photo spot &#8594; <b>Capture &amp; Check In</b> or <b>Capture Only</b>. Drag a file onto it to upload instead.');
task('Upload, crop or assign photos', '<b>Photos</b>: drop files on the upload area, drag a photo onto a racer, click a photo to crop or rotate.');
?>
</dl>
</section>

<section class="card card-accent accent-during">
<h2 class="card-title">Racing</h2>
<dl>
<?php
task('Start racing', '<b>Race Dashboard</b>: choose the round, switch <b>Racing</b> on. With a playlist: <b>Start Playlist</b>.');
task('Schedule a round', '<b>Race Dashboard</b>: click the round; its card says what\'s next.');
task('Check the timer', '<b>Race Dashboard</b> &#8594; timer panel &#8594; <b>Test</b> (Timer Testing page). Timer options are there too.');
task('Release the start gate (if the timer can)', '<b>Race Dashboard</b> &#8594; <b>Start Race</b>.');
task('Enter or fix a heat\'s results by hand', '<b>Race Dashboard</b> &#8594; <b>Manual Results</b>.');
task('Race without a timer', '<b>Settings</b>: turn off <b>Warn when timer not connected</b>; then <b>Manual Results</b> for each heat.');
task('Re-run a heat', '<b>Race Dashboard</b>: make it the current heat, then <b>Re-Run</b>.');
task('A late arrival, or a racer in the wrong group', 'Fix it on <b>Race Check-In</b>. On the <b>Race Dashboard</b>, the affected round turns orange and offers to adjust its schedule.');
task('Add a round, or finals', '<b>Race Dashboard</b> &#8594; <b>Add New Rounds</b> (or <b>Grand Finals</b>).');
task('Replays', '<b>Race Dashboard</b> &#8594; <b>Replay Settings</b>; <b>Trigger Replay</b> to try them.');
?>
</dl>
</section>

<section class="card card-accent accent-during">
<h2 class="card-title">Screens</h2>
<dl>
<?php
task('Name a screen, choose what it shows', '<b>Kiosk Dashboard</b>: <b>Assign</b> a name; choose its page.');
task('Switch every screen at once', 'Choose a scene with <b>Kiosk Scene</b>, in the banner at the top of the page.');
task('Show replays on a screen', '<b>Kiosk Editor</b>: tick <b>Show replays</b> for its location.');
task('Use a kiosk\'s camera as a track camera', '<b>Kiosk Dashboard</b> &#8594; <b>Assign</b>: make each of its cameras one of the track cameras.');
task('Make a kiosk a photo stand', '<b>Kiosk Dashboard</b>: give it the Photo Stand page and choose its options.');
task('Make this computer a kiosk', '<b>Kiosk Dashboard</b> &#8594; <b>Be a Kiosk</b>.');
?>
</dl>
</section>

<section class="card card-accent accent-after">
<h2 class="card-title">Awards and afterwards</h2>
<dl>
<?php
task('Standings', '<b>Standings</b>: by round, and overall.');
task('Give an award', '<b>Judging</b>: drag the award onto the racer, or the racer onto the award. Click a racer for an ad hoc award.');
task('Let the audience vote', '<b>Judging</b> &#8594; <b>Manage Ballot</b>: put awards on the ballot, open balloting. Voters use the <b>Vote!</b> tile.');
task('See the votes, choose a winner', '<b>Judging</b>: click an award\'s <b>Votes</b> marker &#8594; <b>Choose</b>.');
task('Present the awards', 'Give a screen the award presentation page (or the awards scene), then <b>Present Awards</b>.');
task('Save the results', '<b>Export Results</b> (a spreadsheet).');
task('Save a copy of the database', '<b>Set-Up</b> &#8594; <b>System Info</b>: save a snapshot. <b>Set-Up</b> &#8594; <b>Import Database</b> loads one.');
?>
</dl>
</section>

</div>
</body>
</html>
