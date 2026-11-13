// Barcode scanner imposes a pretty high CPU load, so can be turned off
// while debugging other issues.
var g_decode_barcodes = true;

var g_trouble_timeout = 0;
function report_trouble(msg) {
  clearTimeout(g_trouble_timeout);
  $("#trouble").empty().text(msg).removeClass('hidden');
  g_trouble_timeout = setTimeout(close_trouble, 6000);
}

function close_trouble() {
  $("#trouble").addClass('hidden');
}

var g_hover_timeout = 0;
function announce_hover(msg) {
  clearTimeout(g_hover_timeout);
  $("#announce-hover").css('display', 'block').removeClass('hidden').text(msg);
  g_hover_timeout = setTimeout(close_announce_hover, 500);
}
function close_announce_hover() {
  $("#announce-hover").fadeOut(500, function() {
    $("#announce-hover").addClass('hidden'); });
}

function show_camera() {
  g_camera.start();
}

function using_landscape() {
  // This reports on the screen, not the viewport
  // return screen.availHeight < screen.availWidth;
  return window.innerHeight < window.innerWidth;
}

function before_show_slide_in() {
  if (using_landscape()) {
    $("#slide-in").css({'width': '0px',
                        'height': '100vh',
                        'display': 'none'});
  } else {
    $("#slide-in").css({'height': '0px',
                        'width': '100vw',
                        'display': 'none'});
  }
}
function show_slide_in(afterfn = false) {
  $("#slide-in").css('display', 'block');
  if (using_landscape()) {
    $("#controls-inner").css('margin-left', '0px');
    $("#slide-in").animate({width: $("#slide-in-inner").css('width')}, afterfn);
  } else {
    $("#controls-inner").css('margin-left',
                             ($("#controls").width() - $("#controls-inner").width()) / 2);
    $("#slide-in").animate({height: $("#slide-in-inner").css('height')}, afterfn);
  }
}
function hide_slide_in() {
  // If hiding the #slide-in div in response to a screen orientation change,
  // using_landscape() will report from the current orientation, not the one the
  // div was drawn for.
  var landscape = false;
  var offset = $("#slide-in").offset();
  if (offset.top == 0) {
    landscape = true;
  } else if (offset.left == 0) {
    landscape = false;
  } else {
    landscape = using_landscape();
  }

  if (landscape) {
    $("#slide-in").animate({width: '0px'},
                           function() {  $("#slide-in").css('display', 'none'); });
  } else {
    $("#slide-in").animate({height: '0px'},
                           function() {  $("#slide-in").css('display', 'none'); });
  }
}

function show_racer_list() {
  // The device-picker shows through #racer-list if it's not hidden, for reasons
  // I don't understand.
  $("#camera-div").addClass('hidden');
  $("#racer-list").show('slide', {direction: 'left'});
}
function hide_racer_list(afterfn = false) {
  $("#camera-div").removeClass('hidden');
  $("#racer-list").hide('slide', {direction: 'left'}, afterfn);
}

var codeReader = new ZXingBrowser.BrowserMultiFormatOneDReader();

var g_current_racer = {};
// One of:
//  - {} (empty) if no current racer is selected.
//  - { barcode: string }
//  - { racerid: racerid }


// The camera, which both scans barcodes and takes photos
var g_camera = null;
var g_photo_overlay = null;
// For the current stream: a Promise of the barcode scanner's controls
var g_scan = null;

$(function() {
  var preview = document.getElementById('preview');
  g_camera = new CameraSource({
    video: preview,
    picker: $("#device-picker"),
    remember_as: 'mcheckin',
    // Sharp enough for photos without making barcode scanning too slow.  For
    // the camera's full resolution, there's the Phone Camera button.
    constraints: () => ({width: {ideal: 1920}}),
    on_stream: start_scanning,
    on_stream_ending: stop_scanning,
    on_trouble: function(message) {
      // Stays up: there's nothing to scan with until it's sorted out
      clearTimeout(g_trouble_timeout);
      $("#trouble").empty().append(message).removeClass('hidden');
    },
  });
  g_photo_overlay = new PhotoFrameOverlay(preview);
  preview.addEventListener('loadedmetadata', layout_preview);
  preview.addEventListener('resize', layout_preview);

  $("#native-camera-input").on('change', on_native_photo_chosen);
});

