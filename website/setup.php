<?php session_start();

require_once('inc/authorize.inc');
require_once('inc/banner.inc');
require_permission(SET_UP_PERMISSION);

?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>DerbyNet Set-Up</title>
<link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css"/>
<link rel="stylesheet" type="text/css" href="css/mobile.css"/>
<link rel="stylesheet" type="text/css" href="css/dropzone.min.css"/>
<?php require('inc/stylesheet.inc'); ?>
<link rel="stylesheet" type="text/css" href="css/setup.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/dropzone.min.js"></script>
<script type="text/javascript" src="js/ajax-setup.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/mobile.js"></script>
<script type="text/javascript" src="js/modal.js"></script>
<script type="text/javascript" src="js/chooser.js"></script>
<script type="text/javascript" src="js/setup.js"></script>
</head>
<body>
<?php make_banner('Set-Up'); ?>
<?php

require_once('inc/parse-connection-string.inc');
require_once('inc/details-for-setup-page.inc');
require_once('inc/default-database-directory.inc');
require_once('inc/standard-configs.inc');
require_once('inc/locked.inc');


$configdir = isset($_SERVER['DERBYNET_CONFIG_DIR']) ? $_SERVER['DERBYNET_CONFIG_DIR'] : 'local';
try {
  @include($configdir.DIRECTORY_SEPARATOR."config-database.inc");
} catch (PDOException $p) {
}

if (isset($db) && $db) {
  require_once('inc/data.inc');
  require_once('inc/schema_version.inc');
}

session_write_close();


// If there's an existing database config, then $db_connection_string should
// contain the connection string (having been set in data.inc).  We parse the
// connection string to figure out how to populate the fields of the "advanced"
// database dialog.

$initial_details = build_setup_page_details();

$ez_configs = list_standard_configs(default_database_directory());

if (defined('JSON_PARTIAL_OUTPUT_ON_ERROR')) {
  $initial_details = json_encode($initial_details, JSON_PARTIAL_OUTPUT_ON_ERROR);
} else {
  $initial_details = json_encode($initial_details);
}
?>
<script type="text/javascript">
//<![CDATA[
$(function() { populate_details(<?php echo $initial_details; ?>); });
//]]>
</script>

<!-- Two cards: the steps to get ready for race day, in the order to do them,
     then the database tools that are rarely needed (and some that delete
     data).  setup.js finds each step by its id (roster_step, schema_step,
     ...), so the ids, status icons and step_details divs must stay.  It
     also moves schema_step up to step 1 when the database needs
     initializing or updating. -->
<div class="setup_sections tile-buttons">

