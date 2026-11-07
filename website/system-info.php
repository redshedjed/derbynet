<?php
@session_start();
// System Info: the technical details that used to be on the About page --
// connection URLs, revision, database configuration and schema, timer, and
// PHP settings -- plus the snapshot and preferences downloads.  For people
// who can set up the race.
//
// NOTE: Loading inc/data.inc will cause a redirect to the set-up page if there's
// an issue with the database.  We want to avoid that, since an important use of
// this page is to capture diagnostic information when troubleshooting...
require_once('inc/authorize.inc');
require_permission(SET_UP_PERMISSION);
session_write_close();
// Note that schema_version doesn't load data.inc
require_once('inc/schema_version.inc');
require_once('inc/banner.inc');
require_once('inc/locked.inc');
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>System Info</title>
<?php require('inc/stylesheet.inc'); ?>
<script type="text/javascript">
window.onload = function() {
  var span = document.getElementById("useragent");
  if (span) {
    span.textContent = navigator.userAgent;
  }
};
</script>
<style type="text/css">
.info_page {
  max-width: 1100px;
  margin: var(--space-5) auto;
  padding: 0 var(--space-4);
}
.info_page .card-title {
  font-size: var(--text-xl);
}
.info_page pre {
  overflow-x: auto;
}

.ip_addr {
  font-weight: var(--weight-semibold);
  border: 2px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: 2px 6px;
}

.downloads a {
  margin: 0 var(--space-2) var(--space-2) 0;
}

