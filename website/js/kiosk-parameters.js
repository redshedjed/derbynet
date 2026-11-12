//////////////////////////////////////////////////////////////////////////
// Handling for setting specific kiosk pages' parameters
//////////////////////////////////////////////////////////////////////////

// "decorate" functions add controls (most often a "Configure" button) to the
// passed-in div for the kiosk.

// Things like modal dialogs are defined in kiosk-dashboard.php, and each kiosk
// page requiring parameter handling registers a page handler here.  Ideally
// we'd prefer that each kiosk page be able to supply its own arbitrary
// configuration UI, but this implementation isn't nearly that modular.
//
// TODO Find a better way to express this in javascript, so that each function
// has a definition and there's no need for all the 'in' testing at the call
// sites.
//
// A kiosk page handler defines a decorate method:
// // Adds any controls desired for custom configuration
// //    kiosk_div is the <div> to which the page handler should add any desired
// //        configuration controls (e.g., a Configure button that activates a
// //        modal dialog).
// //    parameters are the current parameter values for the kiosk page (if any)
// //    callback is a function to receive new parameter values (json) if they change
// decorate = function(kiosk_div, parameters, callback) {}

var g_kiosk_page_handlers = {};


// If there are any classids specified in the parameter, attach a <p> element to
// kiosk_div to describe the current setting.
function add_classids_description(parameters, kiosk_div) {
  if (parameters.hasOwnProperty('classids')) {
    var s = '';
    var classids = parameters.classids;
    for (var i = 0; i < classids.length; ++i) {
      s += ', ' + $("label[for='config-class-" + classids[i] + "']").text();
    }
    $('<p class="parameters"/>').text(s.substring(2)).appendTo(kiosk_div);
  }
}

// Update the UI controls to show the current set of classids
function populate_classids(parameters) {
  if (parameters.classids) {
    $("#config_classes_modal input[type='checkbox']").prop("checked", false);
    var classids = parameters.classids;
    for (var i = 0; i < classids.length; ++i) {
      $("#config-class-" + classids[i])
        .prop("checked", true);
    }
  } else {
    $("#config_classes_modal input[type='checkbox']").prop("checked", true);
  }
  $("#config_classes_modal input[type='checkbox']").each(function() {
    $(this).parent().toggleClass('checked', $(this).is(":checked"));
  });
  flipswitch_refresh($("#config_classes_modal input[type='checkbox']"));
}

// Extract classids from user's choices in the UI
function compute_classids() {
  var classids = [];
  $("#config_classes_modal input[type='checkbox']").each(function() {
    if ($(this).is(":checked")) {
      classids.push(parseInt($(this).data("classid")));
    }
  });

  return classids;
}


//////////////////////////////////////////////////////////////////////////
// please-check-in
//////////////////////////////////////////////////////////////////////////

function decorate_please_check_in(kiosk_div, parameters, callback) {
  $('<input type="button" class="btn btn-secondary btn-sm" value="Configure"/>')
    .on("click", /* selector */null, /* data: */{parameters: parameters, callback: callback},
        /* handler */ show_config_please_check_in)
    .appendTo(kiosk_div);
  add_classids_description(parameters, kiosk_div);
}

// Uses #config_classes_modal with slideshow-specific stuff turned off
function show_config_please_check_in(event) {
  $("#slideshow_div").addClass('hidden');
  populate_classids(event.data.parameters);
  show_modal("#config_classes_modal", function(ev) {
    close_modal("#config_classes_modal");
    event.data.callback({classids: compute_classids()});
    return false;
  });
}

g_kiosk_page_handlers['kiosks/please-check-in.kiosk'] = {
  // Parameters: {classids: [ classid, ... ] }
  decorate: function(kiosk_div, parameters, callback) {
    decorate_please_check_in(kiosk_div, parameters, callback);
  }
};

