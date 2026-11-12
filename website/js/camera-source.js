'use strict';

// One local camera for a page.  A CameraSource lists the cameras in a
// <select>, remembers the choice in this browser, follows cameras being
// plugged in or unplugged, and shows the live picture in a <video>.
//
//   let camera = new CameraSource({
//     video: document.getElementById('preview'),   // required
//     picker: $("#device-picker"),                   // <select>, optional
//     remember_as: 'checkin',                        // key for the saved choice
//     prefer_label: 'Logitech C920',                 // use this camera, if here
//     constraints: () => ({width: {ideal: 3840}}),   // extra video constraints
//     extra_choices: [{value: 'remote', label: 'Remote Camera'}],
//     on_extra_choice: (value) => { ... },           // one of those was picked
//     on_stream: (stream) => { ... },                // a local stream started
//     on_stream_ending: (stream) => { ... },         // just before it stops
//     on_trouble: (message) => { ... },              // a jQuery element to show
//     on_device_lost: () => { ... },                 // chosen camera unplugged
//   });
//   camera.start();  ...  camera.stop();
//
// Names of cameras only become visible once the browser has been given
// permission to use one, so the list is (re)built after each stream opens.

class CameraSource {
  constructor(options) {
    this.options = options;
    this.video = options.video;
    this.picker = options.picker ? $(options.picker) : null;
    this.extra_choices = options.extra_choices || [];
    this._stream = null;
    this._running = false;
    // Each open bumps the generation, so a slow getUserMedia that finishes
    // after a newer request (or after stop()) is thrown away.
    this._generation = 0;
    // deviceId of the camera in use, or the value of an extra choice
    this._current = '';

    if (this.picker) {
      this.picker.on('change', () => { this._on_pick(); });
    }
    if (CameraSource.available() && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', () => { this._on_device_change(); });
    }
  }

  static available() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // Browsers only allow cameras on secure (https) pages, other than localhost.
  static unavailable_message() {
    let div = $("<div/>").append($("<p/>").text("This browser won't give this page access to a camera."));
    if (window.location.protocol == 'http:') {
      let https_url = 'https://' + window.location.hostname + window.location.pathname;
      div.append($("<p/>").text('You may need to switch to ')
                 .append($("<a/>").attr('href', https_url).text(https_url)));
    }
    return div;
  }

  stream() { return this._stream; }
  choice() { return this._current; }

  start() {
    if (this._running && (this._stream || this._is_extra(this._current))) {
      return Promise.resolve(this._stream);  // Already going
    }
    this._running = true;
    let remembered = this._remembered();
    if (remembered && this._is_extra(remembered)) {
      this._choose_extra(remembered);
      this._fill_picker();
      return Promise.resolve(null);
    }
    return this._open(remembered);
  }

  stop() {
    this._running = false;
    ++this._generation;
    this._release();
  }

  // Opens the current camera again, e.g., because the constraints changed.
  restart() {
    if (this._running && !this._is_extra(this._current)) {
      return this._open(this._current);
    }
    return Promise.resolve(this._stream);
  }

  _open(device_id) {
    let generation = ++this._generation;
    this._release();
    if (!CameraSource.available()) {
      // The extra choices (if any) can still be picked
      this._current = '';
      this._fill_picker();
      this._trouble(CameraSource.unavailable_message());
      return Promise.resolve(null);
    }
    let video = Object.assign({}, this.options.constraints ? this.options.constraints() : {});
    if (device_id) {
      video.deviceId = {exact: device_id};
    }
    return navigator.mediaDevices.getUserMedia({video: video})
      .catch((err) => {
        if (device_id && (err.name == 'OverconstrainedError' || err.name == 'NotFoundError')) {
          // The remembered camera isn't here any more; take whichever there is.
          delete video.deviceId;
          return navigator.mediaDevices.getUserMedia({video: video});
        }
        throw err;
      })
      .then((stream) => {
        if (generation != this._generation || !this._running) {
          stream.getTracks().forEach((track) => { track.stop(); });
          return null;
        }
        this._stream = stream;
        this.video.srcObject = stream;
        let tracks = stream.getVideoTracks();
        this._current = (tracks.length > 0 && tracks[0].getSettings().deviceId) || device_id || '';
        this._fill_picker();
        if (this.options.on_stream) {
          this.options.on_stream(stream);
        }
        return stream;
      })
      .catch((err) => {
        if (generation == this._generation) {
          console.error('Camera trouble', err);
          this._trouble($("<p/>").text(CameraSource.describe_error(err)));
        }
        return null;
      });
  }

  static describe_error(err) {
    switch (err.name) {
    case 'NotAllowedError':
      return 'Camera access is blocked.  Allow the camera for this site in the browser, then reload the page.';
    case 'NotFoundError':
      return 'No camera was found.';
    case 'NotReadableError':
      return 'The camera is in use by another app, or not working.';
    default:
      return 'Camera trouble: ' + err.name + (err.message ? ' (' + err.message + ')' : '');
    }
  }

