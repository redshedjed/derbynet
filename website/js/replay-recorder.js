'use strict';

// Keeps the last few seconds of one camera's video in memory, and plays them
// back, usually slowed down.  One ReplayRecorder per camera.
//
//   let rec = new ReplayRecorder(stream, {length_ms: 4000});
//   rec.start();      // Records continuously, keeping the last length_ms
//   rec.play(canvas, {showings: 2, rate: 50})   // Stops recording; a Promise
//     .then(() => rec.start());
//   rec.close();      // Frees everything
//
// Frames are kept as ImageBitmaps no bigger than max_width x max_height
// (1280x720 unless told otherwise) and no faster than max_fps (30).  A 720p
// frame takes about 3.7MB, so a 4-second replay holds about 440MB, which
// leaves room for two cameras.

class ReplayRecorder {
  constructor(stream, options = {}) {
    this.stream = stream;
    this.length_ms = options.length_ms || 4000;
    this.max_width = options.max_width || 1280;
    this.max_height = options.max_height || 720;
    // A little slack, so a 30fps camera isn't caught at 15fps by jitter
    this.min_interval_ms = 1000 / (options.max_fps || 30) - 4;
    this.on_resize = options.on_resize || null;

    this.frames = [];  // {t: ms, bitmap}, oldest first
    this.recording = false;
    this.closed = false;
    // Bumped by start(): a frame that finishes copying after a restart is
    // thrown away.
    this._generation = 0;
    this._last_t = -Infinity;
    this._in_flight = 0;  // createImageBitmap calls not yet finished
    this._size = {width: 0, height: 0};
    this._captured_times = [];  // For the frame-rate reading

    // The recorder reads frames from its own (unseen) <video>.
    let video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;  // Without this, iOS refuses play()
    video.srcObject = stream;
    video.play().catch((err) => { console.log('Replay video play() rejected:', err); });
    this.video = video;
  }

  // Takes effect from the next frame; keeps what's already recorded.
  set_length(length_ms) {
    if (length_ms > 0) {
      this.length_ms = length_ms;
    }
  }

  // Starts recording afresh.
  start() {
    if (this.closed) {
      return;
    }
    this._discard_frames();
    ++this._generation;
    this.recording = true;
    this._last_t = -Infinity;
    requestAnimationFrame((now) => { this._tick(now, this._generation); });
  }

  // Stops recording, keeping what's been recorded.
  stop() {
    this.recording = false;
  }

  close() {
    this.recording = false;
    this.closed = true;
    this._discard_frames();
    this.video.srcObject = null;
  }

  // Frames actually captured per second, over the last second
  capture_fps() {
    let now = performance.now();
    return this._captured_times.filter((t) => now - t <= 1000).length;
  }

  // Size frames are being kept at
  frame_size() {
    return this._size;
  }

  // Seconds of video held
  held_ms() {
    let n = this.frames.length;
    return n < 2 ? 0 : this.frames[n - 1].t - this.frames[0].t;
  }

  _discard_frames() {
    this.frames.forEach((f) => { f.bitmap.close(); });
    this.frames = [];
  }

  // The frame size for a w x h picture: as big as it is, up to the maximum.
  _fit(w, h) {
    let scale = Math.min(1, this.max_width / w, this.max_height / h);
    return {width: Math.max(1, Math.round(w * scale)),
            height: Math.max(1, Math.round(h * scale))};
  }

  _tick(now, generation) {
    if (!this.recording || this.closed || generation != this._generation) {
      return;
    }
    let v = this.video;
    // Copying a frame is asynchronous; if copies are piling up, skip one
    // rather than fall further behind.
    if (v.videoWidth && v.videoHeight && now - this._last_t >= this.min_interval_ms &&
        this._in_flight < 3) {
      this._last_t = now;
      let size = this._fit(v.videoWidth, v.videoHeight);
      if (size.width != this._size.width || size.height != this._size.height) {
        this._size = size;
        if (this.on_resize) {
          this.on_resize(v.videoWidth, v.videoHeight);
        }
      }
      ++this._in_flight;
      createImageBitmap(v, {resizeWidth: size.width, resizeHeight: size.height,
                            resizeQuality: 'low'})
        .then((bitmap) => {
          --this._in_flight;
          if (!this.recording || this.closed || generation != this._generation) {
            bitmap.close();
            return;
          }
          this.frames.push({t: now, bitmap: bitmap});
          this._captured_times.push(performance.now());
          this._trim(now);
        }, (err) => {
          --this._in_flight;
          console.log('Replay frame not captured:', err);
        });
    }
    requestAnimationFrame((t) => { this._tick(t, generation); });
  }

  // Lets go of frames older than the replay needs.
  _trim(now) {
    let oldest = now - this.length_ms - 250;
    while (this.frames.length > 0 && this.frames[0].t < oldest) {
      this.frames.shift().bitmap.close();
    }
    let recent = performance.now() - 1000;
    while (this._captured_times.length > 0 && this._captured_times[0] < recent) {
      this._captured_times.shift();
    }
  }

  // Stops recording and plays the last length_ms on canvas, `showings` times
  // over, at `rate` percent of normal speed.  Resolves to true when done, or
  // false if there was nothing to play.
  play(canvas, {showings = 2, rate = 50} = {}) {
    this.stop();
    let end_t = this.frames.length > 0 ? this.frames[this.frames.length - 1].t : 0;
    let frames = this.frames.filter((f) => f.t >= end_t - this.length_ms);
    if (frames.length == 0 || showings < 1 || rate <= 0) {
      return Promise.resolve(false);
    }
    let ctx = canvas.getContext('2d');
    let first_t = frames[0].t;

    function draw(bitmap) {
      let scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
      let w = bitmap.width * scale, h = bitmap.height * scale;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    }

    return new Promise((resolve) => {
      let showing = 0;
      let start = null;  // Time this showing began
      let index = 0;
      let shown = -1;
      let step = (now) => {
        if (this.closed) {
          resolve(false);
          return;
        }
        if (start === null) {
          start = now;
        }
        // Where in the recording this moment of the (slowed) playback is
        let goal = first_t + (now - start) * rate / 100;
        while (index + 1 < frames.length && frames[index + 1].t <= goal) {
          ++index;
        }
        if (index != shown) {
          draw(frames[index].bitmap);
          shown = index;
        }
        if (goal >= frames[frames.length - 1].t) {
          ++showing;
          if (showing >= showings) {
            resolve(true);
            return;
          }
          start = null;
          index = 0;
          shown = -1;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}
