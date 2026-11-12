'use strict';

// Photo Stand (photo-stand.php).  Assumes camera-source.js, photo-frame.js,
// and g_photo_aspects ({head: w/h, car: w/h}) from the page.
//
// A barcode scanner types like a keyboard: the barcode's characters, then
// Enter.  A racer's barcode starts with PWD.  When one is scanned:
//   - "As soon as a barcode is scanned": the photo is taken, then uploaded
//   - "3 seconds after scanning": a countdown first, to get set
//   - "With the Space bar...": the photo was already taken (Space, or the
//     Take Photo button), and the scan says whose it is
// The racer can be checked in at the same time.  A photo that doesn't upload
// waits in the "Not uploaded" list to be retried.
//
// Settings barcodes, for a stand with no keyboard or screen nearby:
//   PWDcheckin-ON, PWDcheckin-OFF   check in each racer scanned
//   PWDcrop-ON, PWDcrop-OFF         crop racer photos to the face
//   PWDspeedtest                    time a few uploads to the server

var g_stand = {
  settings: {repo: 'head', when: 'now', checkin: false, autocrop: false, speak: true},
  busy: false,   // Taking a photo (or counting down to it)
  held: null,    // In Space mode: {blob, url}, the photo waiting for a barcode
  failed: [],    // {code, repo, blob, url, reason}
  sending: 0,    // Uploads under way
  uploaded: 0,   // Photos uploaded since the page loaded
};
var g_stand_camera = null;
var g_stand_overlay = null;

// ---------------- Settings ----------------
//
// photo-stand.php keeps them in this browser, set on the page.  As a kiosk
// (g_stand_kiosk), they come from the Kiosk Dashboard; a settings barcode
// changes one here until the dashboard next changes it.

const k_stand_settings_key = 'derbynet-photo-stand';

function load_stand_settings() {
  if (window.g_stand_kiosk) {
    apply_kiosk_settings(g_stand_kiosk);
    return;
  }
  try {
    let saved = JSON.parse(window.localStorage.getItem(k_stand_settings_key) || '{}');
    Object.assign(g_stand.settings, saved);
  } catch (e) {
  }
}

// Kiosk parameters => settings, for those it names
function apply_kiosk_settings(params) {
  let s = g_stand.settings;
  if (params.repo == 'head' || params.repo == 'car') {
    s.repo = params.repo;
  }
  if (['now', 'countdown', 'space'].indexOf(params.when) >= 0) {
    s.when = params.when;
  }
  ['checkin', 'autocrop', 'speak'].forEach(function(key) {
    if (typeof params[key] == 'boolean') {
      s[key] = params[key];
    }
  });
}

function save_stand_settings() {
  if (window.g_stand_kiosk) {
    return;
  }
  try {
    window.localStorage.setItem(k_stand_settings_key, JSON.stringify(g_stand.settings));
  } catch (e) {
  }
}

// In words, for a kiosk's screen and its status on the Kiosk Dashboard
function describe_stand_settings() {
  let s = g_stand.settings;
  return [s.repo == 'car' ? 'Car photos' : 'Racer photos',
          {now: 'taken as soon as a barcode is scanned',
           countdown: 'taken 3 seconds after scanning',
           space: 'taken with Space, then scanned'}[s.when],
          s.checkin ? 'checking racers in' : 'no check-in',
          s.repo == 'head' && s.autocrop ? 'cropped to the face' : '']
    .filter(function(x) { return x; }).join(', ');
}

function show_stand_settings() {
  let s = g_stand.settings;
  $("#stand-managed-text").text(describe_stand_settings());
  $("input[name=stand-repo][value=" + s.repo + "]").prop('checked', true);
  $("#stand-when").val(s.when);
  $("#stand-checkin").prop('checked', s.checkin);
  $("#stand-autocrop").prop('checked', s.autocrop);
  $("#stand-speak").prop('checked', s.speak);
  $("#take-photo-row").toggleClass('hidden', s.when != 'space');
  // Autocrop finds a face, so it's for racer photos only
  $("#stand-autocrop").prop('disabled', s.repo != 'head');
  if (g_stand_overlay) {
    g_stand_overlay.show(s.repo, g_photo_aspects[s.repo]);
  }
  if (s.when != 'space') {
    drop_held_photo();
  }
  set_ready_status();
}

// ---------------- Feedback: on screen, sounds, and speech ----------------