<!-- ======================= Getting ready ======================= -->
<section class="setup_section card card-accent accent-before setup_steps" aria-labelledby="ready-heading">
  <h2 id="ready-heading" class="card-title">Getting Ready for Race Day</h2>
  <p class="setup_intro">Work down the list.  Then on race day, check racers in
    on <a href="checkin.php">Race Check-In</a> and run the race from the
    <a href="coordinator.php">Race Dashboard</a>.</p>

  <div id="database_step" class="step_div">
    <div class="step_number"></div>
    <div class="status_icon"><img/></div>
    <div class="step_button block_buttons">
      <input type="button" value="Choose Database" onclick="show_ezsetup_modal()"/>
    </div>
    <div class="step_details"></div>
  </div>

  <div id="settings_step" class="step_div">
    <div class="step_number"></div>
    <div class="status_icon"><img/></div>
    <div class="step_button block_buttons">
      <a class="button_link" href="settings.php">Settings</a>
    </div>
    <div class="step_details"></div>
  </div>

  <div id="roster_step" class="step_div">
    <div class="step_number"></div>
    <div class="status_icon"><img/></div>
    <div class="step_button block_buttons">
      <a class="button_link" href="import-roster.php">Import Roster</a>
    </div>
    <div class="step_details"></div>
  </div>
  <div id="offer_fake" class="setup_note">
    For practice, you can make a
    <a href="fakeroster.php">Fake Roster</a> of made-up racers.
  </div>
  <div id="remind_fake" class="setup_note setup_note_warning">
    To remove the fake roster, use Purge Data (Database Tools, below) and
    delete racers.
  </div>

  <div id="groups_step" class="step_div">
    <div class="step_number"></div>
    <div class="status_icon"><img/></div>
    <div class="step_button block_buttons">
      <a class="button_link" href="racing-groups.php">Racing Groups</a>
    </div>
    <div class="step_details"></div>
  </div>

  <div id="playlist_step" class="step_div">
    <div class="step_number"></div>
    <div class="status_icon"></div>
    <div class="step_button block_buttons">
      <a class="button_link" href="playlist.php?back=setup.php">Rounds Playlist</a>
    </div>
    <div class="step_details">
      <p>Optional: the order the rounds are raced in, and any finals.  Without
        one, the race coordinator schedules each round from the Race Dashboard.</p>
    </div>
  </div>

  <div id="awards_step" class="step_div">
    <div class="step_number"></div>
    <div class="status_icon"><img/></div>
    <div class="step_button block_buttons">
      <a class="button_link" href="import-awards.php">Import Awards</a>
    </div>
    <div class="step_details"></div>
  </div>

  <div id="printables_step" class="step_div">
    <div class="step_number"></div>
    <div class="status_icon"></div>
    <div class="step_button block_buttons">
      <a class="button_link" href="print.php">Printables</a>
    </div>
    <div class="step_details">
      <p>Check-in cards (with each racer's barcode), car stickers and tags,
        and award certificates.</p>
    </div>
  </div>

  <div id="displays_step" class="step_div">
    <div class="step_number"></div>
    <div class="status_icon"></div>
    <div class="step_button block_buttons">
      <a class="button_link" href="kiosk-dashboard.php">Kiosk Dashboard</a>
    </div>
    <div class="step_details">
      <p>Optional: what the TVs and screens show.  Set them up ahead of time:
        where they are in the <a href="kiosk-editor.php?back=setup.php">Kiosk Editor</a>,
        and what each one shows in the
        <a href="scenes.php?back=setup.php">Scene Editor</a>.</p>
    </div>
  </div>
</section>

<!-- ======================= Database tools ======================= -->
<section class="setup_section card card-accent accent-ink" aria-labelledby="tools-heading">
  <h2 id="tools-heading" class="card-title">Database Tools</h2>
  <div id="tools_steps">

  <div id="import_database_step" class="step_div">
    <div class="status_icon"></div>
    <div class="step_button block_buttons">
      <a class="button_link" href="import-snapshot.php">Import Database</a>
    </div>
    <div class="step_details">
      <p>Load a database snapshot you captured earlier.</p>
    </div>
  </div>

  <div id="directions_step" class="step_div">
    <div class="status_icon"></div>
    <div class="step_button block_buttons">
      <form id="prefs-drop" action="action.php" class="dropzone">
        <p id="prefs-drop-msg" class="dz-message">Import Settings</p>
        <div class="fallback">
          <input type="file" name="prefs" value="Upload Files"/>
        </div>
        <input type="hidden" name="action" value="preferences.upload"/>
      </form>
    </div>
    <div class="step_details">
      <p id="prefs-drop-intro">Drop a saved preferences file on the button, or
        click it to choose one.</p>
    </div>
  </div>

  <div id="schema_step" class="step_div">
    <div class="status_icon"><img/></div>
    <div class="step_button block_buttons">
      <input id="schema_button" type="button"/>
    </div>
    <div id="schema_details" class="step_details"></div>
  </div>

  <div id="purge_step" class="step_div">
    <div class="status_icon"></div>
    <div class="step_button block_buttons">
      <input id="purge_data_button" type="button" class="btn-danger"
             value="Purge Data" onclick="show_purge_modal()"/>
    </div>
    <div class="step_details">
      <p>After testing or practice, delete some or all of the data in the
      database.</p>
    </div>
  </div>

  </div>
  <p class="setup_more">To save a snapshot of the database, or to see the
  connection URLs, revision and configuration details, open
  <a href="system-info.php">System Info</a>.</p>
</section>

</div>


<?php require_once('inc/ajax-failure.inc'); ?>

<div id="ezsetup_modal" class="modal_dialog hidden block_buttons">
  <form>
    <input type="hidden" name="action" value="setup.nodata"/>

    <div id="ez_database">
      <label for="ez_database_name">Name for new database:</label>
      <input type="text" name="ez-new" id="ez_database_name"/>
    </div>

<?php
if (count($ez_configs) > 0) {
?>
<p style="text-align: center;"><b>OR</b></p>
    <select name="ez-old" id="ez_database_select">
<option id="ez-old-nochoice" disabled="disabled" selected="selected" value="">Please select:</option>
<?php
    foreach ($ez_configs as $config) {
      $path = htmlspecialchars($config['relpath'], ENT_QUOTES, 'UTF-8');
      echo "<option value='".$path."'>".$path."</option>\n";
} ?>    </select>
<?php } ?>

    <br/>
    <input type="submit" value="Submit"/>
    <input type="button" value="Cancel"
      onclick="close_modal('#ezsetup_modal');"/>
    <br/>
    <input type="button" value="Advanced"
      onclick="show_advanced_database_modal()"/>
  </form>
</div>


<div id="advanced_database_modal" class="modal_dialog wide_modal tall_modal hidden block_buttons">
  <form><?php
    $is_windows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
?>
    <input type="hidden" name="action" value="setup.nodata"/>

    <input id="sqlite_connection" type="radio" name="connection_type" value="sqlite" checked="checked"/>
    <label for="sqlite_connection">SQLite data source<span class="missing_driver"></span></label>

    <input id="odbc_connection" type="radio" name="connection_type" value="odbc"/>
    <label for="odbc_connection">ODBC data source<span class="missing_driver"></span></label>

    <input type="radio" name="connection_type" value="string" id="string_connection"/>
    <label for="string_connection">Arbitrary connection string</label>

    <div id="for_odbc_connection" class="hidden connection_details">
        <label for="odbc_dsn_name">ODBC data source name (DSN):</label>
        <input type="text" name="odbc_dsn_name" id="odbc_dsn_name"/>
    </div>

    <div id="for_sqlite_connection" class="hidden connection_details">
      <input type="button" id="browse_for_sqlite"
       value="Browse"
       onclick='show_choose_file_modal($("#sqlite_path").val(), "new.sqlite",
                                       function(fullpath) {
                                         $("#sqlite_path").val(fullpath);
                                         update_sqlite_path();
                                       });'/>
      <div style="width: 80%">
        <label for="sqlite_path">Path (on server) to SQLite data file:</label>
        <input type="text" name="sqlite_path" id="sqlite_path"/>
      </div>
    </div>

    <div id="for_string_connection">
        <label for="connection_string">Database connection string:</label>
        <input type="text" name="connection_string" id="connection_string"
            <?php
              if (!isset($db_connection_string)) {
                echo 'placeholder="Database connection string"';
              }
            ?>/>
    </div>

    <input type="submit" value="Submit"/>
    <input type="button" value="Cancel"
      onclick='close_modal("#advanced_database_modal");'/>
  </form>
