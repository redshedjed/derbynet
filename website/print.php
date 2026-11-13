<?php
session_start();

require_once('inc/data.inc');
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/partitions.inc');
require_once('inc/banner.inc');
require_once('inc/emblems.inc');
require_once('inc/photo-config.inc');

require_once('print/inc/printable_racer_document.inc');
require_once('print/inc/printable_award_document.inc');
require_once('print/inc/printable_summary_document.inc');

// TODO Printables should really have their own permission, but we need a
// migration path for updating existing user config files.
require_permission(ASSIGN_RACER_IMAGE_PERMISSION);

// $doc_classes keys are document class names, values are { type:, options: }
$doc_classes = array();
foreach (get_declared_classes() as $c) {
  if (is_subclass_of($c, 'PrintableRacerDocument') && !(new ReflectionClass($c))->isAbstract()) {
    $doc = new $c();
    $doc_classes[$c] = array('type' => 'racer',
                             'order' => 1,
                             'name' => $doc->name(),
                             'options' => $doc->get_available_options());
  }
  if (is_subclass_of($c, 'PrintableAwardDocument') && !(new ReflectionClass($c))->isAbstract()) {
    $doc = new $c();
    $doc_classes[$c] = array('type' => 'award',
                             'order' => 2,
                             'name' => $doc->name(),
                             'options' => $doc->get_available_options());
  }
  if (is_subclass_of($c, 'PrintableSummaryDocument') && !(new ReflectionClass($c))->isAbstract()) {
    $doc = new $c();
    $doc_classes[$c] = array('type' => 'summary',
                             'order' => 3,
                             'name' => $doc->name(),
                             'options' => $doc->get_available_options());
  }
}

function order_by_name($left, $right) {
  if ($left['order'] < $right['order']) {
    return -1;
  } else if ($left['order'] > $right['order']) {
    return 1;
  } else  if ($left['name'] < $right['name']) {
    return -1;
  } else if ($left['name'] > $right['name']) {
    return 1;
  } else {
    return 0;
  }
}

uasort($doc_classes, 'order_by_name');

?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Printables</title>
<link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css"/>
<?php require('inc/stylesheet.inc'); ?>
<link rel="stylesheet" type="text/css" href="css/image-picker.css"/>
<link rel="stylesheet" type="text/css" href="css/mobile.css"/>
<link rel="stylesheet" type="text/css" href="css/print.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/ajax-setup.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/jquery.ui.touch-punch.min.js"></script>
<script type="text/javascript" src="js/image-picker.min.js"></script>
<script type="text/javascript" src="js/mobile.js"></script>
<script type="text/javascript" src="js/modal.js"></script>
<script type="text/javascript" src="js/print.js"></script>
<script type="text/javascript">
    var doc_classes = <?php echo json_encode($doc_classes); ?>;
    var g_emblems = <?php echo json_encode(emblem_choices()); ?>;
</script>
</head>
<body class="fill-page">
<?php make_banner('Printables'); ?>

<?php // The toolbar: how to sort the list, select all or none, and print.
      // Below it, one panel with three columns that each scroll: the kind of
      // document, its options, and the racers (or awards) to print it for. ?>
<div id="print-toolbar" class="toolbar page-toolbar">
  <div id="sortorder-racers-div" class="toolbar">
    <label for="sortorder-racers" class="toolbar-label">Sort</label>
    <select id="sortorder-racers" onchange="handle_sortorder_racers_change()">
      <option value="checkin">Check-In Order</option>
      <option value="name">Last Name</option>
      <option value="class"><?php echo htmlspecialchars(group_label(), ENT_QUOTES, 'UTF-8'); ?></option>
      <?php
      if (use_subgroups()) {
        echo "<option value='rank'>".htmlspecialchars(subgroup_label(), ENT_QUOTES, 'UTF-8')."</option>";
      } ?>
      <option value="car" selected="selected">Car Number</option>
    </select>
  </div>
  <div id="sortorder-awards-div"></div>
  <div id="sortorder-summary-div"></div>
  <div id="select-controls" class="toolbar">
    <input type="button" value="Select All" onclick="select_all(true)" class="btn btn-secondary btn-sm"/>
    <input type="button" value="Deselect All" onclick="select_all(false)" class="btn btn-secondary btn-sm"/>
  </div>
  <span class="toolbar-spacer"></span>
  <input type="button" id="print-selected" class="btn"
         value="Print Selected" onclick="print_selected();"/>
