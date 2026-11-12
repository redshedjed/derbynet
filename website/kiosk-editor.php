<?php @session_start();
// The Kiosk Editor: the locations a display can be ('Main' -- the TV by the
// track, 'Lobby', ...).  Scenes say what each location shows, and on the
// Kiosk Dashboard each display is given one of these as its name.
// $_GET['back'], if Back should go somewhere other than the Kiosk Dashboard.

require_once('inc/data.inc');
require_once('inc/authorize.inc');
session_write_close();
require_once('inc/banner.inc');
require_once('inc/kiosks.inc');
require_once('inc/scenes.inc');

require_permission(SET_UP_PERMISSION);

$locations = kiosk_locations();

// Which display (if any) has each location as its name right now
$displays = array();
foreach (all_kiosks() as $kiosk) {
  if ($kiosk['name'] !== '') {
    $displays[strtolower($kiosk['name'])][] = $kiosk;
  }
}

function h($s) {
  return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Kiosk Editor</title>
<?php require('inc/stylesheet.inc'); ?>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<style type="text/css">
.kiosk-editor {
  max-width: 900px;
  margin: var(--space-4) auto;
  padding: 0 var(--space-3);
}
.kiosk-editor .intro {
  margin: 0 0 var(--space-3) 0;
  color: var(--color-text-muted);
}
.location {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--gray-200);
}
.location:first-of-type {
  border-top: none;
}
.location .fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.location input[name=name] {
  flex: 0 1 200px;
  font-weight: var(--weight-semibold);
}
.location .replays-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  white-space: nowrap;
}
.location input[type=text],
#add-location input[type=text] {
  box-sizing: border-box;
  padding: 6px 10px;
  font-size: 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}
.location .shown-on {
  grid-column: 1;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.location .shown-on b {
  color: var(--color-success);
}
.location .buttons {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: flex;
  gap: var(--space-1);
}
.location .save {
  visibility: hidden;
}
.location.changed .save {
  visibility: visible;
}
#add-location {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--gray-200);
}
#message {
  min-height: 1.4em;
  margin: var(--space-2) 0 0 0;
  color: var(--color-danger);
}
</style>
<script type="text/javascript">
// Each change is sent, then the page reloads to show the result
function kiosk_location(data) {
  data.action = 'kiosk.location';
  $.ajax('action.php', {type: 'POST', data: data,
    success: function(json) {
      if (json.outcome.summary == 'success') {
        location.reload();
      } else {
        $("#message").text(json.outcome.description);
      }
    }});
}
function location_row(button) {
  return $(button).closest('.location');
}
function on_save(button) {
  var row = location_row(button);
  kiosk_location({op: 'edit', name: row.attr('data-name'),
                  new_name: row.find('input[name=name]').val()});
}
function on_delete(button) {
  var row = location_row(button);
  if (confirm('Delete the location "' + row.attr('data-name') + '"?  It will be taken out'
              + ' of every scene, and a display named for it will have no name.')) {
    kiosk_location({op: 'delete', name: row.attr('data-name')});
  }
}
function on_move(button, delta) {
  var names = $(".location").map(function() { return $(this).attr('data-name'); }).get();
  var i = names.indexOf(location_row(button).attr('data-name'));
  var j = i + delta;
  if (0 > j || j >= names.length) return;  // (no less-than: the page must parse as XML)
  names.splice(j, 0, names.splice(i, 1)[0]);
  kiosk_location({op: 'order', names: names.join(',')});
}
// Replays over this location's display: saved at once; the display picks it
// up within a few seconds.
function on_replays(checkbox) {
  kiosk_location({op: 'replays', name: location_row(checkbox).attr('data-name'),
                  on: checkbox.checked ? 1 : 0});
}
function on_add() {
  kiosk_location({op: 'add', name: $("#new-name").val()});
  return false;
}
$(function() {
  // Save appears once a location's name is changed
  $(".location input").on('input', function() {
    $(this).closest('.location').addClass('changed');
  });
});
</script>
</head>
<body>
<?php make_banner('Kiosk Editor', isset($_GET['back']) ? $_GET['back'] : 'kiosk-dashboard.php'); ?>

<div class="kiosk-editor">
<section class="card card-accent accent-other">
  <h2 class="card-title">Kiosk Locations</h2>
  <p class="intro">The places a display can be: the TV by the track, the one in the
    lobby, the screen at the awards stage.  The
    <a href="scenes.php?back=kiosk-editor.php">Scene Editor</a> sets what each location
    shows in each scene.  On the Kiosk Dashboard, give each display its location with
    <b>Assign Name</b>.  <b>Show replays</b> plays the track cameras' replay over whatever
    that display shows, at the end of each heat (cameras are set up in
    <a href="settings.php">Settings &gt; Cameras</a>).</p>

<?php foreach ($locations as $i => $loc) {
  $here = isset($displays[strtolower($loc['name'])]) ? $displays[strtolower($loc['name'])] : array();
?>
  <div class="location" data-name="<?php echo h($loc['name']); ?>">
    <div class="fields">
      <input type="text" name="name" value="<?php echo h($loc['name']); ?>"
             placeholder="Kiosk Name" aria-label="Kiosk Name"/>
      <label class="replays-toggle"
             title="Play track-camera replays over whatever this display shows">
        <input type="checkbox" onchange="on_replays(this);"<?php
          if (!empty($loc['replays'])) echo ' checked="checked"'; ?>/>
        Show replays
      </label>
    </div>
    <div class="shown-on">
<?php if (count($here) > 0) { ?>
      Shown on <b><?php echo h(implode(', ', array_map(function($k) { return $k['madlib']; }, $here))); ?></b>
<?php } else { ?>
      No display here yet
<?php } ?>
    </div>
    <div class="buttons">
      <input type="button" class="btn btn-sm save" value="Save" onclick="on_save(this);"/>
      <input type="button" class="btn btn-secondary btn-sm" value="&#x25B2;" title="Move up"
             onclick="on_move(this, -1);"<?php if ($i == 0) echo ' disabled="disabled"'; ?>/>
      <input type="button" class="btn btn-secondary btn-sm" value="&#x25BC;" title="Move down"
             onclick="on_move(this, 1);"<?php if ($i == count($locations) - 1) echo ' disabled="disabled"'; ?>/>
      <input type="button" class="btn btn-danger btn-sm" value="Delete" onclick="on_delete(this);"/>
    </div>
  </div>
<?php } ?>

  <form id="add-location" onsubmit="return on_add();">
    <input type="text" id="new-name" placeholder="Kiosk Name"
           aria-label="Kiosk Name"/>
    <input type="submit" class="btn btn-sm" value="Add Location"/>
  </form>
  <p id="message"></p>
</section>
</div>
</body>
</html>
