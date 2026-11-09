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
?>
<div class="page-content awards_editor">
<?php if ($awards_locked) { ?>
<div class="notice notice-warning awards_locked">
  Voting is open, so the awards are locked.  To change them, close the ballot on the
  <a href="judging.php">Judging</a> page (Manage Ballot).
</div>
<?php } else { ?>
<p class="instructions">Drag an award to move it.  Click &#x2699; to edit or delete one.
  Add one with the last card.</p>
<?php } ?>

<!-- The awards, as cards (built by js/awards-editor.js), then the add card -->
<ul id="all_awards" class="card-grid<?php if ($awards_locked) echo ' locked'; ?>"
    data-locked="<?php echo $awards_locked ? 1 : 0; ?>">
  <li class="grid-card grid-card-add">
    <form id="quick_add_award" onsubmit="return handle_quick_add_award();">
      <input type="text" id="quick_award_name" placeholder="New award name"
             aria-label="New award name" autocomplete="off"/>
      <select id="quick_award_type" class="not-mobile" aria-label="Award type">
<?php
        foreach ($db->query('SELECT awardtypeid, awardtype FROM AwardTypes ORDER BY awardtype') as $atype) {
          if ($atype['awardtypeid'] != AD_HOC_AWARDTYPEID) {
            echo '        <option value="'.$atype['awardtypeid'].'">'
                .htmlspecialchars($atype['awardtype'], ENT_QUOTES, 'UTF-8')
                .'</option>'."\n";
          }
        }
?>
      </select>
      <input type="submit" class="btn btn-sm" value="Add"/>
    </form>
  </li>
</ul>
</div><!-- page-content -->


<div id="award_editor_modal" class="modal_dialog hidden block_buttons">
  <form id="award_editor_form">
    <input type="hidden" name="action" value="award.edit"/>
    <input type="hidden" name="awardid" value=""/>
    <label for="name">Award Name:</label>
    <input name="name" type="text"/>

    <label for="awardtype-select">Award Category:</label>
    <select name="awardtypeid" id="awardtype-select">
        <?php
        foreach ($db->query('SELECT awardtypeid, awardtype FROM AwardTypes ORDER BY awardtype') as $atype) {
          if ($atype['awardtypeid'] != AD_HOC_AWARDTYPEID) {
            echo '<option value="'.$atype['awardtypeid'].'">'
                .htmlspecialchars($atype['awardtype'], ENT_QUOTES, 'UTF-8')
                .'</option>'."\n";
          }
        }
        ?>
    </select>

    <select name="class_and_rank">
      <option selected="selected" value="0,0"><?php echo supergroup_label(); ?></option>
        <?php
        $rankseq_index = 0;
        foreach ($classseq as $classid) {
          $cl = $classes[$classid];
          echo '<option value="'.$classid.',0">'
              .htmlspecialchars($cl['class'], ENT_QUOTES, 'UTF-8')
              .'</option>'."\n";
          for (; $rankseq_index < count($rankseq); ++$rankseq_index) {
            $rank = $ranks[$rankseq[$rankseq_index]];
            if ($rank['classid'] != $classid) {
              break;
            }
            if ($use_subgroups) {
              echo '<option value="'.$classid.','.$rank['rankid'].'">'
                   .htmlspecialchars($rank['rank'], ENT_QUOTES, 'UTF-8')
                   .'</option>'."\n";
            }
          }
        }
        ?>
    </select>

    <br/>
    <input type="submit"/>

    <input type="button" value="Close"
           onclick="close_modal('#award_editor_modal');"/>
    <hr/><br/>

    <input type="button" class="delete_button" value="Delete Award"
        onclick="handle_delete_award();"/>

  </form>
</div><!-- award_editor_modal -->

</body>
</html>

