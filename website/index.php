<?php @session_start();
////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// If you're seeing this page, your web server isn't configured correctly.  (PHP is not enabled.)
//
////////////////////////////////////////////////////////////////////////////////////////////////////////

// Redirects to setup page if the database hasn't yet been set up
require_once('inc/data.inc');
require_once('inc/schema_version.inc');
require_once('inc/banner.inc');
require_once('inc/authorize.inc');
require_once('inc/race-day-guide.inc');

// This first database access is surrounded by a try/catch in order to catch
// broken/corrupt databases (e.g., sqlite pointing to a file that's not actually
// a database).  The pdo may get created OK, but then fail on the first attempt
// to access.
try {
  $schema_version = schema_version();
} catch (PDOException $p) {
  $_SESSION['setting_up'] = 1;
  header('Location: setup.php');
  exit();
}
session_write_close();
// Someone not logged in gets the visitor's menu -- except a phone let in by
// the Mobile Check-In QR code (inc/mobile-checkin-key.inc), which keeps its
// Race Check-In button.
if ($_SESSION['role'] == '' && !isset($_SESSION['mobile-checkin-key'])) {
  $_SESSION['permissions'] = $roles['']['permissions'];
}

$show_voting_button =
  $schema_version >= BALLOTING_SCHEMA &&
  read_single_value('SELECT COUNT(*) FROM BallotAwards') > 0;

// Returns true if we actually showed a button
function make_link_button($label, $link, $permission, $button_class) {
  if (have_permission($permission)) {
    echo "<a class='button_link ".$button_class."' href='".$link."'>".$label."</a>\n";
    return true;
  } else {
    return false;
  }
}

// The menu is in groups (before, during and after the race, then the
// rest): tiles in a group sit close together, with more space between
// groups.  A group with no buttons for this user isn't shown at all.
function begin_tile_group() {
  ob_start();
}
function end_tile_group() {
  $tiles = ob_get_clean();
  if (trim($tiles) !== '') {
    echo "<div class='tile_group'>\n".$tiles."</div>\n";
  }
}

?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Pinewood Derby Race Information</title>
<?php require('inc/stylesheet.inc'); ?>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/modal.js"></script>
<style type="text/css">
/* A group of tiles (before, during, after the race, the rest): tiles close
   together, groups apart.  The two spacings are set here once; everything
   that separates groups below (Vote!, the stacked columns, the bottom of the
   page) uses --tile-group-gap. */
div.index_background {
  --tile-gap: 10px;
  --tile-group-gap: 44px;  /* the space the tiles used to have */
}
div.tile_group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--tile-gap);
}
div.tile_group + div.tile_group {
  margin-top: var(--tile-group-gap);
}
div.tile_group a.button_link {
  margin-top: 0;
  margin-bottom: 0;
}

div.index_background {
  width: 100%;
}

div.index_column {
  width: 50%;
  display: inline-block;
  float: left;
}

/* On a phone, one column of buttons rather than two side by side */
@media (max-width: 640px) {
  div.index_column {
    width: 100%;
    display: block;
    float: none;
  }
  /* The second column (After, Other) starts a new group under the first */
  div.index_column + div.index_column {
    margin-top: var(--tile-group-gap);
  }
}

div.index_background {
  padding-top: var(--space-5);
  /* Room below the last button (Log in / Log out), the same as between
     groups.  flow-root makes it hold the floated columns of the two-column
     menu, so the padding comes after them. */
  padding-bottom: var(--tile-group-gap);
  display: flow-root;
}

/* Who's logged in, under Log out */
p.logged_in_as {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* Home menu tiles: the tile look and the colors (tile_blue, ...)
   are shared, in global.css under "Tile buttons". */
.block_buttons a.button_link {
  width: 238px;
  height: 30px;
}

/* Vote!: a gold tile twice as tall as the others, with large centered
   text, the same space above the menu as between its groups */
.vote_feature {
  margin: 0 auto var(--tile-group-gap) auto;
  max-width: 320px;
}
.tile-buttons .vote_feature.block_buttons a.button_link.vote_button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: auto;
  min-height: 86px;   /* with padding and border: twice a 53px tile */
  margin: 0 auto;
  /* Same side padding as the other tiles (16px left from the tile style,
     15px right from the base button), so it's the same width */
  padding-left: var(--space-4);
  padding-right: 15px;
  font-size: 2.25rem;
  font-weight: var(--weight-bold, 700);
  letter-spacing: 0.02em;
  text-align: center;
}
/* Race Day steps (inc/race-day-guide.inc): a row of steps above the menu;
   done ones checked, the next one highlighted.  A column on a phone. */
