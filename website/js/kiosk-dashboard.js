var g_unclaimed_scene_kiosk_names;

function on_new_kiosk_window_button() {
  window.open("kiosk.php?address=localhost+" + (100000 + Math.floor(Math.random() * 100000)), "_blank");
}
$(function() { $("#new_kiosk_window_button").on('click', on_new_kiosk_window_button); });

// "Make this device a display": log this device out (displays run without a
// login), then go to the kiosk or camera page.
function on_start_display_button(event) {
  var href = $(event.currentTarget).attr('data-href');
  $.ajax('action.php',
         {type: 'POST',
          data: {action: 'role.login', name: '', password: ''},
          complete: function() { window.location.href = href; }
         });
}
$(function() { $("#start_display input[data-href]").on('click', on_start_display_button); });


//////////////////////////////////////////////////////////////////////////
// Polling for kiosk dashboard
//////////////////////////////////////////////////////////////////////////
function poll_kiosk_all() {
  $.ajax(g_action_url,
         {type: 'GET',
          data: {query: 'poll.kiosk.all'},
          success: function(data) {
            if (data["cease"]) {
              window.location.href = '../index.php';
              return;  // Without setting the next timeout
            }
            setTimeout(poll_kiosk_all, 2000);
            process_polled_data(data);
          },
          error: function() {
            setTimeout(poll_kiosk_all, 2000);
          }
         });
}

$(function() { poll_kiosk_all(); });


//////////////////////////////////////////////////////////////////////////
// Construct dynamic elements for kiosk dashboard
//////////////////////////////////////////////////////////////////////////
// The polling rate for the page is relatively fast, and each time
// causes a rewrite of everything for all the kiosks.  If the user has
// opened the <select> element for choosing a page to present on a
// kiosk, rewriting the control will cause the user's action to be
// ignored.  To combat this, we only update the kiosk groups when
// there's a detectable change, and for that, we keep a hash of what
// the last state of the kiosk data was.
var g_kiosk_hash = -1;

