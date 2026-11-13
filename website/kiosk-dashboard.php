<?php session_start(); ?>
<?php
require_once('inc/data.inc');
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/banner.inc');
require_once('inc/path-info.inc');
require_once('inc/scenes.inc');
require_once('inc/schema_version.inc');
require_once('inc/standings.inc');
require_once('inc/locked.inc');

require_permission(CONTROL_RACE_PERMISSION);

$urls = preferred_urls();

?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Kiosks</title>
<link rel="stylesheet" type="text/css" href="css/jquery-ui.min.css"/>
<?php require('inc/stylesheet.inc'); ?>
<link rel="stylesheet" type="text/css" href="css/mobile.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/ajax-setup.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<link rel="stylesheet" type="text/css" href="css/kiosk-dashboard.css"/>
<script type="text/javascript" src="js/mobile.js"></script>
<script type="text/javascript" src="js/dashboard-ajax.js"></script>
<script type="text/javascript" src="js/modal.js"></script>
<script type="text/javascript" src="js/kiosk-parameters.js"></script>
<script type="text/javascript" src="js/kiosk-dashboard.js"></script>
<script type="text/javascript">
var g_all_scenes = <?php echo json_encode(all_scenes(),
                                          JSON_HEX_TAG | JSON_HEX_AMP | JSON_PRETTY_PRINT); ?>;
var g_current_scene = <?php echo json_encode(read_raceinfo('current_scene', ''),
                                             JSON_HEX_TAG | JSON_HEX_AMP); ?>;
var g_all_scene_kiosk_names = <?php echo json_encode(all_scene_kiosk_names(),
                                                     JSON_HEX_TAG | JSON_HEX_AMP); ?>;

var g_url = <?php echo json_encode($urls[0],
                                   JSON_HEX_TAG | JSON_HEX_AMP | JSON_PRETTY_PRINT); ?>;
<?php
$standings = new StandingsOracle();
?>
var g_standings_choices = <?php
    $choices = array_map(function($entry) {
      return array('name' => $entry['name'],
                   'value' => array('key' => $entry['key']));
    }, $standings->standings_catalog());
    echo json_encode($choices, JSON_HEX_TAG | JSON_HEX_AMP); ?>;
</script>
</head>
<body>
<?php make_banner('Kiosks'); ?>

<div id="kiosk-toolbar" class="toolbar page-toolbar">
  <!-- The scene is chosen in the banner (inc/banner.inc) -->
  <div id="scenes-control">
    <div id="scenes-status-message" class="text-muted"></div>
  </div>
</div>

<div class="kiosk_page">
<div id="kiosk_control_group" class="kiosk_control_group">
</div>

<!-- Setting up kiosks: (for the Administrator) the kiosk locations and the
     scenes; another kiosk window on this computer; or make this device a kiosk -->
<section id="set_up_displays" class="card card-accent accent-during">
  <h2 class="card-title">Set Up Kiosks</h2>
  <div class="toolbar">
    <?php if (have_permission(SET_UP_PERMISSION)) { /* locations and scenes are set-up */ ?>
    <a class="btn btn-secondary" href="kiosk-editor.php">Kiosk Editor</a>
    <a class="btn btn-secondary" href="scenes.php">Scene Editor</a>
    <?php } ?>
    <span class="btn-with-note">
      <input id="new_kiosk_window_button" type="button" class="btn btn-secondary" value="New Kiosk Window"/>
      <small class="text-muted">Stays logged in</small>
    </span>
    <span class="btn-with-note">
      <input id="be_a_kiosk_button" type="button" class="btn btn-secondary" value="Be a Kiosk"/>
      <small class="text-muted">Logs out of DerbyNet</small>
    </span>
  </div>
<?php if (have_permission(SET_UP_PERMISSION)) { ?>
  <p class="text-muted">The Kiosk Editor lists the locations a display can be (the TV by
    the track, the lobby, ...); the Scene Editor sets what each location shows.</p>
<?php } ?>
</section>
</div>
<?php require_once('inc/ajax-failure.inc'); ?>

<div id='kiosk_modal' class="modal_dialog hidden block_buttons">
  <form>
    <label for="kiosk_name_field">Name for kiosk:</label>
    <div id="preferred_kiosk_names"></div>
    <input type="text" id="kiosk_name_field"/>
    <!-- The kiosk's cameras, each made a track camera or not (js/kiosk-dashboard.js) -->
    <div id="kiosk_modal_cameras"></div>
    <input type="submit" value="Assign"/>
    <input type="button" value="Cancel"
      onclick='close_modal("#kiosk_modal");'/>
  </form>
</div>

<?php require('inc/kiosk-parameters.inc'); ?>

</body>
</html>