function start_scanning(stream) {
  if (!g_decode_barcodes) {
    return;
  }
  // Scans whatever the <video> shows; stopping it leaves the video alone.
  g_scan = codeReader.decodeFromVideoElement(
    document.getElementById('preview'),
    function(result, error, control) {
      if (result) {
        console.log("Recognized barcode:", result);
        on_recognized_barcode(result);
      } else if (error && error.getKind() != "NotFoundException") {
        report_trouble("ZXing error: " + error.getKind() + "\n\n" +
                       error.toString());
        console.log('error', error.getKind(), error);
      }
    });
  g_scan.catch(function(err) { console.log('Barcode scanning failed to start', err); });
}

function stop_scanning() {
  if (g_scan) {
    g_scan.then(function(controls) { controls.stop(); }, function() {});
    g_scan = null;
  }
}

// The live picture fills the space below the camera picker, shown whole
// (object-fit: contain), so the photo frame drawn over it is all on screen.
function layout_preview() {
  var max_height = $("#camera-div").height() - $("#device-picker-div").outerHeight();
  $("#preview").css('height', Math.max(max_height, 0));
  if (g_photo_overlay) {
    g_photo_overlay.layout();
  }
}

function on_recognized_barcode(result) {
  if (g_photo_repo) {
    // Lining up a photo: a barcode in view isn't a request to switch racers
    return;
  }
  if (g_current_racer['barcode'] == result.text) {
    return;
  }
  if (!result.text.startsWith("PWD")) {
    console.log("Rejecting false barcode ", result.text);
    return;
  }
  g_current_racer = {barcode: result.text};

  before_show_slide_in();

  $("#flash-overlay").css({display: 'block'}).fadeOut(800);

  $.ajax('action.php',
         {type: 'GET',
          data: {query: 'racer.list',
                 barcode: result.text
                },
          success: function(json) {
            set_current_racer(json);
            show_slide_in();
          }
         });
}

// json is the result of a racer.list query with arguments intended to narrow to
// a single racer.
function set_current_racer(json) {
  // firstname, lastname, carnumber, carname, note_from, headshot, car_photo,
  // classid, class, rankid, rank, passed, seq
  if (json['racers'].length == 0) {
    report_trouble('No racer identified');
  } else {
    var racer = json['racers'][0];
    var details = [];
    if (racer.carnumber) details.push('Car ' + racer.carnumber);
    if (racer.carname) details.push(racer.carname);
    if (racer.partition) details.push(racer.partition);
    $("#racer-div").empty()
      .append($("<div class='racer-name'/>").text(racer.firstname + " " + racer.lastname))
      .append($("<div class='racer-details'/>").text(details.join(' · ')));
    update_thumbnail('head', racer.headshot);
    update_checked_in(racer.passed);
    update_thumbnail('car',  racer.carphoto);
  }
}


function dismiss_greetings() {
  $("#greetings-background").addClass('hidden');
  show_camera();
}

var g_autocrop = false;
function on_autocrop_button_click() {
  g_autocrop = ! g_autocrop;
  $("#autocrop-button").toggleClass('on', g_autocrop)
    .text(g_autocrop ? 'Crop: On' : 'Crop: Off');
  announce_hover('Autocrop is ' + (g_autocrop ? "ON" : "OFF"));
}

// While lining up a photo: 'head' or 'car'.  Otherwise null.
var g_photo_repo = null;

// Tapping the racer or car photo button frames the shot: the photo's shape and
// a silhouette over the live picture, with buttons to take it, or to use the
// phone's own camera app instead.
function capture_photo(repo) {
  if (!g_current_racer['barcode'] && !g_current_racer['racerid']) {
    report_trouble('No racer selected');
    return false;
  }
  g_photo_repo = repo;
  $("#photo-bar-label").text(repo == 'head' ? 'Racer photo' : 'Car photo');
  // Taking the photo from the live picture needs a working camera
  $("#take-photo-button").toggleClass('hidden', !g_camera.stream());
  $("#preview-overlay").addClass('hidden');
  $("#photo-bar").removeClass('hidden');
  g_photo_overlay.show(repo, g_photo_aspects[repo]);
  return false;
}

function leave_photo_mode() {
  g_photo_repo = null;
  g_photo_overlay.hide();
  $("#photo-bar").addClass('hidden');
  $("#preview-overlay").removeClass('hidden');
}

