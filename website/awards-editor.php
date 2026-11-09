<?php @session_start();
// Add, edit, reorder, and assign awards
require_once('inc/data.inc');
require_once('inc/authorize.inc');
session_write_close();

require_once('inc/partitions.inc');
require_once('inc/classes.inc');
require_once('inc/banner.inc');
require_once('inc/schema_version.inc');
require_once('inc/photo-config.inc');
require_permission(EDIT_AWARDS_PERMISSION);
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Awards Editor</title>
<?php require('inc/stylesheet.inc'); ?>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/ajax-setup.js"></script>
<script type="text/javascript" src="js/jquery.ui.touch-punch.min.js"></script>
<script type="text/javascript" src="js/dashboard-ajax.js"></script>
<script type="text/javascript" src="js/mobile.js"></script>
<script type="text/javascript" src="js/modal.js"></script>
<script type="text/javascript" src="js/awards-editor.js"></script>
<link rel="stylesheet" type="text/css" href="css/mobile.css"/>
<link rel="stylesheet" type="text/css" href="css/awards-editor.css"/>
</head>
<body>
<?php make_banner('Awards Editor');

$use_subgroups = use_subgroups();

require_once('inc/awards.inc');

maybe_populate_award_types();
list($classes, $classseq, $ranks, $rankseq) = classes_and_ranks();
?>

<?php
// While voting is open (Judging, Manage Ballot), the awards are locked: no
// adding, changing, reordering or deleting.  The server enforces it too.
$awards_locked = read_raceinfo('balloting', 'closed') == 'open';

// The options for an award's type and group, for the add row (and copied
// from there into each award's row by js/awards-editor.js)
function award_type_options() {
  global $db;
  foreach ($db->query('SELECT awardtypeid, awardtype FROM AwardTypes ORDER BY awardtype') as $atype) {
    if ($atype['awardtypeid'] != AD_HOC_AWARDTYPEID) {
      echo '<option value="'.$atype['awardtypeid'].'">'
          .htmlspecialchars($atype['awardtype'], ENT_QUOTES, 'UTF-8')
          .'</option>'."\n";
    }
  }
}
function award_group_options() {
  global $classes, $classseq, $ranks, $rankseq, $use_subgroups;
  echo '<option value="0,0">'.htmlspecialchars(supergroup_label(), ENT_QUOTES, 'UTF-8').'</option>'."\n";
  $rankseq_index = 0;
  foreach ($classseq as $classid) {
    echo '<option value="'.$classid.',0">'
        .htmlspecialchars($classes[$classid]['class'], ENT_QUOTES, 'UTF-8')
        .'</option>'."\n";
    for (; $rankseq_index < count($rankseq); ++$rankseq_index) {
      $rank = $ranks[$rankseq[$rankseq_index]];
      if ($rank['classid'] != $classid) {
        break;
      }
      if ($use_subgroups) {
        echo '<option value="'.$classid.','.$rank['rankid'].'">'
            .htmlspecialchars($classes[$classid]['class'].' / '.$rank['rank'], ENT_QUOTES, 'UTF-8')
            .'</option>'."\n";
      }
    }
  }
}
?>
<div class="page-content awards_editor">
<?php if ($awards_locked) { ?>
<div class="notice notice-warning awards_locked">
  Voting is open, so the awards are locked.  To change them, close the ballot on the
  <a href="judging.php">Judging</a> page (Manage Ballot).
</div>
<?php } else { ?>
<p class="instructions">Drag an award by its handle to move it.  Edit changes its name,
  type or group in place.  Add a new one in the last row.</p>
<?php } ?>

<!-- One row per award: handle, name, type, group, Edit (built by
     js/awards-editor.js) -->
<div class="card-list-head" aria-hidden="true">
  <span></span><span>Award</span><span>Type</span><span>For</span><span></span>
</div>
<ul id="all_awards" class="card-grid card-list<?php if ($awards_locked) echo ' locked'; ?>"
    data-locked="<?php echo $awards_locked ? 1 : 0; ?>">
</ul>

<?php if (!$awards_locked) { ?>
<!-- A new award, in the same format -->
<form id="quick_add_award" class="grid-card grid-card-add card-row"
      onsubmit="return handle_quick_add_award();">
  <span class="drag-handle"></span>
  <input type="text" id="quick_award_name" class="award-name not-mobile" placeholder="New award name"
         aria-label="New award name" autocomplete="off"/>
  <select id="quick_award_type" class="award-type not-mobile" aria-label="Award type">
<?php award_type_options(); ?>
  </select>
  <select id="quick_award_group" class="award-group not-mobile" aria-label="Award for">
<?php award_group_options(); ?>
  </select>
  <span class="row-buttons">
    <input type="submit" class="btn btn-success btn-sm" value="Add"/>
  </span>
</form>
<?php } else { ?>
<!-- (The option lists, for the award rows) -->
<select id="quick_award_type" class="hidden not-mobile"><?php award_type_options(); ?></select>
<select id="quick_award_group" class="hidden not-mobile"><?php award_group_options(); ?></select>
<?php } ?>
<p id="awards_message" class="text-danger"></p>
</div><!-- page-content -->

</body>
</html>

