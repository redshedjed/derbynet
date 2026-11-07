<?php
@session_start();
// About DerbyNet: who made it and who's running this race.  The technical
// details (URLs, revision, database, timer, PHP) are on system-info.php, for
// people who can set up the race.
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/banner.inc');
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>About DerbyNet</title>
<?php require('inc/stylesheet.inc'); ?>
<style type="text/css">
.about_page {
  max-width: 760px;
  margin: var(--space-5) auto;
  padding: 0 var(--space-4);
}
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
<?php make_banner('About DerbyNet'); ?>
<div class="about_page">

<section class="card card-accent accent-brand">
<h2 class="card-title">Our Pack</h2>
<!-- TODO: the pack's name, number, and a line or two about the race. -->
<p class="about_intro">Welcome to our Pinewood Derby!  Thanks for coming out to cheer on our racers.</p>
</section>

<section class="card card-accent accent-ink">
<h2 class="card-title">DerbyNet</h2>
<p><b>DerbyNet</b> is the free, open-source, multi-screen race management
system for Pinewood Derby-style racing, used by packs and other groups all
around the country and around the globe.</p>
<p>Created by <b>Jeff Piazza</b> —
<a href="https://jeffpiazza.github.io/derbynet/" target="_blank">derbynet on GitHub</a>.</p>
<p>Updated by <b>redshedjed</b> —
<a href="https://github.com/redshedjed/derbynet" target="_blank">github.com/redshedjed/derbynet</a>.</p>
<?php if (have_permission(SET_UP_PERMISSION)) { ?>
<p><a class="small-button" href="system-info.php">System Info</a></p>
<?php } ?>
</section>

<section class="card card-accent accent-other" id="image-credits">
<h2 class="card-title">Image Credits</h2>
<p>Some of the fake racer and car images used by the
<a href="fakeroster.php">fake roster</a> came from one or more of these sources:</p>
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
