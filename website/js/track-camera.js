'use strict';

// A track camera station: sends one local camera's picture, under the
// camera's name (Start, Finish...), to every replay display that asks for it,
// and checks in every 2 seconds so Settings > Cameras and the Kiosk Dashboard
// know how it's doing.
//
// Used by a kiosk's replay layer (inc/replay-kiosk.inc), one for each of the
// kiosk's cameras assigned a track camera on the Kiosk Dashboard.  Assumes
// message-poller.js, camera-signaling.js and camera-source.js.
//
//   let station = new TrackCameraStation({
//     name: 'Finish',
//     client_id: 'kiosk-' + address,   // who it checks in as
//     video: document.getElementById('preview'),
//     picker: $("#device-picker"),     // optional
//     remember_as: 'track-camera',     // optional: remember the camera chosen
//     prefer_label: 'Logitech C920',   // optional: camera chosen elsewhere
//     on_status: (text) => { ... },    // optional: each check-in's status
//     on_stream: (stream) => { ... },  // optional: the camera's picture
//     on_trouble: (message) => { ... },
//   });
//   station.start();

class TrackCameraStation {
  constructor(options) {
    this.options = options;
    this.name = options.name;
    this.manager = new ViewClientManager(options.name, () => { this._on_new_viewer(); });
    this.camera = new CameraSource({
      video: options.video,
      picker: options.picker,
      remember_as: options.remember_as,
      prefer_label: options.prefer_label,
      // As big as the biggest replay screen watching this camera
      constraints: () => {
        let c = {};
        let ideal = this.manager.ideal();
        if (ideal.width) {
          c.width = {ideal: ideal.width};
        }
        if (ideal.height) {
          c.height = {ideal: ideal.height};
        }
        return c;
      },
      on_stream: (stream) => {
        this.manager.setstream(stream);
        if (options.on_stream) {
          options.on_stream(stream);
        }
        this.check_in();
      },
      on_trouble: options.on_trouble,
    });
  }

  start() {
    this.camera.start();
    this.check_in();
    setInterval(() => { this.check_in(); }, 2000);
  }

  stream() {
    return this.camera.stream();
  }

  // A new display may want a bigger picture than the camera is sending.
  _on_new_viewer() {
    let stream = this.camera.stream();
    let ideal = this.manager.ideal();
    let settings = stream ? stream.getVideoTracks()[0].getSettings() : {};
    if (!stream || ideal.width > (settings.width || 0) || ideal.height > (settings.height || 0)) {
      this.camera.restart();
    }
  }

  status() {
    let stream = this.camera.stream();
    if (!stream) {
      return 'No camera';
    }
    let s = stream.getVideoTracks()[0].getSettings();
    let n = this.manager.connected_count();
    return s.width + 'x' + s.height + ', sending to ' + n + (n == 1 ? ' display' : ' displays');
  }

  check_in() {
    let status = this.status();
    if (this.options.on_status) {
      this.options.on_status(status);
    }
    $.ajax('action.php',
           {type: 'POST',
            data: {action: 'replay.poll',
                   client: this.options.client_id,
                   kind: 'camera',
                   name: this.name,
                   status: status,
                   devices: JSON.stringify(this.camera.device_labels())}});
  }
}
