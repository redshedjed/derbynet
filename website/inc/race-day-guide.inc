<?php
// The Race Day strip on the home page, for those who set up or run the race:
// the day's steps in order -- Set Up, Check In, Race, Awards, Wrap Up --
// each with how far along it is and a link to where it's done.  The first
// step not yet done is highlighted as the one to do next.

require_once('inc/data.inc');
require_once('inc/authorize.inc');

// One number from the database, or 0 if the query fails (e.g., while the
// database is being set up).
function race_day_count($sql) {
  try {
    return intval(read_single_value($sql, array(), 0));
  } catch (Exception $e) {
    return 0;
  }
}

function race_day_steps() {
  $nracers = race_day_count('SELECT COUNT(*) FROM RegistrationInfo');
  $npassed = race_day_count('SELECT COUNT(*) FROM RegistrationInfo WHERE passedinspection <> 0');
  $nawards = race_day_count('SELECT COUNT(*) FROM Awards');
  $nheats = race_day_count('SELECT COUNT(*) FROM (SELECT DISTINCT roundid, heat FROM RaceChart) AS h');
  $nrun = race_day_count('SELECT COUNT(*) FROM (SELECT DISTINCT roundid, heat FROM RaceChart'
                         .' WHERE completed IS NOT NULL AND completed <> \'\') AS h');
  $nlanes = intval(get_lane_count());
  $admin = have_permission(SET_UP_PERMISSION);

  $steps = array();
  // Set up enough to race: racers, and the number of lanes (for scheduling)
  $steps[] = array('title' => 'Set Up',
                   'status' => $nracers == 0 ? 'No racers yet'
                               : ($nlanes <= 0 ? 'Number of lanes not set'
                                  : $nracers.' racers, '.$nawards.' award'.($nawards == 1 ? '' : 's')),
                   'link' => $admin ? 'setup.php' : false,
                   'done' => $nracers > 0 && $nlanes > 0);
  $steps[] = array('title' => 'Check In',
                   'status' => $npassed.' of '.$nracers.' checked in',
                   'link' => have_permission(CHECK_IN_RACERS_PERMISSION) ? 'checkin.php' : false,
                   // Done once everyone's in, or the racing has begun
                   'done' => $nracers > 0 && ($npassed == $nracers || $nrun > 0));
  $steps[] = array('title' => 'Race',
                   'status' => $nheats == 0 ? 'No heats scheduled yet'
                               : $nrun.' of '.$nheats.' heats run',
                   'link' => have_permission(CONTROL_RACE_PERMISSION) ? 'coordinator.php' : false,
                   'done' => $nheats > 0 && $nrun == $nheats);
  $steps[] = array('title' => 'Awards',
                   'status' => 'Present them, one by one',
                   'link' => have_permission(PRESENT_AWARDS_PERMISSION) ? 'awards-presentation.php' : false,
                   'done' => false);
  if ($admin) {
    $steps[] = array('title' => 'Wrap Up',
                     'status' => 'Export the results',
                     'link' => 'export.php',
                     'done' => false);
  }
  return $steps;
}

function race_day_guide() {
  if (!have_permission(SET_UP_PERMISSION | CONTROL_RACE_PERMISSION)) {
    return;
  }
  $steps = race_day_steps();
  $next = -1;
  foreach ($steps as $i => $step) {
    if (!$step['done']) {
      $next = $i;
      break;
    }
  }
  echo "<nav class='race_day_guide card' aria-label='Race day steps'>\n";
  echo "<ol>\n";
  foreach ($steps as $i => $step) {
    $class = $step['done'] ? 'done' : ($i == $next ? 'next' : 'later');
    $title = htmlspecialchars($step['title'], ENT_QUOTES, 'UTF-8');
    $status = htmlspecialchars($step['status'], ENT_QUOTES, 'UTF-8');
    $inner = "<span class='step_mark'>".($step['done'] ? '&#x2713;' : ($i + 1))."</span>"
        ."<span class='step_text'><span class='step_title'>".$title."</span>"
        ."<span class='step_status'>".$status."</span></span>";
    echo "<li class='".$class."'"
        .($i == $next ? " aria-current='step'" : "").">";
    if ($step['link']) {
      echo "<a href='".$step['link']."'>".$inner."</a>";
    } else {
      echo "<div>".$inner."</div>";
    }
    echo "</li>\n";
  }
  echo "</ol>\n";
  echo "</nav>\n";
}
?>
