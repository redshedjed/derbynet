<?php
@session_start();
// About DerbyNet: who made it and who's running this race.  The technical
// details (URLs, revision, database, timer, PHP) are on system-info.php, for
// people who can set up the race.
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/banner.inc');
require_once('inc/about-pack.inc');

// Open the database just to read the "Our Pack" text; if that fails, the
// default text shows.
$configdir = isset($_SERVER['DERBYNET_CONFIG_DIR']) ? $_SERVER['DERBYNET_CONFIG_DIR'] : 'local';
try {
  @include($configdir.DIRECTORY_SEPARATOR.'config-database.inc');
} catch (PDOException $p) {
}
if (isset($db)) {
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
}
$pack_html = trim(about_pack_html(isset($db) ? $db : null));
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>About DerbyNet</title>
<?php require('inc/stylesheet.inc'); ?>
<style type="text/css">
.about_page .card-title {
  font-size: var(--text-xl);
}
.about_intro {
  font-size: var(--text-lg);
}
.about_page ul {
  margin: var(--space-2) 0;
  padding-left: var(--space-5);
}
#image-credits li {
  margin: 2px 0;
}
</style>
</head>
<body>
<?php make_banner('About'); ?>
<div class="page-content narrow about_page">

<?php if ($pack_html !== '') { ?>
<!-- "Our Pack": set on the Settings page (see inc/about-pack.inc) -->
<section class="card card-accent accent-ink about_pack">
<?php echo $pack_html; ?>

</section>
<?php } ?>

<section class="card card-accent accent-ink">
<h2 class="card-title">DerbyNet</h2>
<p><b>DerbyNet</b> is the free, open-source, multi-screen race management
system for Pinewood Derby-style racing, used by packs and other groups all
around the country and around the globe.</p>
<p>Created by <a href="https://github.com/jeffpiazza/derbynet" target="_blank"><b>Jeff Piazza</b></a>.</p>
<p>Updated by <a href="https://github.com/redshedjed/derbynet" target="_blank"><b>redshedjed</b></a>
and <a href="https://github.com/redshedjed/derbynet" target="_blank"><b>Claude</b></a>.</p>
<?php if (have_permission(SET_UP_PERMISSION)) { ?>
<p><a class="small-button" href="system-info.php">System Info</a></p>
<?php } ?>
</section>

<section class="card card-accent accent-ink" id="image-credits">
<h2 class="card-title">Image Credits</h2>
<p>Some of the fake racer and car images came from one or more of these sources:</p>
<ul>
  <li><a href="https://www.vecteezy.com/free-vector/artwork">Artwork Vectors by Vecteezy</a></li>
  <li><a href="https://www.vecteezy.com/free-vector/portrait">Portrait Vectors by Vecteezy</a></li>
  <li><a href="https://www.vecteezy.com/free-vector/doodle">Doodle Vectors by Vecteezy</a></li>
  <li><a href="https://www.vecteezy.com/free-vector/family">Family Vectors by Vecteezy</a></li>
  <li><a href="https://www.vecteezy.com/free-vector/race-car">Race Car Vectors by Vecteezy</a></li>
  <li><a href="https://www.vecteezy.com/free-vector/car">Car Vectors by Vecteezy</a></li>
  <li><a href="https://www.vecteezy.com/free-vector/cardboard-box">Cardboard Box Vectors by Vecteezy</a></li>
</ul>
</section>

</div>
</body>
</html>