nav.race_day_guide {
  max-width: 1000px;
  margin: 0 auto var(--tile-group-gap) auto;
  padding: var(--space-2);
  box-sizing: border-box;
}
nav.race_day_guide ol {
  display: flex;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
nav.race_day_guide li {
  flex: 1 1 0;
  min-width: 0;
}
nav.race_day_guide li > a,
nav.race_day_guide li > div {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text);
  text-decoration: none;
}
nav.race_day_guide li > a:hover {
  background: var(--color-surface-sunken);
}
nav.race_day_guide .step_mark {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gray-200);
  color: var(--color-text-muted);
  font-weight: var(--weight-bold, 700);
  line-height: 28px;
  text-align: center;
}
nav.race_day_guide .step_text {
  min-width: 0;
}
nav.race_day_guide .step_title {
  display: block;
  font-weight: var(--weight-semibold);
}
nav.race_day_guide .step_status {
  display: block;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
nav.race_day_guide li.done .step_mark {
  background: var(--color-success-bg);
  color: var(--color-success);
}
nav.race_day_guide li.next > a,
nav.race_day_guide li.next > div {
  border-color: var(--color-brand);
  background: color-mix(in srgb, var(--color-brand) 7%, var(--color-surface));
}
nav.race_day_guide li.next .step_mark {
  background: var(--color-brand);
  color: var(--color-text-on-brand);
}
@media (max-width: 640px) {
  nav.race_day_guide {
    margin-left: var(--space-3);
    margin-right: var(--space-3);
  }
  nav.race_day_guide ol {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
</head>
<body>
<?php
  // The home page title is a setting (Settings > Home and About Pages)
  make_banner(read_raceinfo('home-banner-title', 'DerbyNet'), /* back_button */ false);

 $need_spacer = false;

 // This is a heuristic more than a hard rule -- when are there so many buttons that we need a second column?
 $two_columns = have_permission(SET_UP_PERMISSION | CONTROL_RACE_PERMISSION);

echo "<div class='index_background tile-buttons'>\n";

// For those who set up or run the race: the day's steps, and which is next
race_day_guide();

// When there's a ballot, Vote! leads the menu for visitors: a big tile on its
// own above the other buttons.  (The people running or setting up the race
// don't see it.)
if ($show_voting_button && !have_permission(SET_UP_PERMISSION | CONTROL_RACE_PERMISSION)
    && have_permission(VIEW_RACE_RESULTS_PERMISSION)) {
  echo "<div class='vote_feature block_buttons'>\n";
  echo "<a class='button_link tile_gold vote_button' href='vote.php'>Vote!</a>\n";
  echo "</div>\n";
}

// The menu, in color groups:
//   blue:   the crew's jobs -- check-in, photos, printables, judging
//   silver: following the race -- schedule, results, standings
//   red:    running the race (the dashboards)
//   gold:   the back end -- set-up, export, retrospective
//   black:  about, and logging in or out
// With two columns (for those who run the race), blue and silver are on the
// left and the rest on the right.
if ($two_columns) {
  echo "<div class='index_column'>\n";
}

echo "<div class='block_buttons'>\n";

// *********** Blue ***************
begin_tile_group();
// On a phone, Race Check-In goes on to Mobile Check-In (see checkin.php)
make_link_button('Race Check-In', 'checkin.php', CHECK_IN_RACERS_PERMISSION, 'tile_blue');
// Racer and car photos are one page, with a Racer / Car switch
make_link_button('Photos', 'photo-thumbs.php', ASSIGN_RACER_IMAGE_PERMISSION, 'tile_blue');
make_link_button('Printables', 'print.php', ASSIGN_RACER_IMAGE_PERMISSION, 'tile_blue');
make_link_button('Judging', 'judging.php', JUDGING_PERMISSION, 'tile_blue');
end_tile_group();

// *********** Silver ***************
begin_tile_group();
make_link_button('Race Schedule', 'ondeck.php', -1, 'tile_silver');
make_link_button('Results By Racer', 'racer-results.php', VIEW_RACE_RESULTS_PERMISSION, 'tile_silver');
make_link_button('Standings', 'standings.php', VIEW_AWARDS_PERMISSION, 'tile_silver');
end_tile_group();

if ($two_columns) {
  echo "</div>\n";  // block_buttons
  echo "</div>\n";  // index_column

  echo "<div class='index_column'>\n";
  echo "<div class='block_buttons'>\n";
}

// *********** Red ***************
// Present Awards is on the Kiosk Dashboard, since it drives the awards kiosk;
// the slideshow runs only on kiosks, also set from there.
begin_tile_group();
make_link_button('Race Dashboard', 'coordinator.php', CONTROL_RACE_PERMISSION, 'tile_red');
make_link_button('Kiosk Dashboard', 'kiosk-dashboard.php', CONTROL_RACE_PERMISSION, 'tile_red');
end_tile_group();

// *********** Gold ***************
// The back end, for the Administrator
begin_tile_group();
make_link_button('Set-Up', 'setup.php', SET_UP_PERMISSION, 'tile_gold');
make_link_button('Export Results', 'export.php', SET_UP_PERMISSION, 'tile_gold');
make_link_button('Retrospective', 'history.php', SET_UP_PERMISSION, 'tile_gold');
end_tile_group();

// *********** Black ***************
// Under Log out, who's logged in, since devices get passed around
begin_tile_group();
make_link_button('About', 'about.php', -1, 'tile_black');
if (@$_SESSION['role']) {
  // The Quick Reference guide is for the people running the event
  make_link_button('Quick Reference', 'quickref.php', -1, 'tile_black');
  make_link_button('Log out', 'login.php?logout', -1, 'tile_black');
  echo "<p class='logged_in_as'>Logged in as <b>"
      .htmlspecialchars($_SESSION['role'], ENT_QUOTES, 'UTF-8')."</b></p>";
} else {
  make_link_button('Log in', 'login.php', -1, 'tile_black');
}
end_tile_group();

echo "</div>\n";  // block_buttons
if ($two_columns) {
  echo "</div>\n";  // index_column
}

echo "</div>\n";  // index_background
echo "</body>\n";
echo "</html>\n";
?>