function on_take_photo_click() {
  var repo = g_photo_repo;
  var racer = Object.assign({}, g_current_racer);
  capture_still(document.getElementById('preview'), g_photo_aspects[repo])
    .then(function(blob) { upload_photo(racer, repo, blob); },
          function(err) { report_trouble(err.message); });
  $("#flash-overlay").css({display: 'block'}).fadeOut(400);
  leave_photo_mode();
}

function on_phone_camera_click() {
  // Opens the phone's camera app (or, on a computer, a file chooser)
  $("#native-camera-input").val('').trigger('click');
}

function on_native_photo_chosen() {
  var file = this.files && this.files[0];
  if (!file || !g_photo_repo) {
    return;
  }
  var repo = g_photo_repo;
  var racer = Object.assign({}, g_current_racer);
  crop_photo_file(file, g_photo_aspects[repo], repo)
    .then(function(blob) {
      if (blob) {
        upload_photo(racer, repo, blob);
        leave_photo_mode();
      }
      resume_camera();
    })
    .catch(function(err) {
      report_trouble("Couldn't open that photo: " + err.message);
      resume_camera();
    });
}

// Some phones stop the page's camera while their camera app is open.
function resume_camera() {
  var stream = g_camera.stream();
  if (CameraSource.available() && $("#camera-div").is(':visible') &&
      (!stream || stream.getVideoTracks().every(function(t) { return t.readyState == 'ended'; }))) {
    g_camera.restart();
  }
}

// racer is a copy of g_current_racer from when the photo was taken
function upload_photo(racer, repo, blob) {
  var photo_base_name = 'mobile-' + repo + '-' +
      // Only one of barcode and racerid will be populated
      (racer['barcode'] || '') + (racer['racerid'] || '');

  // A standard file upload, as if from a form
  var form_data = new FormData();
  form_data.append('action', 'photo.upload');
  if (racer['barcode']) {
    form_data.append('barcode', racer['barcode']);
  } else {
    form_data.append('racerid', racer['racerid']);
  }
  form_data.append('repo', repo);
  form_data.append('photo', blob, photo_base_name + ".jpg");
  if (g_autocrop && repo == 'head') {
    form_data.append('autocrop', '1');
  }

  $.ajax('action.php?query=photo.upload-mobile',
         {type: 'POST',
          data: form_data,
          contentType: false,
          processData: false,
          success: function(data) {
            if (data.outcome.summary != 'success') {
              report_trouble('Upload ' + data.outcome.code + ': ' + data.outcome.description);
              console.log('Failed upload', data);
            } else if (data.hasOwnProperty('thumbnail') &&
                       racer['barcode'] == g_current_racer['barcode'] &&
                       racer['racerid'] == g_current_racer['racerid']) {
              // (Unless they've moved on to another racer)
              update_thumbnail(repo, data['thumbnail']);
            }
          }
         });

  
  return false;
}


function update_thumbnail(repo, url) {
  if (!url) {
    url = (repo == 'head' ? 'img/photo-headshot.png' : 'img/photo-car.png');
  }

  $("#" + repo + "-button img.thumbnail").remove();
  $("<img/>").addClass('thumbnail').attr('src', url)
    .appendTo($("#" + repo + "-button .thumbnail-carrier"));
  // The stand-in pictures say "no photo yet"
  $("#" + repo + "-button").toggleClass('has-photo', url.indexOf('img/photo-') != 0);
}

function update_checked_in(passed) {
  $("#checkin-button").toggleClass('passed', passed);
  $("#checkin-button-text")
    .html(passed
          ? "<span class='checked-in-mark'>&#x2714;</span>"
            + "<span class='checked-in-status'>Checked in</span>"
            + "<span class='checked-in-hint'>Tap to undo</span>"
          : "<span class='checked-in-mark'>&#x25CB;</span>"
            + "<span class='checked-in-status'>Not checked in</span>"
            + "<span class='checked-in-hint'>Tap to check in</span>");
}

