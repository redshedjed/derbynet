<?php
// The "Our Pack" card on the About page.  Its HTML is a setting, edited on
// the Settings page and stored in the database (RaceInfo 'about-pack-html'),
// so each race's text stays with its own database and never goes into the
// code repository.  An empty setting hides the card.
//
// The HTML is shown as written, to anyone who opens About; only people who
// can set up the race can change it.

function about_pack_default_html() {
  return '<h2 class="card-title">Our Pack</h2>'."\n"
      .'<p class="about_intro">Welcome to our Pinewood Derby!'
      .'  Thanks for coming out to cheer on our racers.</p>';
}

// The current HTML, read straight from $db (the About page doesn't load
// inc/data.inc, which redirects to Set-Up if the database has a problem).
function about_pack_html($db) {
  if (isset($db)) {
    try {
      $rs = $db->prepare('SELECT itemvalue FROM RaceInfo WHERE itemkey = :key');
      $rs->execute(array(':key' => 'about-pack-html'));
      $row = $rs->fetch(PDO::FETCH_NUM);
      $rs->closeCursor();
      if ($row !== false && $row[0] !== null) {
        return $row[0];
      }
    } catch (PDOException $p) {
    }
  }
  return about_pack_default_html();
}
?>
