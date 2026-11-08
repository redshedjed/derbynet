<?php @session_start(); ?>
<?php
require_once('inc/data.inc');
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/banner.inc');
require_once('inc/schema_version.inc');
require_once('inc/events.inc');
require_once('inc/lane-bias.inc');
require_once('inc/history-formatter.inc');

if (isset($_GET['debug'])) {
  $debug_history_entries = true;
}

require_permission(SET_UP_PERMISSION);  // Administrator

?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Race History</title>
<?php require('inc/stylesheet.inc'); ?>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript">
$(function() {
    $("#lane-bias").on('click', function() {
        let details = $("#lane-bias-details");
        if (details.css("display") == "none") {
          // Opening
          $("#lane-bias-triangle").attr('src', 'img/triangle_south.png');
          details.slideDown(200);
        } else {
          // Closing
          $("#lane-bias-triangle").attr('src', 'img/triangle_east.png');
          details.slideUp(200);
        }
      });
  });
</script>
<style type="text/css">
/* Events timeline: each event is two rows, a small line with the heat and
   time (event-identifier), then what happened (event-explanation). */
table.event-history {
  width: 100%;
  border-collapse: collapse;
}
table.event-history td {
  border: 0;
  text-align: left;
  padding: 2px var(--space-3);
}
table.event-history tr.event-identifier td {
  padding-top: var(--space-2);
  border-top: 1px solid var(--gray-200);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
table.event-history tr.event-explanation td {
  padding-bottom: var(--space-2);
}
table.event-history tr.event-explanation.first td,
table.event-history tr.event-explanation.follow-on td {
  border: 0;
}
table.event-history tr.event.irregular td {
  background: var(--color-danger-bg);
}

#lane-bias {
  cursor: pointer;
}
#lane-bias-triangle {
  vertical-align: middle;
  margin-right: var(--space-2);
}
#lane-bias-details {
  display: none;
}
#lane-bias-details table td {
  text-align: right;
  padding: 2px var(--space-3);
}
.lane-bias-warning {
  color: var(--color-danger);
}
</style>
</head>
<body>
<?php
make_banner('Retrospective');
$bias = lane_bias_analysis();
?>
<div class="content page-content">

<section class="card card-accent accent-after">
<h2 class="card-title">Lane bias</h2>

  <div id="lane-bias">
<?php
  if (empty($bias)) {
    echo "<p>There isn't enough evidence to assess lane bias.</p>";
  } else {
?>
    <p id="lane-bias-summary">
    <img id="lane-bias-triangle" src="img/triangle_east.png"/>
    &nbsp;
<?php
    if ($bias['biased']) {
      echo "<b class='lane-bias-warning'>The track lanes appear to be biased, with 90% confidence.</b>";
    } else {
      echo "There is no evidence of significant lane bias.";
    }
?>
    </p>

    <div id="lane-bias-details">

      <table><?php lane_bias_analysis(true); ?></table>

      <?php
        echo "<p>F statistic is ".sprintf("%5.3f", $bias['f-statistic'])." with df1=".$bias['df1']." and df2=".$bias['df2']."</p>\n";
        echo "<p>Critical value for F statistic is ".sprintf("%5.3f", $bias['critical-value'])."</p>\n";
      ?>
</div>
<?php } ?>
</div>
</section>

<section class="card card-accent accent-ink">
<h2 class="card-title">Events timeline</h2>

<table class="event-history">
<?php
  if (schema_version() < PER_SUBGROUP_AWARDS_SCHEMA) {
    require('inc/old-history.inc');
  } else {
    $formatter = new HistoryActionFormatter;
    $history = $db->prepare('SELECT * FROM ActionHistory ORDER BY received');
    $history->execute();
    foreach ($history as $action) {
      $formatter->SetAction($action['request']);
      $curr_heat = $formatter->CurrentHeatString();
      $step = $formatter->Process();
      if (!empty($step)) {
        $irregular = '';
        echo "<tr class='event $irregular event-identifier'>";
        echo "<td>";
        echo $curr_heat;
        echo "</td>";
        echo "<td>".$action['received']."</td>";
        echo "<td>"./* turnaround time */"</td>";
        echo "</tr>\n";
        echo "<tr class='event $irregular event-explanation'><td colspan='3'>$step</td>";
        echo "</tr>\n";
      }
    }
  }
?>
</table>
</section>

</div> <!-- content -->
</body>
</html>
