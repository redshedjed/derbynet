<?php @session_start(); ?>
<?php
require_once('inc/data.inc');
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/banner.inc');
require_once('inc/partitions.inc');
require_once('inc/plural.inc');

require_permission(CHECK_IN_RACERS_PERMISSION);

?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Build Fake Roster</title>
<?php require('inc/stylesheet.inc'); ?>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/mobile.js"></script>
<script type="text/javascript">
function make_the_fake_racers() {
  console.log('make_the_fake_racers');
  $.ajax("action.php",
         {type: 'POST',
          data: {action: 'racer.fake',
                 ngroups: Number($("#ngroups").val()),
                 racers_per_group: Number($("#racers_per_group").val()),
                 check_in: $("#check_in_all").is(':checked') ? 1 : 0},
          success: function(data) {
             console.log('success');
             // Jump to the check-in page
             window.location.href = "checkin.php";
          }
        });
  return false;
}

$(function() {
    $("#do_it").on('click', function() { make_the_fake_racers(); });
  });
</script>
<style type="text/css">
div input {
  font-size: 1em;
}
</style>
</head>
<body>
<?php make_banner('Build Fake Roster', 'setup.php'); ?>

<div class="page-content narrow">
<section class="card card-accent accent-before tile-buttons">
<h2 class="card-title">Make a fake roster</h2>
<p>A roster of made-up racers lets you try out DerbyNet without gathering
   your real racers first.  It's random, arranged by
   <?php echo htmlspecialchars(group_label_lc(), ENT_QUOTES, 'UTF-8'); ?> like a
   typical race, and includes racer and car pictures.</p>

<div class="form-row">
  <label for="ngroups">Make</label>
  <input id="ngroups" type="number" min="1" max="10" class="not-mobile" value="6"/>
  <span><?php echo htmlspecialchars(plural(group_label()), ENT_QUOTES, 'UTF-8'); ?>
    of about</span>
  <input id="racers_per_group" type="number" min="2" max="20" class="not-mobile" value="5"/>
  <label for="racers_per_group">racers each.</label>
</div>

<div class="form-row">
  <input id="check_in_all" type="checkbox" checked="checked"/>
  <label for="check_in_all">The fake racers have passed inspection</label>
</div>

<div class="block_buttons tile-grid">
  <input id="do_it" type="button" value="Make Fake Racers"/>
</div>

<p class="text-muted">To remove the fake racers later, use Purge on the
   <a href="setup.php">Set-Up page</a>.  Picture credits are on the
   <a href="about.php#image-credits">About page</a>.</p>
</section>
</div>

</body>
</html>
