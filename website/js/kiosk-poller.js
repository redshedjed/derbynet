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

  // A kiosk whose location shows replays, or has a camera of its own, runs
  // inside a layer for them (inc/replay-kiosk.inc).  True if either has
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
    var camera = setting.camera || '';
    if (!layer) {
      return !!setting.replays || camera != '';
    }
    return !!setting.replays != !!layer.replays || camera != layer.camera;
  }

  KioskPoller.start = function(address, kiosk_page) {
    var interval = setInterval(function() {
      $.ajax('action.php',
             {type: 'GET',
              data: {query: 'poll.kiosk',
                     address: address},
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
                  console.log("Reloading: this kiosk's location changed its replays"
                              + " or camera setting");
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

