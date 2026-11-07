<?php @session_start();

require_once('inc/data.inc');
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/banner.inc');
require_once('inc/photo-config.inc');
require_permission(JUDGING_PERMISSION);
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Award Judging</title>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/ajax-setup.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/jquery.ui.touch-punch.min.js"></script>
<script type="text/javascript" src="js/dashboard-ajax.js"></script>
<script type="text/javascript" src="js/mobile.js"></script>
<script type="text/javascript" src="js/modal.js"></script>
<script type="text/javascript" src="js/judging.js"></script>
<link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css"/>
<link rel="stylesheet" type="text/css" href="css/mobile.css"/>
<?php require('inc/stylesheet.inc'); ?>
<link rel="stylesheet" type="text/css" href="css/judging.css"/>
<script type="text/javascript">
$(function() {
    $("#ballot_password").val(<?php echo json_encode(read_raceinfo('ballot_password', '')); ?>);
  });
</script>
</head>
<body class="fill-page">
<?php
make_banner('Judging');

require_once('inc/standings.inc');
require_once('inc/schema_version.inc');

$order = 'car';
if (isset($_GET['order']) && in_array($_GET['order'], ['name', 'class', 'car']))
  $order = $_GET['order'];

// One segment of the Sort control; the current sort is marked and not a link.
function link_for_ordering($key, $text) {
  global $order;
  $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
  if ($order == $key) {
    echo "<span class='current' aria-current='true'>".$text."</span>";
  } else {
    echo "<a href='judging.php?order=".$key."'>".$text."</a>";
  }
}

$racers = array();

$sql = 'SELECT racerid, carnumber, lastname, firstname,'
      .' RegistrationInfo.classid, class, RegistrationInfo.rankid, rank, imagefile,'
      .' '.(schema_version() < 2 ? "class" : "Classes.sortorder").' AS class_sort, '
      .(schema_version() < 2 ? '\'\' as ' : '').' carphoto'
      .' FROM '.inner_join('RegistrationInfo',
                           'Classes', 'Classes.classid = RegistrationInfo.classid',
                           'Ranks', 'Ranks.rankid = RegistrationInfo.rankid')
      .' WHERE passedinspection = 1 AND exclude = 0'
      .' ORDER BY '
      .($order == 'car' ? 'carnumber, lastname, firstname' :
        ($order == 'class'  ? 'class_sort, lastname, firstname' :
         'lastname, firstname'));

foreach ($db->query($sql) as $rs) {
  $racerid = $rs['racerid'];
  $racers[$racerid] = array('racerid' => $racerid,
							'carnumber' => $rs['carnumber'],
							'lastname' => $rs['lastname'],
							'firstname' => $rs['firstname'],
                            'classid' => $rs['classid'],
							'class' => $rs['class'],
                            'rankid' => $rs['rankid'],
                            'rank' => $rs['rank'],
                            'imagefile' => $rs['imagefile'],
                            'carphoto' => $rs['carphoto']);
}

?>
<div id="top_matter" class="toolbar page-toolbar">
  <input type='button' class='btn btn-secondary' value='Manage Ballot'
         onclick='show_modal($("#ballot_modal"));'/>
  <a class="btn btn-secondary" href="awards-editor.php">Edit Awards</a>
  <span class="toolbar-spacer"></span>
  <div id="sort_controls" class="segmented" role="group" aria-label="Sort racers by">
    <span class="segmented-label">Sort</span>
    <?php link_for_ordering('car', "Car #"); ?>
    <?php link_for_ordering('name', "Name"); ?>
    <?php link_for_ordering('class', group_label()); ?>
  </div>
</div>

<div id="judging-panel" class="page-panel">
<div id="awards">
  <div id="dd-prompt">Drag awards to racers, or racers to awards.</div>
  <p id="awards-empty">There are currently no awards defined.</p>
  <ul>
  </ul>
</div>

<div id="racers">
  <?php

  $use_groups = use_groups();
  $use_subgroups = use_subgroups();

  foreach ($racers as $racer) {
    echo "<div class='judging_racer' data-racerid='".$racer['racerid']."' onclick='show_racer_awards_modal($(this));'>\n";
    if ($racer['carphoto']) {
      echo "<img src='".car_photo_repository()->lookup(RENDER_JUDGING)->render_url($racer['carphoto'])."'/>";
    }
    echo "<div class='carno'>";
    echo $racer['carnumber'];
    echo "</div>";


    echo "<div class='racer_name'>".htmlspecialchars($racer['firstname'].' '.$racer['lastname'], ENT_QUOTES, 'UTF-8')."</div>";
    echo "<div class='group_name' data-classid='".$racer['classid']."'>";
    if ($use_groups) {
      echo htmlspecialchars($racer['class'], ENT_QUOTES, 'UTF-8');
    }
    echo "</div>";
    if ($use_subgroups) {
      echo "<div class='subgroup_name' data-rankid='".$racer['rankid']."'>"
          .htmlspecialchars($racer['rank'], ENT_QUOTES, 'UTF-8')
      ."</div>";
    }
    // These get hidden/unhidden by javascript code, based on award results
    echo "<img class='award_marker' src='img/award-ribbon-27x36.png'/>";
    echo "<img class='adhoc_marker' src='img/goldstar.png'/>";
    echo "</div>\n";
  }
?>
</div>
</div><!-- judging-panel -->

<div id="racer_awards_modal" class="modal_dialog hidden block_buttons">
  <h3>Awards for <span id="racer_awards_recipient_carno"></span> <span id="racer_awards_recipient_name"></span>
  </h3>

  <ul id="racer_awards">
  </ul>

  <form id="racer_awards_form">
    <input type="hidden" name="action" value="award.adhoc"/>
    <input type="hidden" name="racerid" value="" id="racer_awards_racerid"/>
    <label for="awardname"><i>Ad hoc</i> award:</label>
    <input type="text" name="awardname" id="racer_awards_awardname"/>

    <input type="submit"/>
    <input type="button" value="Close"
           onclick='close_racer_awards_modal();'/>
  </form>
</div>

<div id="ballot_modal" class="modal_dialog wide_modal hidden block_buttons">
  <label for='balloting_state'>Balloting is: </label>
  <input id='balloting_state' type='checkbox' class='flipswitch'
         data-on-text='Open' data-off-text='Closed'
  <?php if (read_raceinfo('balloting', 'closed') == 'open') echo "checked='checked'"; ?>/>
  <div>
    <label for='ballot_password'>Ballot password:</label>
    <input id='ballot_password' type='text' class='not-mobile'
           onchange='on_ballot_password_change()'/>
  </div>
  
  <div id="ballot_modal_awards">
  </div>

  <p class="usage-hint">Removing an award from the ballot will clear any votes for that award, perhaps from testing.  The award can be immediately re-added to the ballot if desired.</p>
  
  <input type="button" value="Close" onclick='close_modal($("#ballot_modal"));'/>
</div>

<div id="ballot_results_modal" class="modal_dialog hidden">
  <div id="ballot_results_tabulation">
  </div>
  <div class="block_buttons">
    <input type="button" value="Close" onclick='close_modal($("#ballot_results_modal"));'/>
  </div>
</div>

</body>
</html>