//////////////////////////////////////////////////////////////////////////
// slideshow
//////////////////////////////////////////////////////////////////////////
// Configuration function for parameters of {title:, classids: [...]}
function decorate_slideshow(kiosk_div, parameters, callback) {
  $('<input type="button" class="btn btn-secondary btn-sm" value="Configure"/>')
    .on("click", /* selector */null, /* data: */{parameters: parameters, callback: callback},
        /* handler */ show_config_slideshow_modal)
    .appendTo(kiosk_div);

  add_classids_description(parameters, kiosk_div);
}

// Uses #config_classes_modal with extra #slideshow_div turned on.
function show_config_slideshow_modal(event) {
  console.log('event.data', event.data);
  var parameters = event.data.parameters;
  $("#slideshow_div").removeClass('hidden');
  $("#title_text").val(parameters.title);
  $("#slideshow_subdir").val(parameters.subdir || '');
  mobile_select_refresh($("#slideshow_subdir"));
  populate_classids(parameters);
  show_modal("#config_classes_modal", function(ev) {
    close_modal("#config_classes_modal");
    event.data.callback({title: $("#title_text").val(),
                         subdir: $("#slideshow_subdir").length ? $("#slideshow_subdir").val() : '',
                         classids: compute_classids()});
    return false;
  });
}

g_kiosk_page_handlers['kiosks/slideshow.kiosk'] = {
  // Parameters: {title: (string), subdir: (string), classids: [ classid, ... ] }
  decorate: function(kiosk_div, parameters, callback) {
    decorate_slideshow(kiosk_div, parameters, callback);
  }
};

//////////////////////////////////////////////////////////////////////////
// standings
//////////////////////////////////////////////////////////////////////////
function handle_standings_change(ev) {
  var val = Number.parseInt($(ev.target).val());  // NaN on failure
  if (Number.isInteger(val) && val >= 0 && val < g_standings_choices.length) {
    ev.data.callback(g_standings_choices[val].value);
  }
}

function is_current_standings_choice(choice, parameters) {
  if (parameters.hasOwnProperty('key')) {
    return choice.value.key == parameters.key;
  } else if (parameters.hasOwnProperty('classid')) {
    return choice.value.classid == parameters.classid;
  } else if (parameters.hasOwnProperty('rankid')) {
    return choice.valud.rankid == parameters.rankid;
  } else {
    return false;
  }
}

g_kiosk_page_handlers['kiosks/standings.kiosk'] = {
  decorate: function(kiosk_div, parameters, callback) {
    var select_id = "standings-select-" + Math.floor(Math.random() * 1000);
    var div = $("<div class='kiosk-param-row'/>").appendTo(kiosk_div);
    div.append("<label for='" + select_id + "'>Standings for</label>");
    var select = $("<select id='" + select_id + "'/>")
        .on("change",
            /* data: */{parameters: parameters, callback: callback},
            /* handler */ handle_standings_change);
    select.appendTo(div);
    var value = -1;
    // parameters = {catalog_entry: {name:, key:, presentation: } }
    for (var i = 0; i < g_standings_choices.length; ++i) {
      var entry = g_standings_choices[i];  // 
      var opt = $("<option/>").attr('value', i).text(entry.name);
      if (is_current_standings_choice(entry, parameters)) {
        value = i;
      }
      select.append(opt);
    }
    if (value >= 0) {
      select.val(value);
    }
    mobile_select(select);
  }
};

//////////////////////////////////////////////////////////////////////////
// award-presentations
//////////////////////////////////////////////////////////////////////////
g_kiosk_page_handlers['kiosks/award-presentations.kiosk'] = {
    // Parameters: { confetti: (bool) }
  decorate: function(kiosk_div, parameters, callback) {
    var k_id = 'k-' + Math.floor(Math.random() * 10000);
    if (!parameters.hasOwnProperty('confetti')) {
      parameters.confetti = true;
    }
    var row = $("<div class='kiosk-param-row'/>").appendTo(kiosk_div);
    $('<label for="' + k_id + '">Confetti</label>').appendTo(row);
    var checkbox = $("<input type='checkbox' class='flipswitch'/>")
      .attr('id', k_id)
      .prop('checked',  parameters.confetti)
      .on("change", /*selector*/null, /*data*/{parameters: parameters, callback: callback},
          /*handler*/function (ev) {
            var checked = $(ev.target).is(':checked');
            ev.data.callback({confetti: checked});
          })
      .appendTo(row);
    // Controls added after page load have to be turned into switches here
    flipswitch(checkbox);
    }
};

