'use strict';

// Racing Groups: each den's (partition's) image, as used on car tags.  A den
// starts with the image set's emblem for its place in the order; clicking it
// picks another emblem, an added image, or one from this computer (uploaded
// and kept in user_images).  See inc/emblems.inc.

var g_den_images = {dens: [], emblems: []};

// data: a query.poll or partition.image response
function show_den_images(data) {
  if (!data || !data['partition-images']) return;
  g_den_images.dens = data['partition-images'];
  g_den_images.emblems = data['emblems'] || [];

  var list = $("#den-images").empty();
  $.each(g_den_images.dens, function(i, den) {
    var tile = $("<li/>")
        .attr('data-partitionid', den.partitionid)
        .attr('title', 'Change the image for ' + den.name)
        .on('click', function() { pick_den_image(den.partitionid); })
        .appendTo(list);
    var frame = $("<div/>").addClass('den-image-frame').appendTo(tile);
    if (den.url) {
      $("<img/>").attr('src', den.url).attr('alt', '').appendTo(frame);
    }
    $("<div/>").addClass('den-image-name').text(den.name).appendTo(tile);
    $("<div/>").addClass('den-image-label')
      .text(den['default'] ? 'Default' : den.label)
      .appendTo(tile);
  });
  if (g_den_images.dens.length == 0) {
    $("<li/>").addClass('den-images-none').text('None yet').appendTo(list);
  }
}

function den_by_id(partitionid) {
  return g_den_images.dens.find(function(d) { return d.partitionid == partitionid; });
}

function pick_den_image(partitionid) {
  var den = den_by_id(partitionid);
  if (!den) return;
  $("#den-image-name").text(den.name);
  $("#den-image-message").addClass('hidden').text('');
  $("#den-image-default").prop('disabled', den['default']);

  var choices = $("#den-image-choices").empty();
  var added_heading_shown = false;
  $.each(g_den_images.emblems, function(i, em) {
    if (em.user && !added_heading_shown) {
      $("<div/>").addClass('den-image-heading').text('Added images').appendTo(choices);
      added_heading_shown = true;
    }
    $("<button type='button'/>")
      .addClass('den-image-choice')
      .toggleClass('selected', em.image == den.image)
      .attr('title', em.label)
      .append($("<img/>").attr('src', em.url).attr('alt', em.label))
      .append($("<span/>").text(em.label))
      .on('click', function() { set_den_image(partitionid, {image: em.image}); })
      .appendTo(choices);
  });

  $("#den-image-default").off('click').on('click', function() {
    set_den_image(partitionid, {image: ''});
  });
  $("#den-image-upload").off('click').on('click', function() {
    $("#den-image-file").val('').trigger('click');
  });
  $("#den-image-file").off('change').on('change', function() {
    var file = this.files && this.files[0];
    // Cleared, so choosing the same file again still counts as a change
    $(this).val('');
    if (!file) return;
    var form = new FormData();
    form.append('action', 'partition.image');
    form.append('partitionid', partitionid);
    form.append('upload', file, file.name);
    $("#den-image-message").removeClass('hidden error').text('Uploading ' + file.name + '...');
    send_den_image(form, true);
  });

  show_modal("#den_image_modal", function() { return false; });
}

function set_den_image(partitionid, values) {
  send_den_image($.extend({action: 'partition.image', partitionid: partitionid}, values),
                 false);
}

function send_den_image(data, is_form) {
  var failed = function(msg) {
    $("#den-image-message").removeClass('hidden').addClass('error').text(msg);
  };
  var options = {type: 'POST',
                 data: data,
                 success: function(result) {
                   if (result.outcome && result.outcome.summary == 'success') {
                     show_den_images(result);
                     close_modal("#den_image_modal");
                   } else {
                     failed(result.outcome ? result.outcome.description : 'Failed.');
                   }
                 },
                 error: function(jqXHR, status, thrown) {
                   failed('Failed: ' + (thrown || status));
                 }};
  if (is_form) {
    options.processData = false;
    options.contentType = false;
  }
  $.ajax('action.php', options);
}