  // Stops the current local stream, if any.
  _release() {
    let stream = this._stream;
    if (!stream) {
      return;
    }
    this._stream = null;
    if (this.options.on_stream_ending) {
      this.options.on_stream_ending(stream);
    }
    stream.getTracks().forEach((track) => { track.stop(); });
    if (this.video.srcObject === stream) {
      this.video.srcObject = null;
    }
  }

  _on_pick() {
    let value = this.picker.val();
    this._remember(value);
    if (this._is_extra(value)) {
      ++this._generation;
      this._release();
      this._choose_extra(value);
    } else {
      this._open(value);
    }
  }

  _choose_extra(value) {
    this._current = value;
    if (this.options.on_extra_choice) {
      this.options.on_extra_choice(value);
    }
  }

  _on_device_change() {
    if (!this._running) {
      return;
    }
    this._local_cameras().then((cameras) => {
      this._fill_picker_with(cameras);
      if (this._is_extra(this._current) || !this._current) {
        return;
      }
      if (!cameras.some((cam) => cam.deviceId == this._current)) {
        if (this.options.on_device_lost) {
          this.options.on_device_lost();
        }
        this._open(null);
      }
    });
  }

  // The names of this device's cameras, as far as known (names only show
  // once the browser has allowed a camera).
  device_labels() {
    return this._labels || [];
  }

  // With options.prefer_label (a camera's name, chosen elsewhere, e.g. on the
  // Kiosk Dashboard): once the names are known, switch to that camera, if
  // it's here and isn't already the one in use.  Tried once per CameraSource.
  _maybe_use_preferred(cameras) {
    let want = this.options.prefer_label;
    if (!want || this._tried_preferred || !this._running || this._is_extra(this._current)) {
      return;
    }
    let cam = cameras.find((c) => c.label == want);
    if (!cam) {
      return;  // Not here (or names not known yet): keep what we have
    }
    this._tried_preferred = true;
    if (cam.deviceId != this._current) {
      this._open(cam.deviceId);
    }
  }

  _local_cameras() {
    return navigator.mediaDevices.enumerateDevices()
      .then((devices) => devices.filter((d) => d.kind == 'videoinput'))
      .catch(() => []);
  }

  // (Also notes the cameras' names, for device_labels(), with or without a
  // picker to show them in.)
  _fill_picker() {
    if (!CameraSource.available()) {
      this._fill_picker_with([]);
      return;
    }
    this._local_cameras().then((cameras) => { this._fill_picker_with(cameras); });
  }

  _fill_picker_with(cameras) {
    this._labels = cameras.map((cam) => cam.label).filter((label) => label);
    this._maybe_use_preferred(cameras);
    if (!this.picker) {
      return;
    }
    this.picker.empty();
    cameras.forEach((cam, i) => {
      this.picker.append($("<option/>").val(cam.deviceId).text(cam.label || ('Camera ' + (i + 1))));
    });
    this.extra_choices.forEach((extra) => {
      this.picker.append($("<option/>").val(extra.value).text(extra.label));
    });
    this.picker.val(this._current);
    if (typeof mobile_select_refresh == 'function') {
      mobile_select_refresh(this.picker);
    }
  }

  _is_extra(value) {
    return this.extra_choices.some((extra) => extra.value == value);
  }

  _storage_key() {
    return this.options.remember_as ? 'derbynet-camera-' + this.options.remember_as : null;
  }

  _remembered() {
    let key = this._storage_key();
    if (!key) {
      return null;
    }
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  _remember(value) {
    let key = this._storage_key();
    if (!key) {
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
    }
  }

  _trouble(message) {
    if (this.options.on_trouble) {
      this.options.on_trouble(message);
    }
  }
}

// Photo shapes are given as width / height (3:4 portrait = 0.75).  0 means
// "whatever shape the camera gives".

// The largest rectangle of the given shape centered in a w x h picture.
function photo_crop_rect(w, h, aspect) {
  if (!aspect) {
    return {x: 0, y: 0, width: w, height: h};
  }
  if (w / h > aspect) {
    let cw = Math.round(h * aspect);
    return {x: Math.round((w - cw) / 2), y: 0, width: cw, height: h};
  }
  let ch = Math.round(w / aspect);
  return {x: 0, y: Math.round((h - ch) / 2), width: w, height: ch};
}

function canvas_to_jpeg(canvas, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob && blob.size > 0) {
        resolve(blob);
      } else {
        reject(new Error('Photo capture failed.'));
      }
    }, 'image/jpeg', quality);
  });
}

// Takes a still from a playing <video> at the camera's full resolution,
// cropped to the given shape.  Resolves to a JPEG Blob.
function capture_still(video, aspect) {
  let w = video.videoWidth;
  let h = video.videoHeight;
  if (!w || !h) {
    return Promise.reject(new Error("The camera isn't showing a picture yet."));
  }
  let r = photo_crop_rect(w, h, aspect);
  let canvas = document.createElement('canvas');
  canvas.width = r.width;
  canvas.height = r.height;
  canvas.getContext('2d').drawImage(video, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
  return canvas_to_jpeg(canvas);
}
