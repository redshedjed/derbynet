// Assumes ajax-failure.inc has already established a global ajax error handler

// KioskPoller.start(address, kiosk_page) starts the polling loop; see inc/kiosk-poller.inc
//
// On each cycle, KioskPoller.param_callback gets invoked with the current param
// string; parameter-aware kiosk pages should assign KioskPoller.param_callback
// to track parameter changes.

var KioskPoller = (function(KioskPoller) {

  KioskPoller.param_callback = function(parameters) {
    // console.log("Params: " + param_string);
  };

  // A page with work it mustn't lose (a photo stand with photos still to
  // upload) can return false here to hold off a reload; the poller asks again
  // on its next round.
  KioskPoller.can_reload = function() {
    return true;
  };

  // ---------------- This kiosk's cameras ----------------
  // Reported with each poll, so that when the kiosk is signed in on the Kiosk
  // Dashboard its cameras can be made track cameras (Start, Finish...).

  // The names of this device's cameras: 'Camera 1', 'Camera 2'... until the
  // browser shows their real names, which it does once a camera has been
  // allowed.  If they're hidden, asks for a camera once, so they show (a
  // Raspberry Pi kiosk allows it without asking: see extras/scripts/kiosk.sh).
  var g_device_names = null;  // JSON string, once known
  var g_asked_for_names = false;
  function update_device_names() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      g_device_names = '[]';
      return;
    }
    navigator.mediaDevices.enumerateDevices()
      .then(function(devices) {
        var cameras = devices.filter(function(d) { return d.kind == 'videoinput'; });
        if (cameras.length > 0 && cameras.every(function(c) { return !c.label; })
            && !g_asked_for_names && navigator.mediaDevices.getUserMedia) {
          g_asked_for_names = true;
          return navigator.mediaDevices.getUserMedia({video: true})
            .then(function(stream) {
              stream.getTracks().forEach(function(t) { t.stop(); });
              update_device_names();
            })
            .catch(function() { report(cameras); });
        }
        report(cameras);
      })
      .catch(function() { g_device_names = '[]'; });
    function report(cameras) {
      g_device_names = JSON.stringify(cameras.map(function(c, i) {
        return c.label || ('Camera ' + (i + 1));
      }));
    }
  }

  // A kiosk whose location shows replays, or that streams track cameras,
  // runs inside a layer for them (inc/replay-kiosk.inc).  True if either has
  // changed since this page loaded, so the whole window should reload to add,
  // drop or redo the layer.
  function replay_layer_out_of_date(setting) {
    var framed = window.top !== window;
    var layer = null;
    try {
      layer = framed ? window.top.g_replay_kiosk : null;
    } catch (e) {
    }
    if (framed && !layer) {
      return false;  // e.g., beneath replay.php, which does its own replays
    }
    if (!framed && /[?&]inner=/.test(window.location.search)) {
      return false;  // Asked for without a layer
    }
    var cameras = JSON.stringify(setting.cameras || []);
    if (!layer) {
      return !!setting.replays || cameras != '[]';
    }
    return !!setting.replays != !!layer.replays || cameras != JSON.stringify(layer.cameras || []);
  }

  KioskPoller.start = function(address, kiosk_page) {
    // (A page opened directly with ?page=..., for testing, isn't a kiosk.)
    var report_devices = address && address != 'page-param';
    if (report_devices) {
      update_device_names();
      if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', update_device_names);
      }
    }
    var interval = setInterval(function() {
      var query = {query: 'poll.kiosk', address: address};
      if (report_devices && g_device_names !== null) {
        query.devices = g_device_names;
      }
      $.ajax('action.php',
             {type: 'GET',
              data: query,
              success: function(data) {
                if (data["cease"]) {
                  clearInterval(interval);
                  window.location.href = '../index.php';
                  return;
                }
                var setting = data['kiosk-setting'];
                cancel_ajax_failure();
                $("#kiosk_name").text(setting.name);
                var page = setting.page;
                var needs_reload = page != kiosk_page || setting.reload
                    || replay_layer_out_of_date(setting);
                if (needs_reload && !KioskPoller.can_reload()) {
                  console.log("A reload is due, but this page has work to finish first");
                  KioskPoller.param_callback(JSON.parse(setting.parameters));
                  return;
                }
                if (page != kiosk_page) {
                  console.log("Forcing a reload, because page (" + page
                              + ") != current kiosk_page (" + kiosk_page + ")");
                  location.reload(true);
                  return;
                }
	            if (setting.reload) {
                  console.log("Forcing a reload because it was explicitly requested.");
                  location.reload(true);
                  return;
                }
                if (replay_layer_out_of_date(setting)) {
                  console.log("Reloading: this kiosk's replays or track cameras changed");
                  window.top.location.reload();
                  return;
                }
                KioskPoller.param_callback(JSON.parse(setting.parameters));
              }
             });
    }, 5000);
  }

  return KioskPoller;
}(KioskPoller || {}));

