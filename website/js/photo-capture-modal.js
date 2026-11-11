'use strict';

// The photo dialog on Race Check-In: a live camera with the photo's frame over
// it, or drop a picture file onto it.  Assumes camera-source.js and
// photo-frame.js, and g_photo_aspects ({head: w/h, car: w/h}) from the page.

// For the photo_modal dialog, this boolean controls whether the racer gets
// checked in as a side-effect of uploading a photo.  Set by the onclick of the
// two submit buttons.
var g_check_in;

// Default values for autocrop, depending on repo.  If user changes the setting,
// that setting endures for the repo for as long as the page is loaded.
var g_autocrop_head = true;
var g_autocrop_car = false;

function set_autocrop_state(repo) {
  $("#autocrop").prop('checked', repo == 'head' ? g_autocrop_head : g_autocrop_car);
}

function preserve_autocrop_state() {
  var repo = $("#photo_modal_repo").val();
  if (repo == 'head') {
    g_autocrop_head = $("#autocrop").prop('checked');
  } else {
    g_autocrop_car = $("#autocrop").prop('checked');
  }
}

// For #photo_drop form:
Dropzone.options.photoDrop = {
  paramName: 'photo',
  maxFiles: 1,
  maxFilesize: 8,
  url: 'action.php',
  acceptedFiles: 'image/*',
  // dropzone considers the upload successful as long as there was an HTTP response.  We need to look at the
  // message that came back and determine whether the file was actually accepted.
  sending: function(xhr, form_data) {
    preserve_autocrop_state();
  },
  success: function(file, data) {
    this.removeFile(file);

    if (data.hasOwnProperty('photo-url')) {
      var photo_url = data['photo-url'];
      $("#photo-" + $("#photo_modal_racerid").val()
        + " img[data-repo='" + $("#photo_modal_repo").val() + "']")
      .attr('src', photo_url);
    }

    close_modal("#photo_modal");
  },
};

// The camera is made the first time the dialog opens.  It runs only while the
// dialog is showing.
var g_checkin_camera = null;
var g_photo_overlay = null;

function checkin_camera() {
  if (!g_checkin_camera) {
    var preview = document.getElementById('preview');
    g_checkin_camera = new CameraSource({
      video: preview,
      picker: $("#device-picker"),
      remember_as: 'checkin',
      // Ask for the camera's best resolution.  (Asking for a height as well
      // makes some browsers offer a portrait 1080x1920.)
      constraints: () => ({width: {ideal: 3840}}),
      on_stream: () => { $("#no-camera-warning").addClass('hidden'); },
      on_trouble: (message) => {
        $("#no-camera-warning").empty().append(message).removeClass('hidden');
      },
    });
    g_photo_overlay = new PhotoFrameOverlay(preview);
  }
  return g_checkin_camera;
}

// Modals can close several ways (buttons, Escape, after an upload), so watch
// for the dialog being hidden and turn the camera off then.
var g_photo_modal_watch = null;
function stop_camera_when_photo_modal_closes() {
  var frame = $("#photo_modal").closest('.modal_frame');
  if (g_photo_modal_watch || frame.length == 0) {
    return;
  }
  g_photo_modal_watch = new MutationObserver(function() {
    if (frame.hasClass('hidden') && g_checkin_camera) {
      g_checkin_camera.stop();
    }
  });
  g_photo_modal_watch.observe(frame[0], {attributes: true, attributeFilter: ['class']});
}

function show_photo_modal(racerid, repo) {
  var firstname = $('#firstname-' + racerid).text();
  var lastname = $('#lastname-' + racerid).text();
  $("#racer_photo_name").text(firstname + ' ' + lastname);
  $("#racer_photo_repo").text(repo == 'head' ? 'racer' : 'car');
  $("#photo_modal_repo").val(repo);
  $("#photo_modal_racerid").val(racerid);

  set_autocrop_state(repo);

  $("#thumb-link").attr('href',
                        'photo-thumbs.php?repo=' + repo +
                        '&racerid=' + racerid +
                        '&back=checkin.php');

  // If the racer's already been checked in, don't offer "Capture & Check In" button
  $("#capture_and_check_in").toggleClass('hidden', $("#passed-" + racerid).prop('checked'));

  show_modal("#photo_modal", function() {
    preserve_autocrop_state();
    take_snapshot(racerid, repo, lastname + '-' + firstname);
    return false;
  });
  stop_camera_when_photo_modal_closes();

  checkin_camera().start();
  g_photo_overlay.show(repo, g_photo_aspects[repo]);
}

function show_racer_photo_modal(racerid) {
  show_photo_modal(racerid, 'head');
}
function show_car_photo_modal(racerid) {
  show_photo_modal(racerid, 'car');
}

function take_snapshot(racerid, repo, photo_base_name) {
  if (photo_base_name.length <= 1) {
    photo_base_name = 'photo';
  }

  // capture_still copies the picture before it returns, so the dialog (and
  // with it the camera) can close straight away.
  var capture = capture_still(document.getElementById('preview'), g_photo_aspects[repo]);
  close_modal("#photo_modal");

  capture.then(
    function(blob) {
      // g_check_in set by onclick method in submit buttons
      if (g_check_in) {
        $("#passed-" + racerid).prop('checked', true);
        $("#passed-" + racerid).trigger("change", true);

        $.ajax(g_action_url,
               {type: 'POST',
                data: {action: 'racer.pass',
                       racer: racerid,
                       value: 1},
               });
      }
      send_photo_blob(blob, racerid, repo, photo_base_name);
    },
    function(error) {
      // Upload failures are reported the same way, by dashboard-ajax.js
      alert("Photo capture failure: " + error.message);
    });
}

function send_photo_blob(blob, racerid, repo, photo_base_name) {
  // A standard file upload, as if from a form
  var form_data = new FormData();
  form_data.append('action', 'photo.upload');
  form_data.append('racerid', racerid);
  form_data.append('repo', repo);
  form_data.append('photo', blob, photo_base_name + ".jpg");
  if ($("#autocrop").prop('checked')) {
    form_data.append('autocrop', '1');
  }

  // Testing for <failure> elements occurs in dashboard-ajax.js
  $.ajax(g_action_url + "?query=photo.capture-canvas",
         {type: 'POST',
          data: form_data,
          contentType: false,
          processData: false,
          success: function(data) {
            if (data.hasOwnProperty('photo-url')) {
              var photo_url = data['photo-url'];
              $("#photo-" + racerid + " img[data-repo='" + repo + "']").attr('src', photo_url);
            }
          }
         });
}

function close_photo_modal() {
  close_modal("#photo_modal");
}
