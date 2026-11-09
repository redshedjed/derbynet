// Awards Editor (awards-editor.php): one row per award, in award order --
// a drag handle, the name (a text box), type and group (dropdowns), the
// winner, and Edit.  The boxes are locked until Edit, which unlocks them in
// place and offers Save, Cancel and Delete.  The add row below the list is
// in the same format.  While voting is open (#all_awards[data-locked=1])
// nothing can be changed.

function classid_to_class(classid, classes) {
  if (!classid || classid == 0) return "";  // (none: the whole pack)
  for (var i = 0; i < classes.length; ++i) {
    if (classes[i].classid == classid) {
      return classes[i].name;
    }
  }
  return "";
}

function awards_locked() {
  return $("#all_awards").attr('data-locked') == '1';
}

// The award's group as the group dropdown's value: "classid,rankid", with 0
// for none
function class_and_rank_value(award) {
  return (award.classid ? award.classid : 0) + ',' + (award.rankid ? award.rankid : 0);
}

function show_message(text) {
  $("#awards_message").text(text || '');
}

// One row, for one award (filled in by fill_award_row)
function make_award_row() {
  var row = $('<li class="grid-card card-row award-card"></li>');
  row.append('<span class="drag-handle" title="Drag to move">&#x22EE;&#x22EE;</span>');
  row.append($('<input type="text" class="award-name not-mobile" readonly="readonly"/>')
             .attr('aria-label', 'Award name'));
  row.append($('<select class="award-type not-mobile" disabled="disabled"/>')
             .attr('aria-label', 'Award type')
             .html($("#quick_award_type").html()));
  row.append($('<select class="award-group not-mobile" disabled="disabled"/>')
             .attr('aria-label', 'Award for')
             .html($("#quick_award_group").html()));
  row.append('<span class="award-winner"><span class="badge badge-success"></span></span>');
  var buttons = $('<span class="row-buttons"/>').appendTo(row);
  if (!awards_locked()) {
    buttons.append($('<input type="button" class="btn btn-secondary btn-sm edit-button" value="Edit"/>')
                   .on('click', function() { start_editing(row); }));
    buttons.append($('<input type="button" class="btn btn-sm save-button" value="Save"/>')
                   .on('click', function() { save_award(row); }));
    buttons.append($('<input type="button" class="btn btn-secondary btn-sm cancel-button" value="Cancel"/>')
                   .on('click', function() { stop_editing(row, /* restore */ true); }));
    buttons.append($('<input type="button" class="btn btn-danger btn-sm delete-button" value="Delete"/>')
                   .on('click', function() { delete_award(row); }));
    // Enter saves, Escape cancels
    row.find('input.award-name').on('keydown', function(e) {
      if (!row.hasClass('editing')) return;
      if (e.key == 'Enter') { save_award(row); return false; }
      if (e.key == 'Escape') { stop_editing(row, true); return false; }
    });
  }
  return row;
}

function fill_award_row(row, award, data) {
  row.attr('data-awardid', award.awardid)
    .data('award', award);
  row.find('.award-name').val(award.awardname);
  row.find('.award-type').val(award.awardtypeid);
  row.find('.award-group').val(class_and_rank_value(award));
  var recipient = (award.firstname + ' ' + award.lastname).trim();
  row.find('.award-winner .badge').text(recipient).toggleClass('hidden', recipient == '');
}

function update_awards(data) {
  var awards = data.awards;
  // A row being edited keeps what's been typed into it
  var editing = $("#all_awards .award-card.editing").attr('data-awardid');
  $("#all_awards").empty();
  for (var i = 0; i < awards.length; ++i) {
    var row = make_award_row().appendTo("#all_awards");
    fill_award_row(row, awards[i], data);
  }
  if (editing) {
    var row = $("#all_awards .award-card[data-awardid='" + editing + "']");
    if (row.length) start_editing(row);
  }
}

function start_editing(row) {
  // One at a time
  $("#all_awards .award-card.editing").each(function() { stop_editing($(this), true); });
  row.addClass('editing');
  row.find('.award-name').prop('readonly', false).focus().select();
  row.find('select').prop('disabled', false);
  $("#all_awards").sortable('disable');
  show_message('');
}

// restore: put back the award's saved values
function stop_editing(row, restore) {
  if (restore && row.data('award')) {
    var award = row.data('award');
    row.find('.award-name').val(award.awardname);
    row.find('.award-type').val(award.awardtypeid);
    row.find('.award-group').val(class_and_rank_value(award));
  }
  row.removeClass('editing');
  row.find('.award-name').prop('readonly', true);
  row.find('select').prop('disabled', true);
  if (!awards_locked()) {
    $("#all_awards").sortable('enable');
  }
}

function award_action(data, row) {
  $.ajax(g_action_url,
         {type: 'POST',
          data: data,
          success: function(json) {
            if (json.outcome && json.outcome.summary == 'failure') {
              show_message(json.outcome.description);
            } else {
              show_message('');
              if (row) row.removeClass('editing');
            }
            if (json.hasOwnProperty('awards')) {
              update_awards(json);
            }
          }
         });
}

function save_award(row) {
  var name = row.find('.award-name').val().trim();
  if (name == '') {
    show_message('An award needs a name.');
    return;
  }
  award_action({action: 'award.edit',
                awardid: row.attr('data-awardid'),
                name: name,
                awardtypeid: row.find('.award-type').val(),
                class_and_rank: row.find('.award-group').val()},
               row);
  stop_editing(row, false);
}

function delete_award(row) {
  if (confirm('Delete the award "' + row.find('.award-name').val() + '"?')) {
    award_action({action: 'award.delete', awardid: row.attr('data-awardid')});
  }
}

// The add row: a name, a type and a group, and Add
function handle_quick_add_award() {
  var name = $("#quick_award_name").val().trim();
  if (name == '') {
    $("#quick_award_name").focus();
    return false;
  }
  $.ajax(g_action_url,
         {type: 'POST',
          data: {action: 'award.edit',
                 awardid: 'new',
                 name: name,
                 awardtypeid: $("#quick_award_type").val(),
                 class_and_rank: $("#quick_award_group").val()},
          success: function(json) {
            if (json.outcome && json.outcome.summary == 'failure') {
              show_message(json.outcome.description);
            } else {
              show_message('');
              $("#quick_award_name").val('').focus();
            }
            if (json.hasOwnProperty('awards')) {
              update_awards(json);
            }
          }
         });
  return false;
}

$(function() {
  // Drag an award by its handle to move it (not while locked or editing)
  $("#all_awards").sortable({
    items: '> .award-card',
    handle: '.drag-handle',
    disabled: awards_locked(),
    axis: 'y',
    stop: function(event, ui) {
      var data = {action: 'award.order'};
      $("#all_awards .award-card").each(function (i) {
        data['awardid_' + (i + 1)] = $(this).attr('data-awardid');
      });
      award_action(data);
    }});

  $.ajax(g_action_url,
         {type: 'GET',
          data: {query: 'award.list',
                 adhoc: '0'},
          success: function(data) {
            update_awards(data);
          }
         });
});