</div>

<div id="print-panel" class="page-panel panel-columns">
<div id="document-controls">
    <?php
    // One group of radio buttons for each type of document (racer, award,
    // summary), so each group has its own top and bottom edges.  They all
    // share the one name, so choosing in one group clears the others.
    $radio_count = 0;
    $last_type = '';
    foreach ($doc_classes as $c => $details) {
      ++$radio_count;

      if ($details['type'] != $last_type) {
        if ($last_type != '') {
          echo "</div>\n";  // mradiogroup
        }
        echo "<div class='mradiogroup'>\n";
      }
      $last_type = $details['type'];

      echo "<label for='doc-class-".$c."'>";
      echo "<b>".$details['name']."</b>";
      echo "</label>\n";

      echo "<input type='radio' name='doc-class' id='doc-class-".$c."'";
      if ($radio_count == 1) {
        echo " checked='checked'";
      }
      echo " value='".$c."'/>";
    }
    if ($last_type != '') {
      echo "</div>\n";  // mradiogroup
    }
    ?>
</div>

<div id="page-controls">

<div id="walkins-div" class="hidden">
  Add
  <input id="walkins-count" type="number" class="not-mobile" value="0"/>
  extras
  <input id='walkins-by-partition' type='checkbox' class='flipswitch mini-flipswitch' checked='checked'
     data-on-text="Per <?php echo group_label();?>"
     data-off-text="Overall"/>
</div>