.phpinfo {background-color: #ffffff; color: #000000; overflow-x: auto;}
.phpinfo, .phpinfo td, .phpinfo th, .phpinfo h1, .phpinfo h2 {font-family: sans-serif;}
.phpinfo pre {margin: 0px; font-family: monospace;}
.phpinfo a:link {color: #000099; text-decoration: none; background-color: #ffffff;}
.phpinfo a:hover {text-decoration: underline;}
.phpinfo table {border-collapse: collapse;}
.phpinfo .center {text-align: center;}
.phpinfo .center table { margin-left: auto; margin-right: auto; text-align: left;}
.phpinfo .center th { text-align: center !important; }
.phpinfo td, .phpinfo th { border: 1px solid #000000; font-size: 75%; vertical-align: baseline;}
.phpinfo h1 {font-size: 150%;}
.phpinfo h2 {font-size: 125%;}
.phpinfo .p {text-align: left;}
.phpinfo .e {background-color: #ccccff; font-weight: bold; color: #000000;}
.phpinfo .h {background-color: #9999cc; font-weight: bold; color: #000000;}
.phpinfo .v {background-color: #cccccc; color: #000000;}
.phpinfo .vr {background-color: #cccccc; text-align: right; color: #000000;}
.phpinfo img {float: right; border: 0px;}
.phpinfo hr {width: 600px; background-color: #cccccc; border: 0px; height: 1px; color: #000000;}
</style>
</head>
<body>
<?php make_banner('System Info', 'setup.php'); ?>
<div class="info_page">

<section class="card card-accent accent-brand">
<h2 class="card-title">Connecting other devices</h2>
<?php
$urls = preferred_urls();

if (count($urls) == 0 || empty($urls[0])) {
  echo "<p>The local IP address for this server can't be determined.</p>\n";
} else {
  echo '<p>It looks like you can use ';
  for ($i = 0; $i < count($urls); ++$i) {
    if ($i > 0) {
      echo ' or ';
    }
    echo "<span class='ip_addr'>".$urls[$i]."</span>";
  }
  echo " as the URL for connecting other local devices to this server.</p>\n";
}
?>
</section>

<section class="card card-accent accent-ink">
<h2 class="card-title">DerbyNet</h2>
<?php
    $version = @file_get_contents('inc/generated-version.inc');
    $build_date = @file_get_contents('inc/generated-build-date.inc');
    $git_hash = @file_get_contents('inc/generated-commit-hash.inc');
    if ($version === false) {
      echo "<p>No version found.</p>\n";
    } else {
      echo "<p>This is revision <b>".$version."</b>, built on ".$build_date.".<br/>\n";
      echo "(".$git_hash.")</p>\n";
    }

    $failed = false;
    set_error_handler(function() { global $failed; $failed = true; }, E_WARNING);
    date_default_timezone_get();
    restore_error_handler();
    if ($failed) {
      echo "<p class='notice notice-danger'><b>Time zone not set!</b> "
          ."You need to set the date.timezone setting in the php.ini file!</p>\n";
    }
?>
<p>Your browser's User Agent string is<br/><span id="useragent"></span></p>
<p>To report a bug, include this page and write to
   <a href="mailto:bugs@derbynet.org">bugs@derbynet.org</a>.</p>
</section>

<section class="card card-accent accent-gold">
<h2 class="card-title">Database</h2>
<?php
    $configdir = isset($_SERVER['DERBYNET_CONFIG_DIR']) ? $_SERVER['DERBYNET_CONFIG_DIR'] : 'local';
    $config_content = @file_get_contents($configdir.DIRECTORY_SEPARATOR.'config-database.inc',
                                         /* use_include_path */ true);
    if ($config_content === false) {
      echo '<p>Database configuration file, '.
          htmlspecialchars($configdir.DIRECTORY_SEPARATOR.'config-database.inc',
                           ENT_QUOTES, 'UTF-8').
          ', could not be opened.'.
          '</p>'."\n";
    } else {
      echo "<pre>\n";
      echo htmlspecialchars($config_content, ENT_QUOTES, 'UTF-8');
      echo "</pre>\n";
    }

// Try setting up the database, but it's OK if it doesn't work out
try {
  @include($configdir.DIRECTORY_SEPARATOR."config-database.inc");
} catch (PDOException $p) {
}

if (isset($db)) {
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  try {
    // Can't use schema_version(), because it depends on functions from data.inc
    $rs = $db->prepare('SELECT itemvalue FROM RaceInfo WHERE itemkey = :key');
    $rs->execute(array(':key' => 'schema'));
    $row = $rs->fetch(PDO::FETCH_NUM);
    $rs->closeCursor();
    $schema_version = $row === false ? false : $row[0];
    echo '<p>Schema version '.$schema_version.' (expecting version '.expected_schema_version().')</p>'."\n";

    echo "<p class='downloads'>"
        ."<a class='small-button' download='derbynet-".date('Ymd-His').".xml'"
        ." href='action.php?query=snapshot.get'>Download Complete Snapshot</a>"
        ."<a class='small-button' download='derbynet-".date('Ymd-His').".xml'"
        ." href='action.php?query=snapshot.get&amp;clean'>Download Cleaned Snapshot</a>"
        ."<a class='small-button' download='derbynet.pref'"
        ." href='preferences.php'>Download Preferences</a>"
        ."</p>\n";
  } catch (PDOException $p) {
    echo '<p>Can\'t determine schema version (expecting version '.expected_schema_version().')</p>'."\n";
  }
}
?>
</section>

<?php
  if (isset($db)) {
    function read_raceinfo($key, $def = false) {
      global $db;
      try {
        $rs = $db->prepare('SELECT itemvalue FROM RaceInfo WHERE itemkey = :key');
        $rs->execute(array(':key' => $key));
        $row = $rs->fetch(PDO::FETCH_NUM);
        $rs->closeCursor();
      } catch (PDOException $p) {
        return $def;
      }
      if ($row === false || $row[0] === null) {
        return $def;
      }
      return $row[0];
    }

    $timer = read_raceinfo('timer-type');
    if ($timer) {
      echo "<section class='card card-accent accent-during'>\n";
      echo "<h2 class='card-title'>Timer</h2>\n";
      echo "<p>";
      echo htmlspecialchars($timer, ENT_QUOTES, 'UTF-8');

      $timer_human = read_raceinfo('timer-humant');
      if ($timer_human) {
        echo ' '.htmlspecialchars($timer_human, ENT_QUOTES, 'UTF-8');
      }
      $timer_ident = read_raceinfo('timer-ident');
      if ($timer_ident) {
        echo ' ('.htmlspecialchars($timer_ident, ENT_QUOTES, 'UTF-8').')';
      }
      echo "</p>\n";
      echo "</section>\n";
    }
  }
?>

<section class="card card-accent accent-other">
<h2 class="card-title">PHP Configuration</h2>
<div class="phpinfo">
<?php
ob_start();
 @phpinfo();
$buf = ob_get_clean();
$start = strpos($buf, '<body>') + 6;
$stop = strpos($buf, '</body>');
echo substr($buf, $start, $stop - $start);
?>
</div>
</section>

</div>
</body>
</html>