function hash_string(hash, str) {
  for (i = 0; i < str.length; i++) {
	var ch = str.charCodeAt(i);
	hash = ((hash<<5)-hash)+ch;
	hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function process_polled_data(data) {
  if (data.hasOwnProperty('outcome') && data.outcome.summary != 'success') {
    console.log('Failure:', data.outcome);
    return;
  }
  var pages = data['kiosk-pages'];
  var kiosks = data['kiosks'];
  for (var i = 0; i < kiosks.length; ++i) {
    kiosks[i].parameters = kiosks[i].hasOwnProperty('parameters') && kiosks[i].parameters
      ? JSON.parse(kiosks[i].parameters) : {};
  }

  if (data.hasOwnProperty('current-scene')) {
    current_scene = data['current-scene'];
    if (current_scene != g_current_scene) {
      g_current_scene = current_scene;
      // The scene dropdown is in the banner
      $("#banner-scene-select").val(g_current_scene == '' ? -1 : g_current_scene);
    }
  }

  var hash = 0;
  for (var i = 0; i < kiosks.length; ++i) {
    var kiosk = kiosks[i];
    hash = hash_string(hash, kiosk.name);
    hash = hash_string(hash, kiosk.address);
    hash = hash_string(hash, kiosk.last_contact);
    hash = hash_string(hash, kiosk.page);
    hash = hash_string(hash, JSON.stringify(kiosk.parameters));
    hash = hash_string(hash, JSON.stringify(kiosk.stations || []));

    $("#kiosk_control_group .kiosk_control .reload p.reloading").eq(i)
      .toggleClass('hidden', !kiosk.reload);
  }
  if (hash != g_kiosk_hash) {
    g_kiosk_hash = hash;
    generate_kiosk_control_group(pages, kiosks);
    $("#kiosk_control_group").trigger("create");
    update_kiosk_names(kiosks);
  }
}

// pages: array of {brief:, path:}
// kiosks: array of {name:, address:, madlib: last_contact:, page:, parameters:}
function generate_kiosk_control_group(pages, kiosks) {
  $("#kiosk_control_group").empty();
  if (kiosks.length == 0) {
    $("#kiosk_control_group").append(
      "<p class='notice notice-info'><b>No kiosks yet.</b>  On a TV or display, open"
        + " DerbyNet and use <b>Make this device a display</b> below, or open a"
        + " <b>New Kiosk Window</b> here.</p>");
  } else {
    for (var i = 0; i < kiosks.length; ++i) {
      generate_kiosk_control(i, kiosks[i], pages);
    }
  }
}

function update_kiosk_names(kiosks) {
  var name_count = 0;
  for (var i = 0; i < kiosks.length; ++i) {
    if (kiosks[i].name != '') {
      ++name_count;
    }
  }
  $("#scenes-status-message")
    .text(name_count + " named kiosk" + (name_count == 1 ? "" : "s")
          + (name_count < kiosks.length ? " out of " + kiosks.length : ""))
    .toggleClass('red-text', name_count < kiosks.length);
}

// Generates a block of controls for a single kiosk.
// index is just a sequential counter used for making unique control names.
// kiosk describes the kiosk's state: {name:, address:, madlib:, last_contact:, age:, page:, parameters:}
// pages is an array of {path:, brief:} objects, as produced by parse_kiosk_pages.
function generate_kiosk_control(index, kiosk, pages) {
  // A card per kiosk (css/kiosk-dashboard.css lays out the three parts):
  // who it is, what it's showing, and Reload.
  var kiosk_control = $("<div class='card card-accent accent-during kiosk_control'/>");

  // Who: the assigned name, or its number ("Kiosk 427") until one is assigned
  var kiosk_ident = $("<div class='kiosk-ident'/>");
  kiosk_ident.append("<p class='kiosk_names'><span class='kiosk_control_name'></span>"
                     + " <span class='kiosk_control_address'></span></p>");
  kiosk_ident.find(".kiosk_control_name").text(kiosk.name);
  kiosk_ident.find(".kiosk_control_address")
    .text(kiosk.madlib).toggleClass("de-emphasize", kiosk.name.length > 0);
  if (kiosk.name.length == 0) {
    kiosk_ident.find(".kiosk_names").append(" <span class='badge'>No name</span>");
  }
  if (kiosk.age > 5) {
    kiosk_ident.append(
      $("<p class='last_contact'/>")
        .append($("<span class='badge badge-warning'/>").text("No contact for " + kiosk.age + "s")));
  }
  // A track camera, photo stand or replay display says how it's doing
  station_status_lines(kiosk_ident, kiosk);
  kiosk_ident.appendTo(kiosk_control);

  // Assign (a location, as its name) and Reload, side by side at the right
  kiosk_control.append($("<div/>").addClass('reload')
                       .append($("<input type='button' class='btn btn-secondary btn-sm' value='Assign'/>")
                               .attr('title', 'Give this display a location (Kiosk Editor) as its name')
                               .on('click', function() {
                                 show_kiosk_naming_modal(kiosk.address ? kiosk.address.toString() : '',
                                                         kiosk.name);
                               }))
                       .append($("<input type='button' class='btn btn-secondary btn-sm'"
                                 + " value='Reload' onclick='reload_kiosk(this)'/>")
                               .attr('kiosk-address', kiosk.address))
                       .append($("<p class='reloading'>Reloading&hellip;</p>")
                               .toggleClass('hidden', !kiosk.reload)));

  var kiosk_select = $("<div class='kiosk-select'/>");
  kiosk_select.append("<label for=\"kiosk-page-" + index + "\">Displaying</label>");
  var sel = $("<select id=\"kiosk-page-" + index + "\" name=\"kiosk-page-" + index + "\""
              + " data-kiosk-address=\"" + kiosk.address + "\"" 
              + " onchange=\"handle_assign_kiosk_page_change(this)\""
              + "/>");
  for (var i = 0; i < pages.length; ++i) {
    opt = $("<option value=\"" + pages[i].full + "\">" + pages[i].brief + "</option>");
    if (kiosk.page == pages[i].full) {
      opt.prop("selected", true);
    }
    sel.append(opt);
  }

  sel.appendTo(kiosk_select);
  mobile_select(sel);

  var kiosk_config_handler = g_kiosk_page_handlers[kiosk.page.replace("\\", "/")];
  if (kiosk_config_handler) {
    if ('decorate' in kiosk_config_handler) {
      kiosk_config_handler.decorate(kiosk_select, kiosk.parameters,
                                    function(params) {
                                      post_new_params(kiosk, params);
                                    },
                                    // (So a camera page can offer this
                                    // kiosk's own cameras)
                                    kiosk);
    }
  }

  kiosk_select.appendTo(kiosk_control);
  
  kiosk_control.appendTo("#kiosk_control_group");
}

//////////////////////////////////////////////////////////////////////////
// Controls for assigning pages to kiosks
//////////////////////////////////////////////////////////////////////////

// The scene is changed from the banner's dropdown (inc/banner.inc), which
// announces the result: show the kiosks' new pages right away.
$(function() {
  document.addEventListener('derbynet-scene-applied', function(event) {
    process_polled_data(event.detail);
  });
});

// sel is the <select data-kiosk-address> input element
function handle_assign_kiosk_page_change(sel) {
  $.ajax(g_action_url,
         {type: 'POST',
          data: {action: 'kiosk.assign',
                 address: sel.getAttribute('data-kiosk-address'),
                 page: sel.value},
          success: function(data) {
            process_polled_data(data);
          },
         });
}

function on_click_preferred_name(event) {
  console.log(event.target);
  console.log($(event.target).text());
  $("#kiosk_name_field").val($(event.target).text()).trigger("focus");
  return false;
}

function show_kiosk_naming_modal(address, name) {
  $("#kiosk_name_field").val(name);
  $("#preferred_kiosk_names").empty();
  for (var i = 0; i < g_all_scene_kiosk_names.length; ++i) {
    $("#preferred_kiosk_names")
      .append($("<div class='kiosk-name-prefill-button'/>").text(g_all_scene_kiosk_names[i])
              .on('click', on_click_preferred_name));
  }
  $("#preferred_kiosk_names").trigger('create');
  show_modal("#kiosk_modal", $("#kiosk_name_field"), function(event) {
    handle_name_kiosk(address, $("#kiosk_name_field").val());
    return false;
  });
}

function handle_name_kiosk(address, name) {
  close_modal("#kiosk_modal");
  $.ajax(g_action_url,
         {type: 'POST',
          data: {action: 'kiosk.assign',
                 address: address,
                 name: name},
          success: function(data) {
            process_polled_data(data);
          },
         });
}

//////////////////////////////////////////////////////////////////////////
// Controls for the kiosk parameter for classes (please_check_in display)
//////////////////////////////////////////////////////////////////////////

function post_new_params(kiosk, new_params) {
  $.ajax(g_action_url,
         {type: 'POST',
          data: {action: 'kiosk.assign',
                 address: kiosk.address,
                 params: JSON.stringify(new_params)},
          success: function(data) {
            console.log('After post_new_params:', data);
            process_polled_data(data);
          },
         });
}

function reload_kiosk(btn) {
  $.ajax(g_action_url,
         {type: 'POST',
          data: {action: 'kiosk.reload',
                 address: $(btn).attr('kiosk-address')},
          success: function() {
            console.log('kiosk.reload for ' + $(btn).attr('kiosk-address'));
            $(btn).closest(".reload").find("p.reloading").removeClass('hidden');
          },
         });
}
