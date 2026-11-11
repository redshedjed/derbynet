'use strict';

// Settings > Cameras: the track cameras (in replay order, each switched on or
// off, with optional tuning of its own), and the replay displays.  Refreshed
// every few seconds, so cameras appear as they connect.  Changes are saved at
// once (action track-camera.edit), not through the settings form.

// The Race Dashboard's replay settings, which "Default" stands for
var g_replay_defaults = {skipback: 4000, showings: 2, rate: 50};

const k_length_choices = [2500, 3000, 3500, 4000, 4500, 5000, 6000];  // ms
const k_showings_choices = [1, 2, 3];
const k_rate_choices = [10, 25, 50, 75, 100];  // percent

function describe_length(ms) { return (ms / 1000).toFixed(1) + ' s'; }
function describe_showings(n) { return n + (n == 1 ? ' time' : ' times'); }
function describe_rate(pct) { return (pct / 100) + 'x'; }

function describe_age(seconds) {
  if (seconds < 60) {
    return seconds + ' s ago';
  } else if (seconds < 3600) {
    return Math.round(seconds / 60) + ' min ago';
  }
  return 'over an hour ago';
}

// A <select> whose first choice, 0, means "the Race Dashboard's setting"
function tuning_select(field, value, choices, describe, default_value) {
  let select = $("<select class='not-mobile'/>").attr('data-field', field);
  select.append($("<option/>").val(0).text('Default (' + describe(default_value) + ')'));
  choices.forEach(function(c) {
    select.append($("<option/>").val(c).text(describe(c)));
  });
  if (value && choices.indexOf(value) < 0) {
    // A value set some other way: keep it showing
    select.append($("<option/>").val(value).text(describe(value)));
  }
  select.val(value || 0);
  return select;
}

function client_status_cell(client) {
  let cell = $("<td class='camera-status'/>");
  if (!client) {
    cell.append($("<span class='status-dot off'/>")).append(document.createTextNode('Never connected'));
  } else if (client.connected) {
    cell.append($("<span class='status-dot on'/>"))
      .append(document.createTextNode(client.status || 'Connected'));
  } else {
    cell.append($("<span class='status-dot off'/>"))
      .append(document.createTextNode('Not connected (last seen ' + describe_age(client.seconds) + ')'));
  }
  return cell;
}

function render_track_cameras(data) {
  if (!data.cameras) {
    return;
  }
  g_replay_defaults = data.defaults;
  // Don't rebuild the table under someone's hands
  if ($("#track-cameras-table select:focus, #track-cameras-table input:focus").length > 0) {
    return;
  }

  // The most recent check-in for each camera, and for each display, by name
  // (a page opened again elsewhere checks in afresh).
  let camera_clients = {};
  let display_clients = {};
  data.clients.forEach(function(c) {
    let by_name = c.kind == 'camera' ? camera_clients : display_clients;
    let prev = by_name[c.name];
    if (!prev || c.last_contact > prev.last_contact) {
      by_name[c.name] = c;
    }
  });
  let displays = Object.keys(display_clients).sort().map(function(n) { return display_clients[n]; });

  let tbody = $("#track-cameras-table tbody").empty();
  data.cameras.forEach(function(cam, i) {
    let row = $("<tr/>").attr('data-name', cam.name);
    row.append($("<td class='camera-order'/>")
               .append($("<button type='button' class='btn btn-secondary btn-sm' title='Earlier'>&#x25B2;</button>")
                       .prop('disabled', i == 0)
                       .on('click', function() { edit_track_camera(cam.name, {op: 'up'}); }))
               .append($("<button type='button' class='btn btn-secondary btn-sm' title='Later'>&#x25BC;</button>")
                       .prop('disabled', i == data.cameras.length - 1)
                       .on('click', function() { edit_track_camera(cam.name, {op: 'down'}); })));
    row.append($("<td class='camera-name'/>").text(cam.name));
    row.append($("<td/>").append(
      $("<input type='checkbox' class='not-mobile' title='Show this camera in replays'/>")
        .prop('checked', cam.enabled)
        .on('change', function() {
          edit_track_camera(cam.name, {op: 'update', enabled: this.checked ? 1 : 0});
        })));
    row.append($("<td/>").append(tuning_select('skipback', cam.skipback, k_length_choices,
                                               describe_length, g_replay_defaults.skipback)));
    row.append($("<td/>").append(tuning_select('showings', cam.showings, k_showings_choices,
                                               describe_showings, g_replay_defaults.showings)));
    row.append($("<td/>").append(tuning_select('rate', cam.rate, k_rate_choices,
                                               describe_rate, g_replay_defaults.rate)));
    row.append(client_status_cell(camera_clients[cam.name]));
    row.append($("<td/>").append(
      $("<button type='button' class='btn btn-secondary btn-sm'>Remove</button>")
        .on('click', function() {
          if (confirm('Remove the ' + cam.name + ' camera?  If it\'s still running, it will'
                      + ' come back when it next checks in.')) {
            edit_track_camera(cam.name, {op: 'delete'});
          }
        })));
    row.find('select').on('change', function() {
      let fields = {op: 'update'};
      fields[$(this).attr('data-field')] = $(this).val();
      edit_track_camera(cam.name, fields);
      $(this).trigger('blur');
    });
    tbody.append(row);
  });
  $("#no-track-cameras-yet").toggleClass('hidden', data.cameras.length > 0);

  let list = $("#replay-displays").empty();
  displays.forEach(function(d) {
    let item = $("<li/>").append($("<span class='status-dot'/>").addClass(d.connected ? 'on' : 'off'))
        .append($("<b/>").text(d.name || 'Replay display'));
    item.append(document.createTextNode(d.connected
                                        ? ': ' + (d.status || 'connected')
                                        : ': not connected (last seen ' + describe_age(d.seconds) + ')'));
    list.append(item);
  });
  if (displays.length == 0) {
    list.append($("<li/>").text('None yet.  Open replay.php on the computer driving a display.'));
  }
}

function refresh_track_cameras() {
  $.ajax('action.php',
         {type: 'GET',
          data: {query: 'replay.status'},
          success: render_track_cameras});
}

function edit_track_camera(name, fields) {
  $.ajax('action.php',
         {type: 'POST',
          data: Object.assign({action: 'track-camera.edit', name: name}, fields),
          success: function(data) {
            if (data.outcome && data.outcome.summary != 'success') {
              alert(data.outcome.description);
            }
            refresh_track_cameras();
          }});
}

function on_add_track_camera() {
  let name = $("#new-camera-name").val().trim();
  if (name) {
    $("#new-camera-name").val('');
    edit_track_camera(name, {op: 'add'});
  }
  return false;
}

$(function() {
  if ($("#track-cameras-table").length > 0) {
    refresh_track_cameras();
    setInterval(refresh_track_cameras, 3000);
  }
});
