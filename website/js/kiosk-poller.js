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

  // A kiosk whose location shows replays runs inside a replay layer
  // (inc/replay-kiosk.inc).  True if that's turned on or off since this page
  // loaded, so the whole window should reload to add or drop the layer.
  function replay_layer_out_of_date(setting) {
    var framed = window.top !== window;
    var in_layer = false;
    try {
      in_layer = framed && !!window.top.g_replay_kiosk;
    } catch (e) {
    }
    if (framed && !in_layer) {
      return false;  // e.g., beneath replay.php, which does its own replays
    }
    if (!framed && /[?&]inner=/.test(window.location.search)) {
      return false;  // Asked for without a layer
    }
    return !!setting.replays != in_layer;
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
                  console.log("Reloading: replays turned " + (setting.replays ? "on" : "off")
                              + " for this kiosk's location");
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