</div>

<div id="initialize_schema_modal" class="modal_dialog hidden block_buttons">
  <form>

    <p>Initializing the schema will wipe out any existing data in the 
    database, and cannot be undone.  Are you sure that's what you want to do?</p>

    <input type="submit" class="btn-danger" value="Initialize"/>
    <input type="button" value="Cancel"
      onclick='close_secondary_modal("#initialize_schema_modal");'/>
  </form>
</div>

<div id="update_schema_modal" class="modal_dialog hidden block_buttons"> <form>

  <p>Before updating the schema, it's wise to back up any important data
      that's already in the database.  Updating the schema cannot be undone.
      Are you sure that's what you want to do?</p>

    <input type="submit" value="Update Schema"/>
    <input type="button" value="Cancel"
      onclick='close_modal("#update_schema_modal");'/>
  </form>
</div>

<div id="purge_modal" class="modal_dialog wide_modal block_buttons hidden">
<form>
  <div id="purge_modal_inner">

    <div class="purge_div">
      <div class="purge_button block_buttons">
        <input type="button" class="btn-danger" id="delete_race_results" value="Delete Race Results"
                onclick="confirm_purge('results');"/>
      </div>
      <p id="purge_results_para"><span id="purge_nresults_span"></span> completed heat(s)</p>
    </div>

    <div class="purge_div">
      <div class="purge_button block_buttons">
        <input type="button" class="btn-danger" id="delete_schedules" value="Delete Schedules"
                onclick="confirm_purge('schedules');"/>
      </div>
      <p id="purge_schedules_para"><span id="purge_nschedules_span"></span> scheduled heat(s)</p>
    </div>

    <div class="purge_div">
      <div class="purge_button block_buttons">
        <input type="button" class="btn-danger" id="delete_racers" value="Delete Racers"
                onclick="confirm_purge('racers');"/>
      </div>
      <p id="purge_racers_para"><span id="purge_nracers_span"></span> registered racer(s)</p>
    </div>
                                                <!-- TODO delete classes/ranks? -->
    <div class="purge_div">
      <div class="purge_button block_buttons">
        <input type="button" class="btn-danger" id="delete_awards" value="Delete Awards"
                onclick="confirm_purge('awards');"/>
      </div>
      <p id="purge_awards_para"><span id="purge_nawards_span"></span> award(s)</p>
    </div>

    <div class="purge_div">
      <div class="purge_button block_buttons">
        <input type="button" class="btn-danger" value="Re-Initialize"
               onclick="show_initialize_schema_modal();"/>
      </div>
      <p>Delete everything in the database</p>
    </div>
                                                
    <input type="button" value="Cancel"
      onclick='close_modal("#purge_modal");'/>

  </div>
</form>
</div>

<div id="purge_confirmation_modal" class="modal_dialog hidden block_buttons"> <form>

  <p>You are about to purge</p>
  <p id="purge_operation"></p>
  <p>from the database.  This operation cannot be undone.
     Are you sure that's what you want to do?</p>

    <input type="submit" class="btn-danger" value="Purge"/>
    <input type="button" value="Cancel"
      onclick='close_secondary_modal("#purge_confirmation_modal");'/>
  </form>
</div>

<div id="reporting_box" class="hidden">
  <div id="reporting_box_content"></div>
  <div id="reporting_box_dismiss" class="hidden"
       onclick="hide_reporting_box(); return false;">Dismiss</div>
</div>

<?php require('inc/chooser.inc'); ?>
  
</body>
</html>