function on_checkin_button_click() {
  var was_passed = $("#checkin-button").hasClass('passed');
  var form_data = {action: 'racer.pass',
                   // New value will be opposite of what the control currently shows.
                   value: was_passed ? 0 : 1};
  if (g_current_racer['barcode']) {
    form_data['barcode'] = g_current_racer['barcode'];
  } else {
    form_data['racer'] = g_current_racer['racerid'];
  }
  $.ajax('action.php',
         {type: 'POST',
          data: form_data,
          success: function(json) {
            if (json.outcome.summary == 'success') {
              update_checked_in(!was_passed);
              announce_hover((!was_passed)
                             ? "Racer has PASSED inspection"
                             : "Racer has NOT PASSED inspection");
            } else {
              console.log(json);
              report_trouble(JSON.stringify(json, null, 2));
            }
          }
         });
}

function refresh_racer_list() {
  $.ajax('action.php',
         {type: 'GET',
          data: {query: 'racer.list'},
          success: function(json) {
            $("#racer-list ul").empty();
            for (var ri = 0; ri < json['racers'].length; ++ri) {
              var r = json['racers'][ri];
              var details = [];
              if (r['carnumber']) details.push('Car ' + r['carnumber']);
              if (r['partition']) details.push(r['partition']);
              var li = $("<li>").attr('racerid', r['racerid'])
                  .toggleClass('passed', r['passed'])
                  .append($("<span class='racer-name'/>").text(r['firstname'] + " " + r['lastname']))
                  .append($("<span class='racer-details'/>").text(details.join(' · ')))
                  .append($("<span class='racer-status'/>")
                          .text(r['passed'] ? 'Checked in' : 'Not checked in'))
                  .appendTo("#racer-list ul")
                  .on('click', function(event) {
                    on_racer_chosen_from_list($(event.currentTarget).attr('racerid'));
                  });
            }
            filter_racer_list();
          }});
}

// Shows only the racers matching the search box (name, car number or group)
function filter_racer_list() {
  var words = $("#racer-filter").val().toLowerCase().split(/\s+/).filter(w => w != '');
  var shown = 0;
  $("#racer-list li").each(function() {
    var text = $(this).text().toLowerCase();
    var match = words.every(w => text.indexOf(w) >= 0);
    $(this).toggleClass('hidden', !match);
    if (match) ++shown;
  });
  $("#racer-list-empty").toggleClass('hidden', shown > 0);
}

function on_racer_chosen_from_list(racerid) {
  g_current_racer = {racerid: racerid};
  hide_racer_list();
  show_camera();
  before_show_slide_in();

  $("#flash-overlay").css({display: 'block'}).fadeOut(800);

  $.ajax('action.php',
         {type: 'GET',
          data: {query: 'racer.list',
                 racerid: racerid
                },
          success: function(json) {
            set_current_racer(json);
            show_slide_in();
          }
         });
}

function on_switch_to_camera_cllicked() {
  update_thumbnail('head', '');
  update_thumbnail('car', '');
  before_show_slide_in();

  hide_racer_list(function() {
    show_camera();
  });
}


// Done (or "Racers" above the camera): back to the racer list.  The camera
// is turned off while the list is showing.
function on_done_click() {
  leave_photo_mode();
  if ($("#slide-in").is(':visible')) {
    hide_slide_in();
  }
  g_current_racer = {};
  stop_camera();

  refresh_racer_list();
  show_racer_list();
}

function stop_camera() {
  g_camera.stop();
}


// There may be multiple resize events too close together for visibility of
// #slide-in to work.
var g_restore_slidein_timeout = false;
function on_resize() {
  if ($("#camera-div").is(':visible')) {
    var slidein = (g_restore_slidein_timeout != false);
    console.log("on_resize sees g_restore_slidein_timeout", g_restore_slidein_timeout);
    clearTimeout(g_restore_slidein_timeout);
    if (!slidein && $("#slide-in").is(':visible')
        && $("#slide-in").width() > 0
        && $("#slide-in").height() > 0) {
      console.log("on_resize believes #slide_in is visible");
      slidein = true;
      hide_slide_in();
    }
    if (slidein) {
      g_restore_slidein_timeout = setTimeout(function() {
        console.log('Sliding in');
        before_show_slide_in();
        show_slide_in(function () { g_restore_slidein_timeout = false; });
      }, 500);
    }
    layout_preview();
  }
}

$(function() {
  // Without camera access (e.g., not on https), say so now.  The Phone Camera
  // button still works for photos.
  if (!CameraSource.available()) {
    $("#trouble").empty().append(CameraSource.unavailable_message()).removeClass('hidden');
  }
  $(window).on("resize", on_resize);
});