function set_status(kind, text) {
  $("#stand-status").removeClass('ready working good bad').addClass(kind).text(text);
}

function set_ready_status() {
  if (g_stand.held) {
    set_status('ready', 'Scan a barcode to assign the photo');
  } else if (g_stand.settings.when == 'space') {
    set_status('ready', 'Press Space to take a photo');
  } else {
    set_status('ready', 'Ready: scan a racer\'s barcode');
  }
}

function play_sound(name) {
  try {
    new Audio('sounds/' + name + '.mp3').play().catch(function() {});
  } catch (e) {
  }
}

function say(text) {
  if (g_stand.settings.speak && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}

// ---------------- The barcode scanner ----------------

var g_scan_buffer = '';
var g_scan_last_key = 0;

function on_stand_keydown(event) {
  // Typing into a box (none on this page now, but just in case)
  if ($(event.target).is('input[type=text], input[type=number], textarea')) {
    return;
  }
  if (event.key == ' ') {
    event.preventDefault();
    if (g_stand.settings.when == 'space') {
      take_and_hold();
    }
    return;
  }
  let now = Date.now();
  if (now - g_scan_last_key > 2000) {
    g_scan_buffer = '';  // A pause: whatever was typed before isn't part of this
  }
  g_scan_last_key = now;
  if (event.key == 'Enter') {
    event.preventDefault();
    let code = g_scan_buffer.trim();
    g_scan_buffer = '';
    if (code) {
      on_barcode(code);
    }
  } else if (event.key.length == 1) {
    g_scan_buffer += event.key;
  }
}

function on_barcode(code) {
  console.log('Scanned', code);
  switch (code) {
  case 'PWDcheckin-ON':
  case 'PWDcheckin-OFF':
    g_stand.settings.checkin = code.endsWith('ON');
    save_stand_settings();
    show_stand_settings();
    set_status('good', 'Check-in is ' + (g_stand.settings.checkin ? 'on' : 'off'));
    say('Check in ' + (g_stand.settings.checkin ? 'on' : 'off'));
    return;
  case 'PWDcrop-ON':
  case 'PWDcrop-OFF':
    g_stand.settings.autocrop = code.endsWith('ON');
    save_stand_settings();
    show_stand_settings();
    set_status('good', 'Cropping to the face is ' + (g_stand.settings.autocrop ? 'on' : 'off'));
    say('Cropping ' + (g_stand.settings.autocrop ? 'on' : 'off'));
    return;
  case 'PWDspeedtest':
    speed_test();
    return;
  }
  if (!code.startsWith('PWD')) {
    set_status('bad', 'Not a racer barcode: ' + code);
    play_sound('dundundunnn');
    say('Unrecognized bar code');
    return;
  }
  if (g_stand.busy) {
    return;  // Still taking the last one
  }

  let repo = g_stand.settings.repo;
  if (g_stand.settings.when == 'space') {
    if (!g_stand.held) {
      set_status('bad', 'Take the photo first (Space), then scan');
      play_sound('dundundunnn');
      say('Take the photo first');
      return;
    }
    let held = g_stand.held;
    g_stand.held = null;
    $("#stand-held").addClass('hidden');
    send_photo(code, repo, held.blob, held.url);
  } else {
    take_photo(g_stand.settings.when == 'countdown' ? 3 : 0)
      .then(function(blob) { send_photo(code, repo, blob, URL.createObjectURL(blob)); },
            capture_failed);
  }
}

// ---------------- Taking photos ----------------

function capture_failed(err) {
  set_status('bad', 'Photo capture failed: ' + err.message);
  play_sound('dundundunnn');
  say('Photo capture failed');
}

// Resolves to the photo (a JPEG Blob), after a countdown of `seconds`.
function take_photo(seconds) {
  g_stand.busy = true;
  return new Promise(function(resolve) {
    let tick = function(n) {
      if (n > 0) {
        $("#stand-countdown").text(n).removeClass('hidden');
        set_status('working', 'Get ready...');
        setTimeout(function() { tick(n - 1); }, 1000);
      } else {
        $("#stand-countdown").addClass('hidden');
        resolve();
      }
    };
    tick(seconds);
  }).then(function() {
    let photo = capture_still(document.getElementById('stand-preview'),
                              g_photo_aspects[g_stand.settings.repo]);
    $("#stand-flash").stop(true).css('opacity', 0.8).animate({opacity: 0}, 500);
    play_sound('magic-wand');
    return photo;
  }).finally(function() {
    g_stand.busy = false;
  });
}

// Space mode: take the photo now, and keep it for the next barcode.
function take_and_hold() {
  if (g_stand.busy) {
    return;
  }
  take_photo(0).then(function(blob) {
    drop_held_photo();
    g_stand.held = {blob: blob, url: URL.createObjectURL(blob)};
    $("#stand-held-img").attr('src', g_stand.held.url);
    $("#stand-held").removeClass('hidden');
    set_ready_status();
    say('Photo taken');
  }, capture_failed);
}

function drop_held_photo() {
  if (g_stand.held) {
    URL.revokeObjectURL(g_stand.held.url);
    g_stand.held = null;
  }
  $("#stand-held").addClass('hidden');
}

// ---------------- Check-in and upload ----------------

// Resolves to a description of the racer ("Car 101, Ann Smith"), or the
// barcode if the racer can't be found.
function describe_racer(code) {
  return new Promise(function(resolve) {
    $.ajax('action.php',
           {type: 'GET',
            data: {query: 'racer.list', barcode: code},
            success: function(data) {
              let r = data.racers && data.racers.length == 1 ? data.racers[0] : null;
              resolve(r ? {text: 'Car ' + r.carnumber + ', ' + r.firstname + ' ' + r.lastname,
                           name: r.firstname + ' ' + r.lastname}
                      : {text: code, name: ''});
            },
            error: function() { resolve({text: code, name: ''}); }});
  });
}

function post_form_once(data, query) {
  return new Promise(function(resolve) {
    $.ajax('action.php' + (query ? '?query=' + query : ''),
           {type: 'POST',
            data: data,
            contentType: data instanceof FormData ? false : undefined,
            processData: !(data instanceof FormData),
            success: function(reply) { resolve(reply); },
            error: function(xhr, status, err) {
              resolve({outcome: {summary: 'failure', code: 'network',
                                 description: 'No answer from the server (' + (err || status) + ')'}});
            }});
  });
}

// As a kiosk, the right to upload comes from kiosk.php when it shows this
// page (inc/kiosk-grants.inc).  If that's been lost (say, the server forgot
// the session), loading kiosk.php again, unseen, grants it again; then try
// once more.
function post_form(data, query) {
  return post_form_once(data, query).then(function(reply) {
    if (!window.g_stand_kiosk || typeof g_kiosk_address == 'undefined' ||
        !reply.outcome || reply.outcome.code != 'notauthorized') {
      return reply;
    }
    return new Promise(function(resolve) {
      $.ajax('kiosk.php', {type: 'GET', data: {address: g_kiosk_address, inner: 1},
                           complete: function() { resolve(); }});
    }).then(function() { return post_form_once(data, query); });
  });
}

function outcome_ok(reply) {
  return reply && reply.outcome && reply.outcome.summary == 'success';
}

function outcome_text(reply) {
  if (reply && reply.outcome && reply.outcome.code == 'notauthorized') {
    return 'Not logged in any more';
  }
  return (reply && reply.outcome && reply.outcome.description) || 'Unknown problem';
}

// Resolves when done, whether the upload worked or not.
function send_photo(code, repo, blob, url) {
  ++g_stand.sending;
  return send_photo_inner(code, repo, blob, url)
    .finally(function() { --g_stand.sending; });
}

function send_photo_inner(code, repo, blob, url) {
  set_status('working', 'Uploading...');
  // PWDuploadonly: a photo for no particular racer, so nobody to check in
  let checkin = g_stand.settings.checkin && code != 'PWDuploadonly';
  return describe_racer(code).then(function(racer) {
    set_status('working', 'Uploading ' + racer.text + '...');
    let checked_in = checkin
        ? post_form({action: 'racer.pass', barcode: code, value: 1})
        : Promise.resolve(null);
    return checked_in.then(function(checkin_reply) {
      let form = new FormData();
      form.append('action', 'photo.upload');
      form.append('repo', repo);
      form.append('barcode', code);
      if (repo == 'head' && g_stand.settings.autocrop) {
        form.append('autocrop', '1');
      }
      form.append('photo', blob, 'stand-' + repo + '-' + code + '.jpg');
      return post_form(form, 'photo.upload-stand').then(function(reply) {
        if (!outcome_ok(reply)) {
          add_failed(code, repo, blob, url, outcome_text(reply));
          set_status('bad', racer.text + ': not uploaded (' + outcome_text(reply) + ')');
          play_sound('dundundunnn');
          say('Upload failed');
          return;
        }
        URL.revokeObjectURL(url);
        ++g_stand.uploaded;
        if (checkin_reply && !outcome_ok(checkin_reply)) {
          set_status('bad', racer.text + ': photo uploaded, but check-in failed ('
                     + outcome_text(checkin_reply) + ')');
          play_sound('dundundunnn');
          say('Upload okay but check-in failed');
        } else {
          set_status('good', racer.text + ': photo uploaded' + (checkin_reply ? ', checked in' : ''));
          play_sound('tada-fanfare-f');
          say(checkin_reply && racer.name ? 'Checked in ' + racer.name : 'Upload complete');
        }
        setTimeout(function() {
          if ($("#stand-status").hasClass('good')) {
            set_ready_status();
          }
        }, 6000);
      });
    });
  });
}

// ---------------- Photos that didn't upload ----------------

function add_failed(code, repo, blob, url, reason) {
  g_stand.failed.push({code: code, repo: repo, blob: blob, url: url, reason: reason});
  show_failed();
}

function show_failed() {
  let list = $("#stand-failed-list").empty();
  g_stand.failed.forEach(function(f, i) {
    let item = $("<li/>")
        .append($("<img/>").attr('src', f.url).attr('alt', ''))
        .append($("<div class='stand-failed-text'/>")
                .append($("<b/>").text(f.code + (f.repo == 'car' ? ' (car)' : ' (racer)')))
                .append($("<div/>").text(f.reason)))
        .append($("<button type='button' class='btn btn-secondary btn-sm'>Retry</button>")
                .on('click', function() { retry_failed(i); }))
        .append($("<button type='button' class='btn btn-secondary btn-sm'>Remove</button>")
                .on('click', function() {
                  if (confirm('Throw away the photo for ' + f.code + '?')) {
                    URL.revokeObjectURL(f.url);
                    g_stand.failed.splice(i, 1);
                    show_failed();
                  }
                }));
    list.append(item);
  });
  $("#stand-failed").toggleClass('hidden', g_stand.failed.length == 0);
}

function retry_failed(i) {
  let f = g_stand.failed.splice(i, 1)[0];
  show_failed();
  send_photo(f.code, f.repo, f.blob, f.url);
}

function retry_all_failed() {
  let all = g_stand.failed;
  g_stand.failed = [];
  show_failed();
  // One after another, so the status shows each
  all.reduce(function(prev, f) {
    return prev.then(function() { return send_photo(f.code, f.repo, f.blob, f.url); });
  }, Promise.resolve());
}

// ---------------- Speed test ----------------

// Times uploads of 0.5, 1 and 2 MB (deleted by the server: barcode
// PWDuploadtest), to see whether the network will keep up.
function speed_test() {
  if (g_stand.busy) {
    return;
  }
  g_stand.busy = true;
  set_status('working', 'Testing upload speed...');
  say('Beginning speed test');
  let sizes = [512 * 1024, 1024 * 1024, 2048 * 1024];
  let results = [];
  sizes.reduce(function(prev, size) {
    return prev.then(function() {
      let bytes = new Uint8Array(size);
      for (let off = 0; off < size; off += 65536) {
        crypto.getRandomValues(bytes.subarray(off, Math.min(size, off + 65536)));
      }
      let form = new FormData();
      form.append('action', 'photo.upload');
      form.append('repo', 'car');
      form.append('barcode', 'PWDuploadtest');
      form.append('photo', new Blob([bytes], {type: 'image/jpeg'}), 'upload-test.jpg');
      let start = performance.now();
      return post_form(form, 'photo.speedtest').then(function(reply) {
        let secs = (performance.now() - start) / 1000;
        results.push({ok: outcome_ok(reply), kbps: Math.round(size / 1024 / secs)});
      });
    });
  }, Promise.resolve()).then(function() {
    g_stand.busy = false;
    let ok = results.filter(function(r) { return r.ok; });
    if (ok.length == 0) {
      set_status('bad', 'Speed test: uploads failed');
      play_sound('dundundunnn');
      say('Speed test failed');
      return;
    }
    let kbps = Math.min.apply(null, ok.map(function(r) { return r.kbps; }));
    let verdict = kbps > 200 ? 'good' : (kbps > 50 ? 'fair' : 'poor');
    set_status(verdict == 'poor' ? 'bad' : 'good',
               'Upload speed: ' + kbps + ' KB per second (' + verdict + ')');
    play_sound(verdict == 'good' ? 'tada-fanfare-f' : (verdict == 'fair' ? 'saddertrombones' : 'dundundunnn'));
    say(kbps + ' kilobytes per second');
  });
}

// ---------------- Starting up ----------------

$(function() {
  load_stand_settings();
  let preview = document.getElementById('stand-preview');
  g_stand_overlay = new PhotoFrameOverlay(preview);
  let kiosk = window.g_stand_kiosk;
  g_stand_camera = new CameraSource({
    video: preview,
    // As a kiosk, the camera is chosen on the Kiosk Dashboard, by name
    picker: kiosk ? null : $("#stand-device"),
    remember_as: kiosk ? null : 'photo-stand',
    prefer_label: kiosk ? kiosk.device : null,
    // Ask for the camera's best resolution
    constraints: () => ({width: {ideal: 3840}}),
    on_stream: function() {
      $("#no-camera-warning").addClass('hidden');
      set_ready_status();
    },
    on_trouble: function(message) {
      $("#no-camera-warning").empty().append(message).removeClass('hidden');
      set_status('bad', 'No camera');
      say('No camera found');
    },
  });
  show_stand_settings();
  g_stand_camera.start();

  $("input[name=stand-repo]").on('change', function() {
    g_stand.settings.repo = $(this).val();
    save_stand_settings();
    show_stand_settings();
  });
  $("#stand-when").on('change', function() {
    g_stand.settings.when = $(this).val();
    save_stand_settings();
    show_stand_settings();
  });
  $("#stand-checkin, #stand-autocrop, #stand-speak").on('change', function() {
    g_stand.settings[this.id.substring('stand-'.length)] = this.checked;
    save_stand_settings();
  });
  // A focused control would otherwise take the scanner's keystrokes (a
  // <select> changes its choice as letters are typed).
  $("#stand-settings select, #stand-settings input").on('change', function() { this.blur(); });
  $("#stand-take").on('click', function() { this.blur(); take_and_hold(); });
  $("#stand-retry-all").on('click', retry_all_failed);
  $(document).on('keydown', on_stand_keydown);

  // Checking in tells the Kiosk Dashboard (and Settings) how the stand is
  // doing, and keeps the login from lapsing while it sits idle.
  stand_check_in();
  setInterval(stand_check_in, 5000);

  if (kiosk && typeof KioskPoller != 'undefined') {
    // New settings from the Kiosk Dashboard take effect at once; a different
    // camera means starting over.
    KioskPoller.param_callback = function(params) {
      if ((params.device || '') != (kiosk.device || '')) {
        if (KioskPoller.can_reload()) {
          location.reload();
        }
        return;
      }
      if (JSON.stringify(params) != JSON.stringify(g_stand_kiosk)) {
        g_stand_kiosk = params;
        apply_kiosk_settings(params);
        show_stand_settings();
      }
    };
    // Photos still to upload hold off a reload (a new page for this kiosk)
    KioskPoller.can_reload = function() {
      return g_stand.failed.length == 0 && g_stand.sending == 0 && !g_stand.held;
    };
  }
});

function stand_status() {
  if (!g_stand_camera || !g_stand_camera.stream()) {
    return 'No camera';
  }
  let waiting = g_stand.failed.length + g_stand.sending;
  return describe_stand_settings() + '. ' + g_stand.uploaded
    + (g_stand.uploaded == 1 ? ' photo' : ' photos') + ' uploaded'
    + (waiting ? ', ' + waiting + ' waiting' : '');
}

function stand_check_in() {
  $.ajax('action.php',
         {type: 'POST',
          data: {action: 'replay.poll',
                 client: (window.g_stand_kiosk && typeof g_kiosk_address != 'undefined')
                   ? 'kiosk-' + g_kiosk_address : tab_stand_id(),
                 kind: 'stand',
                 name: 'Photo stand',
                 status: stand_status(),
                 devices: JSON.stringify(g_stand_camera ? g_stand_camera.device_labels() : [])}});
}

// For photo-stand.php: the same id after a reload of this tab
function tab_stand_id() {
  try {
    let id = window.sessionStorage.getItem('derbynet-id-stand');
    if (!id) {
      id = 'stand-' + Math.random().toString(36).substring(2, 14);
      window.sessionStorage.setItem('derbynet-id-stand', id);
    }
    return id;
  } catch (e) {
    return 'stand-page';
  }
}