<div id="document-scroll">
<?php
// Options for each document type are in a div[data-docname='...'], and so can
// be switched on and off depending on which document type is chosen.
$doc_index = 0;  // To distinguish radio options, if needed
foreach ($doc_classes as $c => $details) {
  if (empty($details['options'])) {
    continue;
  }
  ++$doc_index;
  echo "<div data-docname=\"".$c."\" class=\"sub-options hidden\">";
  echo "<p>Options for <b>".$details['name']."</b></p>";
  foreach ($details['options'] as $opt => $opt_data) {
    $ctrl_name = $c.'-'.$opt;
    echo "<div class='param'>\n";
    if ($opt_data['type'] == 'bool') {
      echo "<input type='checkbox' name='".$ctrl_name."'";
      if ($opt_data['default']) {
        echo " checked='checked'";
      }
      echo "/><label for='".$ctrl_name."'>".$opt_data['desc']."</label><br/>\n";
    } else if ($opt_data['type'] == 'int') {
      echo "<input type='number' name='".$ctrl_name."' value='".$opt_data['default']."'/>";
      echo "<label for='".$ctrl_name."'>".$opt_data['desc']."</label><br/>\n";
    } else if ($opt_data['type'] == 'string') {
      echo "<label for='".$ctrl_name."'>".$opt_data['desc']."</label>";
      echo "<input type='text' name='".$ctrl_name."' value='".$opt_data['default']."' class='param-string'/><br/>\n";
    } else if ($opt_data['type'] == 'radio') {
      // values:
      echo "<label for='".$ctrl_name."'>".$opt_data['desc']."</label><br/>\n";
      $first_radio = true;
      echo "<div class='mradiogroup'>\n";
      foreach ($opt_data['values'] as $v) {
        // {value:, desc:}
        echo "<input type='radio' id=\"opt-$doc_index-$opt-$v[value]\""
                  .($first_radio ? " checked=\"checked\"" : "")
                  ." name=\"$ctrl_name\" value=\"$v[value]\"/>\n";
        echo "<label for=\"opt-$doc_index-$opt-$v[value]\">$v[desc]</label>\n";
        $first_radio = false;
      }
      echo "</div>\n";
    } else if ($opt_data['type'] == 'emblems') {
      $emblems_default = $opt_data['default'];

      $century_assignments = $emblems_default['centuries'];
      $partition_assignments = $emblems_default['partitions'];

      echo "<label for='{$ctrl_name}'>Emblems:</label>";
      echo "<select id='{$ctrl_name}' name='{$ctrl_name}' onchange='on_emblems_select_change(this)'>";
      echo "<option value='by-carno' selected='selected'>By car number</option>";
      // TODO
      echo "<option value='by-part' >By ".partition_label_lc()."</option>";
      echo "<option value='none'>None</option>";
      echo "</select>";
      
      $emblem_refs = all_emblem_image_stems();
      // An emblem's index among the choices (data-emblem), and its <img>
      $emblem_index = function($ref) use ($emblem_refs) {
        $i = $ref === null ? false : array_search($ref, $emblem_refs, true);
        return $i === false ? -1 : $i;
      };
      $emblem_img = function($ref) {
        $style = 'max-height:60px; position: absolute; top: 0; right: 0;';
        if ($ref === null) {
          return " <img style='{$style} display: none;'/>";
        }
        return " <img style='{$style}' src='"
            .htmlspecialchars(emblem_ref_url($ref), ENT_QUOTES, 'UTF-8')."'/>";
      };

      echo "<div id='{$ctrl_name}-bycarno'><ul class='mlistview has-alts'>\n";
      $max_carno = read_single_value('SELECT COALESCE(MAX(carnumber), 999) FROM RegistrationInfo');
      $max_century = 1 + intdiv($max_carno, 100);
      for ($century = 0; $century < $max_century; ++$century) {
        $ref = isset($century_assignments[$century]) ? $century_assignments[$century] : null;
        echo "<li data-emblem='".$emblem_index($ref)."' style='height: 60px; background-color: #f6f6f6;'>";
        echo "<p class='emblem-range'>{$century}00-{$century}99";
        echo $emblem_img($ref);
        echo "</p>";
        echo "<a onclick='on_cartags_image_click(this)'></a>";
        echo "</li>\n";
      }
      echo "</ul></div>\n";

      echo "<div id='{$ctrl_name}-bypart' class='hidden'><ul class='mlistview has-alts'>\n";
      $century = -1;
      foreach (all_partitions() as $partition) {  // all_partitions returns in sort order
        ++$century;
        $ref = isset($partition_assignments[$century]) ? $partition_assignments[$century] : null;
        echo "<li data-emblem='".$emblem_index($ref)."' style='height: 60px; background-color: #f6f6f6;'>";
        echo "<p class='emblem-range'>";
        echo htmlspecialchars($partition, ENT_QUOTES, 'UTF-8');
        echo $emblem_img($ref);
        echo "</p>";
        echo "<a onclick='on_cartags_image_click(this)'></a>";
        echo "</li>\n";
      }
      echo "</ul></div>\n";
    }
    echo "</div>\n";
  }
  echo "</div>\n";
}
?>
</div>
</div>


<div id="subjects-context">
    <div id="subject-racers">
    <?php
        if (read_raceinfo_boolean('fake-racers')) {
          echo "<p class='notice notice-warning'>Photos for fake racers don't render in printables.</p>\n";
        }
      ?>
      <table class="table"></table>
    </div>
    <div id="subject-awards" class="hidden">
      <table class="table"></table>
    </div>
    <div id="subject-summary" class="hidden">
      <table class="table"></table>
    </div>
</div>
</div><!-- print-panel -->

<div id="image-picker-modal" class="modal_dialog wide_modal hidden block_buttons">
 <p>CarTags image picker</p>

 <select id="image-picker-select" class='not-mobile'>
  <?php
    foreach (emblem_choices() as $stem_index => $choice) {
      $image_url = htmlspecialchars($choice['url'], ENT_QUOTES, 'UTF-8');
      echo "<option data-img-src='$image_url'  data-img-class='image-picker-thumb'>$stem_index</option>\n";
    }
  ?>
 </select>
 <input id="image-picker-close" type="button" value="Close"/>
</div>

</body>
</html>
