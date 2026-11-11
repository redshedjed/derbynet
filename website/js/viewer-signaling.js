'use strict';

// The display's side of a track camera connection (see camera-signaling.js).

// viewer_id is a string identifying this viewer.
// ideal is the ideal video stream width and height.
// stream_cb gets called with each new stream from the camera.
// camera_name is the camera's name (camera.php?name=...).
function RemoteCamera(viewer_id, ideal, stream_cb, camera_name) {
  let camera = 'camera-' + camera_name;
  let pc = null;
  let last_ask = 0;  // When we last asked the camera for its stream

  function new_connection() {
    if (pc) {
      pc.close();
    }
    // Everything's on the local network, so no STUN server is needed.
    pc = new RTCPeerConnection();
    pc.onicecandidate = function(event) {
      if (event.candidate) {
        logsent('ice-candidate');
        if (poller) poller.send_message({recipient: camera,
                             type: 'ice-candidate',
                             from: viewer_id,
                             candidate: event.candidate.toJSON()});
      }
    };
    pc.ontrack = function(event) {
      let wh = event.track.getSettings();
      logstream(camera_name + ': track ' + wh.width + 'x' + wh.height);
      let s = new MediaStream();
      s.addTrack(event.track);
      stream_cb(s);
    };
  }

  function on_offer(msg) {
    logrcvd('offer');
    // An offer on a connection that isn't working means the camera started
    // over; so do we.  (On a working one, it's a change to the stream.)
    if (!pc || pc.connectionState != 'connected') {
      new_connection();
    }
    let this_pc = pc;
    return this_pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      .then(function() { return this_pc.createAnswer(); })
      .then(function(answer) { return this_pc.setLocalDescription(answer); })
      .then(function() {
        logsent('answer');
        if (poller) poller.send_message({recipient: camera,
                             type: 'answer',
                             from: viewer_id,
                             sdp: this_pc.localDescription.toJSON()});
      });
  }

  function on_message(msg) {
    if (msg.from != camera) {
      return Promise.resolve();  // e.g., another camera, or a broadcast
    }
    if (msg.type == 'offer') {
      return on_offer(msg);
    } else if (msg.type == 'ice-candidate') {
      logrcvd('ice-candidate');
      if (!pc) {
        return Promise.resolve();
      }
      return pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    } else {
      console.error('Unrecognized message ', msg);
      return Promise.resolve();
    }
  }

  // Messages are handled one at a time, in order, so an ICE candidate never
  // arrives ahead of the offer it belongs to.
  let queue = Promise.resolve();
  let poller = new MessagePoller(
    viewer_id,
    function(msg) {
      queue = queue.then(function() { return on_message(msg); })
        .catch(function(err) { console.log(camera_name + ': signaling trouble', err); });
    });

  function ask() {
    if (!poller) return;
    last_ask = Date.now();
    logsent('solicitation ' + camera + ' ' + ideal.width + 'x' + ideal.height);
    poller.send_message({recipient: camera, type: 'solicitation',
                         from: viewer_id, ideal: ideal});
  }

  // Ask again if there's no working connection: right away if it's failed,
  // otherwise after giving it 10 seconds to come up.
  let nag = setInterval(function() {
    let state = pc ? pc.connectionState : 'none';
    if (state == 'connected') {
      return;
    }
    if (state == 'failed' || state == 'closed' || state == 'disconnected' ||
        Date.now() - last_ask >= 10000) {
      ask();
    }
  }, 2500);

  // If the MessagePoller is using a WebSocket that hasn't opened yet, this
  // waits in its queue.
  ask();

  this.camera_name = camera_name;
  this.connected = function() { return pc != null && pc.connectionState == 'connected'; };

  this.close = function() {
    logstream('------------ closed ' + camera_name + ' -----------------');
    clearInterval(nag);
    if (poller) {
      poller.close();
      poller = null;
    }
    if (pc) {
      pc.close();
      pc = null;
    }
  };
}
