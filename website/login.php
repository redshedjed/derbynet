<?php @session_start(); 

// Login page: present a list of the possible roles, and, upon
// selection, prompt for a password and log the user in.

require_once('inc/data.inc');
require_once('inc/authorize.inc');

// Log out (login.php?logout): back to what a visitor can do, then straight
// to the home page -- without showing this page first.
if (isset($_GET['logout'])) {
  $_SESSION['permissions'] = $roles['']['permissions'];
  unset($_SESSION['role']);
  unset($_SESSION['setting_up']);
  unset($_SESSION['mobile-checkin-key']);
  session_write_close();
  header('Location: index.php');
  exit(0);
}
session_write_close();
require_once('inc/banner.inc');
require_once('inc/permissions.inc');
require_once('inc/locked.inc');
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Please Log In</title>
<?php require('inc/stylesheet.inc'); ?>
<style type="text/css">
#pw_for_password {
    display: block;
    width: 270px; /* Allow for 15px horizontal padding from global.css */
    margin-left: auto;
    margin-right: auto;
}

#banner_link {
    cursor: default;
}

/* Role choices look like the home menu: white tiles with a colored bar (the
   shared "Tile buttons" in global.css).  Roles get the brand blue; log out
   gets gray, like the home menu's "other" buttons.  Kiosks and cameras are
   started from the Kiosk Dashboard. */
div.index_background {
  padding-top: var(--space-5);
}

.login_heading {
  display: block;
  margin: 0 auto var(--space-4) auto;
  text-align: center;
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.tile-buttons .block_buttons input[type='button'],
.tile-buttons .block_buttons a.button_link {
  box-sizing: border-box;
  width: 270px;
  min-height: 52px;
  height: auto;
  margin-bottom: var(--space-4);
}

/* Each role: its button, then a line on what it's for */
.role_choice {
  margin-bottom: var(--space-4);
}
.tile-buttons .block_buttons .role_choice input[type='button'] {
  margin-bottom: var(--space-1);
}
.block_buttons p.role_hint {  /* (more specific than .block_buttons p in global.css) */
  margin: 0 auto;
  width: 270px;
  padding-left: var(--space-3);
  box-sizing: border-box;
  font-size: var(--text-sm, 0.875rem);
  color: var(--color-text-muted);
}

#login-logout {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--gray-200);
  width: 270px;
  margin-left: auto;
  margin-right: auto;
}
</style>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/ajax-setup.js"></script>
<script type="text/javascript" src="js/modal.js"></script>
<script type="text/javascript">
// Where to go after logging in: the page that asked for it (?next=), or home
var g_after_login = <?php
  echo json_encode(isset($_GET['next']) && preg_match('/^[a-z0-9_-]+\.php$/i', $_GET['next'])
                   ? $_GET['next'] : 'index.php');
?>;
</script>
<script type="text/javascript" src="js/login.js"></script>
</head>
<body>

<a id="banner_link" href="<?php echo isset($_GET['all']) ? '?' : '?all'; ?>">
  <?php make_banner(''); ?>
</a>

<div class="index_background tile-buttons">
<div class="block_buttons">
<h2 class="login_heading">Please choose a role</h2>

<div class="accent-brand">
<?php
// A line under each role saying what it's for, so helpers pick the right
// one: from config-roles.inc ('description'), or these for the usual roles
$role_descriptions = array(
  'RaceCrew' => 'Check-in, photos, printables, judging',
  'RaceCoordinator' => 'Runs the race: dashboards, awards',
  'Administrator' => 'Set-up, settings, awards, export',
  'Timer' => 'The track timer program',
  'Photo' => 'The photo station',
);
foreach ($roles as $name => $details) {
  if (empty($name)) {
    // "Logged out" role: no name, no password
  } else if (isset($details['interactive']) && !$details['interactive'] && !isset($_GET['all'])) {
    // Ignore logins intended for robots
  } else {
    $description = isset($details['description']) ? $details['description']
                   : (isset($role_descriptions[$name]) ? $role_descriptions[$name] : '');
    echo '<div class="role_choice">';
    echo '<input type="button" value="'.htmlspecialchars($name, ENT_QUOTES, 'UTF-8').'"'
        .' onclick=\'show_password_form('.htmlspecialchars(json_encode($name), ENT_QUOTES, 'UTF-8').');\'/>';
    if ($description) {
      echo '<p class="role_hint">'.htmlspecialchars($description, ENT_QUOTES, 'UTF-8').'</p>';
    }
    echo "</div>\n";
  }
}
?>
</div>

<?php
if (@$_SESSION['role']) {
?>
<div id="login-logout" class="accent-other">
<input type="button" value="Log out" onclick='location.href = "login.php?logout";'/>
</div>
<?php
}
?>

</div>
</div>

<div id='password_modal' class="modal_dialog hidden block_buttons">
<form>
  <input type="hidden" name="name" id="name_for_password" value=""/>
  <p>Enter password:</p>
  <p><input type="password" name="pw" id="pw_for_password"/></p>
  <?php if (!locked_settings()) { ?>
  <p>&nbsp;</p>
  <p>Don't remember setting a password?  Consult the documentation.</p>
  <?php } ?>
  <input type="submit" value="Submit"/>
  <input type="button" value="Cancel"
      onclick='close_modal("#password_modal");'/>
</form>
</div>

</body>
</html>