//////////////////////////////////////////////////////////////////////////
// qrcode
//////////////////////////////////////////////////////////////////////////

function show_config_qrcode_modal(event) {
  var parameters = event.data.parameters;  // parameters are { title, content }
  $("#qrcode-content").val(g_url + "/vote.php");
  if (parameters) {
    if (parameters.title) {
      $("#qrcode-title").val(parameters.title);
    }
    if (parameters.content) {
      $("#qrcode-content").val(parameters.content);
    }
  }
  show_modal("#config_qrcode_modal", function(ev) {
    close_modal("#config_qrcode_modal");
    event.data.callback({title: $("#qrcode-title").val(),
                         content: $("#qrcode-content").val()});
    return false;
  });
}

g_kiosk_page_handlers['kiosks/qrcode.kiosk'] = {
    // Parameters: { title: (string) content: (url) }
  decorate: function(kiosk_div, parameters, callback) {
    $('<input type="button" class="btn btn-secondary btn-sm" value="Configure"/>')
      .on("click", /* selector */null, /* data: */{parameters: parameters, callback: callback},
          /* handler */ show_config_qrcode_modal)
      .appendTo(kiosk_div);
    }
};

//////////////////////////////////////////////////////////////////////////
// live-camera
//////////////////////////////////////////////////////////////////////////
g_kiosk_page_handlers['kiosks/live-camera.kiosk'] = {
  // Parameters: { camera: (name) }; none means the first track camera that's on
  decorate: function(kiosk_div, parameters, callback) {
    var select_id = "live-camera-select-" + Math.floor(Math.random() * 10000);
    var row = $("<div class='kiosk-param-row'/>").appendTo(kiosk_div);
    row.append($("<label/>").attr('for', select_id).text('Camera'));
    var select = $("<select/>").attr('id', select_id)
        .append($("<option value=''/>").text('First camera that\'s on'))
        .appendTo(row);
    select.on("change", function() {
      callback({camera: select.val()});
    });
    // The track cameras come from Settings > Cameras
    $.ajax('action.php',
           {type: 'GET',
            data: {query: 'replay.cameras'},
            success: function(data) {
              (data.cameras || []).forEach(function(cam) {
                select.append($("<option/>").val(cam.name)
                              .text(cam.name + (cam.enabled ? '' : ' (off)')));
              });
              if (parameters.camera) {
                if (select.find("option").filter(function() {
                      return $(this).val() == parameters.camera; }).length == 0) {
                  // Chosen once, since removed: keep showing it
                  select.append($("<option/>").val(parameters.camera)
                                .text(parameters.camera + ' (removed)'));
                }
                select.val(parameters.camera);
              }
              mobile_select(select);
            }});
  }
};

//////////////////////////////////////////////////////////////////////////
// track-camera and photo-stand: stations, managed from here
//////////////////////////////////////////////////////////////////////////

// The names of the cameras a kiosk has reported (Kiosk Dashboard only; the
// Scene Editor has no particular device in mind).
function kiosk_device_names(kiosk) {
  var names = [];
  ((kiosk && kiosk.stations) || []).forEach(function(station) {
    (station.devices || []).forEach(function(name) {
      if (names.indexOf(name) < 0) {
        names.push(name);
      }
    });
  });
  return names;
}

// A labelled <select> in its own row; on change, callback(value)
function station_select(kiosk_div, label, choices, value, callback) {
  var id = "station-select-" + Math.floor(Math.random() * 100000);
  var row = $("<div class='kiosk-param-row'/>").appendTo(kiosk_div);
  row.append($("<label/>").attr('for', id).text(label));
  var select = $("<select/>").attr('id', id).appendTo(row);
  choices.forEach(function(choice) {
    select.append($("<option/>").val(choice.value).text(choice.text));
  });
  select.val(value);
  select.on('change', function() { callback(select.val()); });
  mobile_select(select);
}

