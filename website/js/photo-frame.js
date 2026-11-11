'use strict';

// Framing for racer and car photos.  Assumes camera-source.js (photo_crop_rect,
// canvas_to_jpeg) and css/photo-frame.css.
//
// PhotoFrameOverlay draws the photo's frame and a silhouette over a live
// <video>, so the shot can be lined up before it's taken.  The area outside
// the frame is darkened; that's the part capture_still() will cut off.
//
// crop_photo_file() shows a still photo (e.g., from the phone's own camera
// app) under the same frame, lets the user drag the frame into place, and
// returns the framed part.

class PhotoFrameOverlay {
  // The video's parent element gets the photo-frame-host class: it must be
  // the video's offsetParent, and clips the darkened surround.
  constructor(video) {
    this.video = video;
    this.aspect = 0;
    let host = $(video.parentElement).addClass('photo-frame-host');
    this.frame = $("<div class='photo-frame hidden'><img class='photo-silhouette' alt=''/></div>")
      .appendTo(host);

    let relayout = () => { this.layout(); };
    video.addEventListener('loadedmetadata', relayout);
    video.addEventListener('resize', relayout);  // The stream's size changed
    if (window.ResizeObserver) {
      new ResizeObserver(relayout).observe(video);
    }
    window.addEventListener('resize', relayout);
  }

  // repo is 'head' or 'car'; aspect is width / height, or 0 for the whole picture.
  show(repo, aspect) {
    this.aspect = aspect;
    this.frame.find('img').attr('src', 'img/silhouette-' + repo + '.svg');
    this.frame.removeClass('hidden');
    this.layout();
  }

  hide() {
    this.frame.addClass('hidden');
  }

  layout() {
    if (this.frame.hasClass('hidden')) {
      return;
    }
    let v = this.video;
    let vw = v.videoWidth, vh = v.videoHeight;
    let ew = v.clientWidth, eh = v.clientHeight;
    if (!vw || !vh || !ew || !eh) {
      this.frame.css('visibility', 'hidden');
      return;
    }
    // A <video> shows its picture "contained": scaled to fit, centered.
    let scale = Math.min(ew / vw, eh / vh);
    let ox = v.offsetLeft + v.clientLeft + (ew - vw * scale) / 2;
    let oy = v.offsetTop + v.clientTop + (eh - vh * scale) / 2;
    let r = photo_crop_rect(vw, vh, this.aspect);
    this.frame.css({visibility: 'visible',
                    left: ox + r.x * scale,
                    top: oy + r.y * scale,
                    width: r.width * scale,
                    height: r.height * scale});
  }
}

// Longest side of a photo cropped from a still; phone cameras can be far
// bigger than any display needs, and uploads have a size limit.
const k_max_photo_edge = 4000;

function decode_photo_file(file) {
  // 'from-image' applies the photo's EXIF rotation; older browsers that don't
  // know the option reject it, so try again without.
  return createImageBitmap(file, {imageOrientation: 'from-image'})
    .catch(() => createImageBitmap(file));
}

// Resolves to a JPEG Blob of the framed part of the photo, or to null if the
// user cancels.  repo ('head' or 'car') picks the silhouette.
function crop_photo_file(file, aspect, repo) {
  return decode_photo_file(file).then((bitmap) => new Promise((resolve) => {
    let sheet = $("<div class='crop-sheet'>"
                  + "<div class='crop-stage'>"
                  + "<canvas></canvas>"
                  + "<div class='photo-frame crop-frame'><img class='photo-silhouette' alt=''/></div>"
                  + "<div class='crop-hint'>Drag the frame to line up the photo</div>"
                  + "</div>"
                  + "<div class='crop-controls'>"
                  + "<label class='crop-size'>Size <input type='range' min='30' max='100' value='100'/></label>"
                  + "<div class='crop-buttons'>"
                  + "<button type='button' class='btn btn-secondary crop-cancel'>Cancel</button>"
                  + "<button type='button' class='btn crop-use'>Use Photo</button>"
                  + "</div>"
                  + "</div>"
                  + "</div>")
        .appendTo('body');
    let stage = sheet.find('.crop-stage');
    let canvas = sheet.find('canvas')[0];
    let frame = sheet.find('.crop-frame');
    let slider = sheet.find('input[type=range]');
    frame.find('img').attr('src', 'img/silhouette-' + repo + '.svg');

    let bw = bitmap.width, bh = bitmap.height;
    let full = photo_crop_rect(bw, bh, aspect);  // Biggest frame that fits
    // The frame, in photo pixels: its center, and its size relative to full.
    let cx = bw / 2, cy = bh / 2, size = 1;
    let k = 1;  // Display pixels per photo pixel

    function frame_w() { return full.width * size; }
    function frame_h() { return full.height * size; }
    function clamp() {
      cx = Math.min(Math.max(cx, frame_w() / 2), bw - frame_w() / 2);
      cy = Math.min(Math.max(cy, frame_h() / 2), bh - frame_h() / 2);
    }

    function draw() {
      let sw = stage.width(), sh = stage.height();
      k = Math.min(sw / bw, sh / bh);
      let dw = Math.round(bw * k), dh = Math.round(bh * k);
      let dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(dw * dpr);
      canvas.height = Math.round(dh * dpr);
      canvas.style.width = dw + 'px';
      canvas.style.height = dh + 'px';
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      place_frame();
    }
    function place_frame() {
      clamp();
      frame.css({left: canvas.offsetLeft + (cx - frame_w() / 2) * k,
                 top: canvas.offsetTop + (cy - frame_h() / 2) * k,
                 width: frame_w() * k,
                 height: frame_h() * k});
    }

    let drag = null;
    stage.on('pointerdown', (event) => {
      drag = {x: event.clientX, y: event.clientY, cx: cx, cy: cy};
      stage[0].setPointerCapture(event.pointerId);
    });
    stage.on('pointermove', (event) => {
      if (drag) {
        cx = drag.cx + (event.clientX - drag.x) / k;
        cy = drag.cy + (event.clientY - drag.y) / k;
        place_frame();
      }
    });
    stage.on('pointerup pointercancel', () => { drag = null; });
    slider.on('input', () => {
      size = slider.val() / 100;
      place_frame();
    });
    $(window).on('resize.cropsheet', draw);

    function finish(result) {
      $(window).off('resize.cropsheet');
      sheet.remove();
      bitmap.close();
      resolve(result);
    }
    sheet.find('.crop-cancel').on('click', () => { finish(null); });
    sheet.find('.crop-use').on('click', () => {
      clamp();
      let sx = cx - frame_w() / 2, sy = cy - frame_h() / 2;
      let shrink = Math.min(1, k_max_photo_edge / Math.max(frame_w(), frame_h()));
      let out = document.createElement('canvas');
      out.width = Math.round(frame_w() * shrink);
      out.height = Math.round(frame_h() * shrink);
      out.getContext('2d').drawImage(bitmap, sx, sy, frame_w(), frame_h(), 0, 0, out.width, out.height);
      canvas_to_jpeg(out).then(finish, () => finish(null));
    });

    draw();
  }));
}
