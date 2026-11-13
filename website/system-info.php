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
.info_page .card-title {
  font-size: var(--text-xl);
}
.info_page pre {
  overflow-x: auto;
}

/* Addresses for other devices */
.url_list {
  list-style: none;
  margin: var(--space-2) 0 0 0;
  padding: 0;
}
.url_list li {
  margin: 0 0 var(--space-2) 0;
}
.ip_addr {
  display: inline-block;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--color-brand-strong);
  background: #E8EFF8;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 4px 10px;
  user-select: all;   /* one click selects the whole address to copy */
}

/* Export tiles: a row each, tile then explanation, like Set-Up */
.export_row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--gray-200);
}
.export_row .block_buttons {
  flex: 0 0 260px;
}
.export_row .block_buttons a.button_link {
  box-sizing: border-box;
  width: 100%;
  min-height: 52px;
  margin: 0;
  font-size: var(--text-lg);
}
.export_row p {
  flex: 1;
  margin: 0;
}

/* Server summary */
.server_table {
  border-collapse: collapse;
  background: transparent;
}
.server_table th,
.server_table td {
  text-align: left;
  vertical-align: top;
  padding: var(--space-2) var(--space-3) var(--space-2) 0;
  border: 0;
  border-top: 1px solid var(--gray-200);
  font-size: var(--text-base);
}
.server_table th {
  width: 12em;
  font-weight: var(--weight-semibold);
  color: var(--color-text-muted);
}
.server_table td div {
  margin: 0 0 var(--space-1) 0;
}
.muted {
  color: var(--color-text-muted);
}

@media (max-width: 720px) {
  .export_row {
    flex-wrap: wrap;
  }
  .export_row .block_buttons,
  .export_row p {
    flex-basis: 100%;
  }
}
</style>
</head>
<body>
<?php make_banner('System Info', 'setup.php'); ?>
<div class="page-content info_page">

<section class="card card-accent accent-brand">
<h2 class="card-title">Connecting other devices</h2>
<?php
$configured_urls = preferred_urls_from_file();
$urls = preferred_urls();
if ($configured_urls !== false) {
  // Set by the config-url file; no point checking adapters
  echo "<p>This server is set up to be reached at:</p>\n";
} else if (count(active_lan_addresses()) == 0) {
  echo "<p class='notice notice-warning'><b>No active network connection.</b> "
      ."Other devices can't reach this server until it's connected to a network. "
      ."Connect this computer to the race Wi-Fi, then reload this page.</p>\n";
  $urls = array();
} else {
  echo "<p>On the same Wi-Fi network, open one of these addresses on the other"
      ." device (phone, kiosk or timer laptop):</p>\n";
}
if (count($urls) > 0 && !empty($urls[0])) {
  echo "<ul class='url_list'>\n";
  foreach ($urls as $i => $url) {
    $url = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
    echo "<li><span class='ip_addr'>".$url."</span>";
    if ($i == 0 && count($urls) > 1) {
      echo " <span class='badge badge-success'>Most likely</span>";
    }
    echo "</li>\n";
  }
  echo "</ul>\n";
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

    // Export tiles, laid out like the Database section of Set-Up (where
    // Import Database and Import Settings load these files back in)
    $stamp = date('Ymd-His');
    $exports = array(
      array('Export Database', "derbynet-$stamp.xml", 'action.php?query=snapshot.get',
            'A complete backup: racers, results, awards and settings.  Load it again with'
            .' <a href="import-snapshot.php">Import Database</a> on Set-Up.'),
      array('Export for Bug Report', "derbynet-$stamp-clean.xml", 'action.php?query=snapshot.get&amp;clean',
            'The same backup with racer names cut to initials, safe to send with a bug report.'),
      array('Export Settings', 'derbynet.pref', 'preferences.php',
            'Just the settings, to set up another race the same way with Import Settings on Set-Up.'),
    );
    echo "<div class='export_rows tile-buttons'>\n";
    foreach ($exports as $e) {
      echo "<div class='export_row'>"
          ."<div class='block_buttons'>"
          ."<a class='button_link' download='".$e[1]."' href='".$e[2]."'>".$e[0]."</a>"
          ."</div>"
          ."<p>".$e[3]."</p>"
          ."</div>\n";
    }
    echo "</div>\n";
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
<h2 class="card-title">Server</h2>
<?php
// Just what DerbyNet depends on.  (This replaced the full phpinfo() dump,
// which is mostly about the server, not the race.)
function bytes_from_ini($v) {
  $v = trim($v);
  $n = (float) $v;
  switch (strtolower(substr($v, -1))) {
    case 'g': $n *= 1024;
    case 'm': $n *= 1024;
    case 'k': $n *= 1024;
  }
  return $n;
}
$upload_limit = min(bytes_from_ini(ini_get('upload_max_filesize')),
                    bytes_from_ini(ini_get('post_max_size')));

$tz_failed = false;
set_error_handler(function() use (&$tz_failed) { $tz_failed = true; }, E_WARNING);
$tz = date_default_timezone_get();
restore_error_handler();

// Extension => what DerbyNet uses it for
$extensions = array(
  'pdo_sqlite' => 'the race database',
  'gd' => 'racer and car photos',
  'fileinfo' => 'photo uploads',
  'session' => 'logins',
  'curl' => 'talking to other servers (optional)',
);

$rows = array(
  'PHP' => PHP_VERSION.' on '.PHP_OS_FAMILY,
  'Web server' => isset($_SERVER['SERVER_SOFTWARE']) ? $_SERVER['SERVER_SOFTWARE'] : 'unknown',
  'Time zone' => $tz_failed ? false : $tz,
  'Largest photo upload' => round($upload_limit / (1024 * 1024)).' MB',
);
echo "<table class='server_table'>\n";
foreach ($rows as $label => $value) {
  echo "<tr><th>".$label."</th><td>";
  if ($value === false) {
    echo "<span class='badge badge-danger'>Not set</span> Set date.timezone in php.ini.";
  } else {
    echo htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
  }
  echo "</td></tr>\n";
}
echo "<tr><th>Extensions</th><td>";
foreach ($extensions as $ext => $purpose) {
  $ok = extension_loaded($ext);
  echo "<div><span class='badge ".($ok ? 'badge-success' : 'badge-danger')."'>"
      .($ok ? 'OK' : 'Missing')."</span> ".$ext." <span class='muted'>(for ".$purpose.")</span></div>";
}
echo "</td></tr>\n";
echo "</table>\n";
?>
</section>

</div>
</body>
</html>
