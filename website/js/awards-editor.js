// TODO Ordering in the face of speed trophies?

function awardtypeid_to_awardtype(awardtypeid, awardtypes) {
  for (var i = 0; i < awardtypes.length; ++i) {
    if (awardtypes[i].awardtypeid == awardtypeid) {
      return awardtypes[i].awardtype;
    }
  }
  return "Can't resolve awardtypeid " + awardtypeid;
}

function classid_to_class(classid, classes) {
  if (!classid || classid == 0) return "";  // (none: the whole pack)
  for (var i = 0; i < classes.length; ++i) {
    if (classes[i].classid == classid) {
      return classes[i].name;
    }
  }
  return "Can't resolve classid " + classid;
}

function rankid_to_rank(rankid, classes) {
  if (!rankid || rankid == 0) return "";
  for (var i = 0; i < classes.length; ++i) {
    for (var j = 0; j < classes[i].subgroups.length; ++j) {
      if (classes[i].subgroups[j].rankid == rankid) {
        return classes[i].subgroups[j].name;
      }
    }
  }
  return "Can't resolve rankid " + rankid;
}

// The awards, as cards in #all_awards (a .card-grid), in award order, ahead of
// the add card (.grid-card-add) at the end.
function update_awards(data) {
  var awards = data.awards;
  var add_card = $("#all_awards .grid-card-add");

  while ($("#all_awards .award-card").length < awards.length) {
    $('<li class="grid-card award-card"></li>')
      .append('<button type="button" class="grid-card-edit" title="Edit or delete"'
              + ' onclick="handle_edit_award($(this).closest(\'li\'));">&#x2699;</button>')
      .append('<p class="grid-card-title awardname"></p>')
      .append('<p class="grid-card-detail awardtype"></p>')
      .append('<p class="grid-card-detail class-and-rank">'
              + '<span class="rankname"></span><span class="classname"></span></p>')
      .append('<p class="recipient-line"><span class="recipient badge badge-success"></span></p>')
      .insertBefore(add_card);
  }

  $("#all_awards .award-card").each(function(i) {
    if (i >= awards.length) {
      $(this).remove();
      return;
    }
    var award = awards[i];
    $(this).attr("data-awardid", award.awardid)
      .attr("data-awardname", award.awardname)
      .attr("data-awardtypeid", award.awardtypeid)
      .attr("data-classid", award.classid)
      .attr("data-rankid", award.rankid)
      .attr("data-racerid", award.racerid);
    $(this).find('.awardname').text(award.awardname);
    $(this).find('.awardtype').text(awardtypeid_to_awardtype(award.awardtypeid, data['award-types']));
    var classname = classid_to_class(award.classid, data.classes);
    var rankname = rankid_to_rank(award.rankid, data.classes);
    $(this).find('.classname').text(classname);
    $(this).find('.rankname').text(rankname != '' ? rankname + ', ' : '');
    $(this).find('.class-and-rank').toggleClass('hidden', classname == '');
    // Trimmed, so an award with no recipient shows nothing
    var recipient = (award.firstname + " " + award.lastname).trim();
    $(this).find('.recipient').text(recipient);
    $(this).find('.recipient-line').toggleClass('hidden', recipient == '');
  });
}

function awards_locked() {
  return $("#all_awards").attr('data-locked') == '1';
}

// The add card: a name and a type, and Add.  The award is for the whole
// pack; the gear can change that.
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
                 class_and_rank: '0,0'},
          success: function(data) {
            if (data.outcome && data.outcome.summary == 'failure') {
              alert(data.outcome.description);
            } else {
              $("#quick_award_name").val('').focus();
            }
            update_awards(data);
          }
         });
  return false;
}

function handle_new_award() {
  $('#award_editor_form').find('input[name="awardid"]').val('new');
  $('#award_editor_form').find('input[name="name"]').val('');
  // TODO $('#award_editor_form').find('select[name="awardtypeid"]').val(awardtypeid).change();
  // TODO $('#award_editor_form').find('select[name="class_and_rank"]').val('0,0').change();
  $('.delete_button').addClass('hidden');

  show_modal('#award_editor_modal', function() {
    close_modal('#award_editor_modal');
    $.ajax(g_action_url,
           {type: 'POST',
            // award.edit
            data: $('#award_editor_form').serialize(),
            success: function(data) {
              update_awards(data);
            }
           });
    return false;
  });
}

function handle_edit_award(list_item) {
  var awardid = list_item.attr('data-awardid');
  var awardname = list_item.attr('data-awardname');
  var awardtypeid = list_item.attr('data-awardtypeid');
  var rankid = list_item.attr('data-rankid');
  var classid = list_item.attr('data-classid');
  
  $('#award_editor_form').find('input[name="awardid"]').val(awardid);
  $('#award_editor_form').find('input[name="name"]').val(awardname);
  $('#award_editor_form').find('select[name="awardtypeid"]').val(awardtypeid).trigger("change");
  $('#award_editor_form').find('select[name="class_and_rank"]').val(classid + ',' + rankid).trigger("change");
  $('.delete_button').removeClass('hidden');

  show_modal('#award_editor_modal', function() {
    close_modal('#award_editor_modal');
    $.ajax(g_action_url,
           {type: 'POST',
            // award.edit
            data: $('#award_editor_form').serialize(),
            success: function(data) {
              update_awards(data);
            }
           });
    return false;
  });
}

function handle_delete_award() {
  close_modal('#award_editor_modal');
  if (confirm('Really delete award "' + $('#award_editor_form input[name="name"]').val() + '"?')) {
    $.ajax(g_action_url,
           {type: 'POST',
            data: {action: 'award.delete',
                   awardid: $('#award_editor_form input[name="awardid"]').val()},
            success: function(data) {
              update_awards(data);
            }
           });
  }
  return false;
}

$(function() {
  // Drag an award card to move it (not while the awards are locked)
  $("#all_awards").sortable({
    items: '> .award-card',
    disabled: awards_locked(),
    tolerance: 'pointer',
    cancel: 'button, input, select',
    stop: function(event, ui) {
    var data = {action: 'award.order'};
    $("#all_awards .award-card").each(function (i) {
      data['awardid_' + (i + 1)] = $(this).attr('data-awardid');
    });

    $.ajax(g_action_url,
           {type: 'POST',
            data: data,
            success: function(data) {
              update_awards(data);
            }
           });
  }});

  // TODO Poll on this, not just this one time
  $.ajax(g_action_url,
         {type: 'GET',
          data: {query: 'award.list',
                 adhoc: '0'},
          success: function(data) {
            update_awards(data);
          }
         });
});
