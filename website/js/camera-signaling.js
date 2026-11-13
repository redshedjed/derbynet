'use strict';

///////////////////////////////////////////////////////////////////////////////////////
//
// Signaling for a track camera (a kiosk's camera; see js/track-camera.js):
// sends the camera's stream over
// WebRTC to each replay display that asks for it.
//
// Usage:
//
//   let vcm = new ViewClientManager('Finish', on_new_viewer);
//   vcm.setstream( the stream to send out );
//
// The camera listens for messages addressed to 'camera-<name>'.  A display
// asks for the stream with a 'solicitation'; the camera answers with an
// 'offer', and the two exchange ICE candidates.  A display that isn't
// connected keeps asking every few seconds, and each ask after the first
// starts its connection over.
//
//////////////////////////////////////////////////////////////////////////////////////
// Assumes message-poller.js

// logsent, logrcvd from message-poller.js
function camera_sent(viewer, key) {
  logsent(viewer + ": " + key);
}
function camera_received(viewer, key) {
  logrcvd(viewer + ": " + key);
}

function ice_candidate_key(candidate) {
  return "ice " +
    candidate.protocol + " " + candidate.ip + ":" + candidate.port +
    " (" + candidate.type + ")";
}

// The recipient name a camera listens on
function camera_recipient(camera_name) {
  return 'camera-' + camera_name;
}

// A ViewClient is one display receiving the camera's stream.
function ViewClient(recipient, poller, from) {
  // Everything's on the local network, so no STUN server is needed.
  let pc = new RTCPeerConnection();
  this.connection = pc;

  pc.onicecandidate = function(event) {
    if (event.candidate) {
      camera_sent(recipient, ice_candidate_key(event.candidate));
      poller.send_message({recipient: recipient,
                           type: 'ice-candidate',
                           from: from,
                           candidate: event.candidate.toJSON()});
    }
  };

  // Adding the stream's tracks is what sets off negotiation, so the offer
  // goes out exactly once, when there's something to send.
  pc.onnegotiationneeded = function(event) {
    logstream("negotiation needed for " + recipient);
    pc.setLocalDescription()
      .then(function() {
        camera_sent(recipient, 'offer');
        poller.send_message({recipient: recipient,
                             type: 'offer',
                             from: from,
                             sdp: pc.localDescription.toJSON()});
      })
      .catch(function(err) { console.error('Offer failed', err); });
  };

  // A new stream (another camera picked, or a new size) replaces the old
  // tracks in place, without starting the connection over.
  let senders = {};  // track kind => RTCRtpSender
  this.setstream = function(stream) {
    stream.getTracks().forEach(function(track) {
      if (senders[track.kind]) {
        senders[track.kind].replaceTrack(track);
      } else {
        senders[track.kind] = pc.addTrack(track, stream);
      }
    });
  };

  this.on_message = function(msg) {
    if (msg.type == 'answer') {
      camera_received(recipient, 'answer');
      pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        .catch(function(err) { console.error('Answer not accepted', err); });
    } else if (msg.type == 'ice-candidate') {
      let candidate = new RTCIceCandidate(msg.candidate);
      camera_received(recipient, ice_candidate_key(candidate));
      pc.addIceCandidate(candidate)
        .catch(function(err) { console.log('ICE candidate not accepted', err); });
    } else {
      logrcvd("UNRECOGNIZED " + JSON.stringify(msg));
      console.error('Unrecognized message for camera:', msg);
    }
  };

  let ideal = {width: 0, height: 0};
  this.set_ideal = function(msg) {
    if (msg.hasOwnProperty('ideal')) {
      ideal = msg.ideal;
    }
  };
  this.ideal = function() { return ideal; };

  this.is_connected = function() {
    return pc.connectionState == 'connected';
  };

  this.close = function() {
    pc.close();
  };
}

// The ViewClientManager creates and owns the ViewClient instances and handles
// dispatching messages.  on_add_client is called when a display connects (or
// reconnects), as its ideal size may call for a bigger stream.
function ViewClientManager(camera_name, on_add_client_callback) {
  let self = this;
  let dispatcher = {};  // viewer-name => ViewClient
  let from = camera_recipient(camera_name);
  let stream = null;

  let poller = new MessagePoller(
    from,
    function(msg) {
      if (msg.type == 'solicitation') {
        let existing = dispatcher[msg.from];
        if (existing && existing.is_connected()) {
          // It asked before seeing it's connected; nothing to do
          return;
        }
        if (existing) {
          // It's asking again because the connection didn't work: start over
          existing.close();
        }
        logrcvd("Solicitation received from " + msg.from);
        let client = new ViewClient(msg.from, poller, from);
        client.set_ideal(msg);
        dispatcher[msg.from] = client;
        if (stream) {
          client.setstream(stream);
        }
        on_add_client_callback();
      } else if (dispatcher.hasOwnProperty(msg.from)) {
        dispatcher[msg.from].on_message(msg);
      } else {
        console.log('Received non-solicitation message from unknown sender: ', msg);
      }
    });

  this.each_client = function(cb) {
    for (var k in dispatcher) {
      cb(dispatcher[k]);
    }
  };

  this.setstream = function(new_stream) {
    stream = new_stream;
    this.each_client(function(vc) { vc.setstream(stream); });
  };

  // How many displays are receiving the stream
  this.connected_count = function() {
    let n = 0;
    this.each_client(function(vc) { if (vc.is_connected()) ++n; });
    return n;
  };

  // Returns the largest "ideal" resolution requested by a viewer
  this.ideal = function() {
    let ideal = {width: 0, height: 0};
    this.each_client(function(vc) {
      let i = vc.ideal();
      ideal.width = Math.max(ideal.width, i.width);
      ideal.height = Math.max(ideal.height, i.height);
    });
    return ideal;
  };
}
