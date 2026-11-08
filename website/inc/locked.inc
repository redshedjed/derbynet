<?php

// The presence of a settings.lock file in the config directory prevents changes to
// the database and the photo directories.  This is specifically intended to support hosting
// for multiple groups on a single shared hosting account.

function locked_settings() {
  $configdir = isset($_SERVER['DERBYNET_CONFIG_DIR']) ? $_SERVER['DERBYNET_CONFIG_DIR'] : 'local';
  return file_exists($configdir.DIRECTORY_SEPARATOR.'settings.lock');
}

function preferred_urls_from_file() {
  $configdir = isset($_SERVER['DERBYNET_CONFIG_DIR']) ? $_SERVER['DERBYNET_CONFIG_DIR'] : 'local';
  try {
    // If present, the config-url should contain the whole url, e.g.,
    //  http://my-host.com/with/a/long/path
    $config_url_file = $configdir.DIRECTORY_SEPARATOR."config-url";
    if (!file_exists($config_url_file)) {
      return false;
    }
    $v = file_get_contents($config_url_file);
    if ($v !== false) {
      return array(trim($v));
    }
  } catch (Exception $p) {
  }
  return false;
}

// True for an IPv4 address other devices could never reach: loopback
// (127.x) or self-assigned link-local (169.254.x, what an adapter takes when
// it has no network).
function unreachable_ipv4($addr) {
  return strpos($addr, '127.') === 0 || strpos($addr, '169.254.') === 0;
}

// Adapters for virtual machines and containers on this computer (Hyper-V,
// WSL, VMware, VirtualBox, Docker).  They're "up", but other devices on the
// race network can't reach them.  (Windows Mobile Hotspot's "Wi-Fi Direct
// Virtual Adapter" is real, and isn't matched.)
function virtual_machine_adapter($name, $description) {
  return preg_match('/hyper-v|vethernet|wsl|vmware|virtualbox|vboxnet/i', $description) ||
         preg_match('/^(docker\d|br-|veth|virbr|vboxnet|vmnet)/', $name);
}

// The IPv4 address this computer would use to reach other networks (its
// default route), or false.  Connecting a UDP socket sends nothing; it only
// asks the operating system to pick a route.
function default_route_ipv4() {
  $s = @stream_socket_client('udp://192.0.2.1:9', $errno, $errstr, 1);
  if ($s === false) {
    return false;
  }
  $name = stream_socket_get_name($s, false);
  fclose($s);
  if ($name === false) {
    return false;
  }
  $addr = substr($name, 0, strrpos($name, ':'));
  return unreachable_ipv4($addr) ? false : $addr;
}

// The IPv4 addresses other devices on the local network can use to reach
// this server: only network adapters that are up and connected.  The
// default-route address comes first.  An empty array means no active
// network connection.
function active_lan_addresses() {
  $addrs = array();
  if (function_exists('net_get_interfaces')) {
    $ifaces = @net_get_interfaces();
    if (is_array($ifaces)) {
      foreach ($ifaces as $name => $iface) {
        if (isset($iface['up']) && !$iface['up']) {
          continue;
        }
        if (virtual_machine_adapter($name, isset($iface['description']) ? $iface['description'] : '')) {
          continue;
        }
        foreach (isset($iface['unicast']) ? $iface['unicast'] : array() as $u) {
          // net_get_interfaces() reports IPv4 as family 2 (AF_INET) on every platform
          if (isset($u['family']) && $u['family'] == 2 &&
              !empty($u['address']) && !unreachable_ipv4($u['address'])) {
            $addrs[] = $u['address'];
          }
        }
      }
    }
  } else {
    // gethostname() may be something like "instance-1", possibly with a non-routable IP.
    $hostname = gethostname();
    $named = $hostname === false ? false : gethostbynamel($hostname);
    foreach ($named === false ? array() : $named as $addr) {
      if (!unreachable_ipv4($addr)) {
        $addrs[] = $addr;
      }
    }
  }

  $route = default_route_ipv4();
  if ($route !== false && in_array($route, $addrs)) {
    $addrs = array_merge(array($route), array_diff($addrs, array($route)));
  }
  return array_values(array_unique($addrs));
}

function preferred_urls($use_https = false) {
  $urls = preferred_urls_from_file();
  $scheme = $use_https ? 'https' : $_SERVER['REQUEST_SCHEME'];
  if ($urls === false) {
    $addrs = active_lan_addresses();
    $urls = array();

    // accommodate hosted on proxy servers (eg. nginx)
    if (isset($_SERVER['HTTP_HOST']) && isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
      $addrs = array($_SERVER['HTTP_HOST']);
    }

    // IIS apparently doesn't set REQUEST_URI.
    if (isset($_SERVER['REQUEST_URI'])) {
      // The folder of the page, without its query (which may contain a /,
      // e.g. kiosk.php?page=kiosks/join-wifi.kiosk)
      $uri = dirname(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
      if ($uri == "/" || $uri == "\\") {
        $uri = "";
      }
    } else {
      $uri = '/...';
    }

    for ($i = 0; $i < count($addrs); ++$i) {
      $urls[] = $scheme."://".$addrs[$i].$uri;
    }
  }
  if (count($urls) == 0) $urls = array("");
  return $urls;
}

?>
