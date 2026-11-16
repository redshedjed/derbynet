'use strict';

function logmsg(cl, txt) {
  $("<p></p>").addClass(cl).text(txt).appendTo($("#log"));
  let msgs = $("#log p");
  if (msgs.length > 20) {
    msgs.slice(0, -20).remove();
  }
}

function logsent(txt) {
  console.log("=> " + txt);
  logmsg('sent', txt);
}
function logrcvd(txt) {
  console.log("<= " + txt);
  logmsg('rcvd', txt);
}
function logstream(txt) {
  console.log("** " + txt);
  logmsg('stream', txt);
}

// A MessagePoller polls the server (once a second) for messages addressed to
// this recipient, and allows sending messages to other recipients.
//
// MessagePoller is used for webrtc communication between a viewer (a replay
// display, or the Live Camera kiosk page) and a track camera.

function make_id_string(stem) {
  var alphabet = "abcdefghjklmnpqrstuvwz0123456789";

  var id = stem;
  for (var k = 0; k < 12; ++k) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

// Like make_id_string, but the same id comes back after a reload of the same
// browser tab, so a replay display or track camera that reloads keeps its
// place (instead of showing up twice) on Settings > Cameras.
function tab_id_string(stem) {
  let key = 'derbynet-id-' + stem;
  try {
    let id = window.sessionStorage.getItem(key);
    if (!id) {
      id = make_id_string(stem);
      window.sessionStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return make_id_string(stem);
  }
}

function MessagePoller(recipient, on_message) {
  let poller = this;
  this.send_message = function(message_json) {
    $.ajax("action.php",
           {type: 'POST',
            data: {action: 'message.send',
                   message: message_json}});
  };

  this.retrieve_messages = function() {
    $.ajax("action.php",
           {type: 'POST',
            data: {action: 'message.retrieve',
                   recipient: recipient},
            success: function(data) {
              var msgs = data.messages;
              for (var i = 0; i < msgs.length; ++i) {
                on_message(msgs[i]);
              }
            }
           });
  };

  let interval = setInterval(function() { poller.retrieve_messages(); }, 1000 /* ms. */);

  this.close = function() { if (interval) clearInterval(interval); interval = null; };
}