// Which of the kiosk's cameras to use, by name
function station_device_select(kiosk_div, parameters, callback, kiosk) {
  var names = kiosk_device_names(kiosk);
  if (parameters.device && names.indexOf(parameters.device) < 0) {
    names.push(parameters.device);  // Chosen before; not reported now
  }
  station_select(kiosk_div, 'Uses camera',
                 [{value: '', text: 'Its first camera'}].concat(
                   names.map(function(n) { return {value: n, text: n}; })),
                 parameters.device || '',
                 function(value) { callback(Object.assign({}, parameters, {device: value})); });
}

// A kiosk's station status lines (from its check-ins); see kiosk-dashboard.js
function station_status_lines(kiosk_div, kiosk) {
  ((kiosk && kiosk.stations) || []).forEach(function(station) {
    $("<p class='station-status'/>")
      .append($("<span class='status-dot'/>").addClass(station.connected ? 'on' : 'off'))
      .append(document.createTextNode(
        (station.kind == 'camera' ? station.name + ' camera: '
         : station.kind == 'stand' ? 'Photo stand: ' : 'Replays: ')
          + (station.connected ? station.status : 'not connected')))
      .appendTo(kiosk_div);
  });
}

g_kiosk_page_handlers['kiosks/track-camera.kiosk'] = {
  // Parameters: { name: (track camera name), device: (which camera, by name) }
  decorate: function(kiosk_div, parameters, callback, kiosk) {
    var id = "track-camera-name-" + Math.floor(Math.random() * 100000);
    var row = $("<div class='kiosk-param-row'/>").appendTo(kiosk_div);
    row.append($("<label/>").attr('for', id).text('Camera name'));
    $("<input type='text' maxlength='50' placeholder='Track'/>")
      .attr('id', id)
      .val(parameters.name || '')
      .on('change', function() {
        callback(Object.assign({}, parameters, {name: $(this).val().trim()}));
      })
      .appendTo(row);
    if (kiosk) {
      station_device_select(kiosk_div, parameters, callback, kiosk);
    }
  }
};

g_kiosk_page_handlers['kiosks/photo-stand.kiosk'] = {
  // Parameters: { repo: 'head' | 'car', when: 'now' | 'countdown' | 'space',
  //               checkin, autocrop, speak: (bool), device: (camera, by name) }
  decorate: function(kiosk_div, parameters, callback, kiosk) {
    var set = function(key, value) {
      var p = Object.assign({}, parameters);
      p[key] = value;
      callback(p);
    };
    station_select(kiosk_div, 'Photos of',
                   [{value: 'head', text: 'Racers'}, {value: 'car', text: 'Cars'}],
                   parameters.repo || 'head', function(v) { set('repo', v); });
    station_select(kiosk_div, 'Take the photo',
                   [{value: 'now', text: 'As soon as a barcode is scanned'},
                    {value: 'countdown', text: '3 seconds after scanning'},
                    {value: 'space', text: 'With the Space bar, then scan'}],
                   parameters.when || 'now', function(v) { set('when', v); });
    [['checkin', 'Check in each racer scanned', false],
     ['autocrop', 'Crop racer photos to the face', false],
     ['speak', 'Say what happened, out loud', true]].forEach(function(item) {
      var key = item[0];
      var on = typeof parameters[key] == 'boolean' ? parameters[key] : item[2];
      $("<div class='kiosk-param-row'/>")
        .append($("<label/>")
                .append($("<input type='checkbox'/>").prop('checked', on)
                        .on('change', function() { set(key, this.checked); }))
                .append(document.createTextNode(' ' + item[1])))
        .appendTo(kiosk_div);
    });
    if (kiosk) {
      station_device_select(kiosk_div, parameters, callback, kiosk);
    }
  }
};
