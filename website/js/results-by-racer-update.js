

$(function() {
  var intv = setInterval(function() {
    $.ajax("action.php",
           {type: 'GET',
            data: {query: 'poll.results'},
            success: function(data) {
              if (data["cease"]) {
                clearInterval(intv);
                window.location.href = '../index.php';
                return;
              }
              process_newresults(data);
            }
           });
  }, 1000);
});

function process_newresults(data) {
  var rounds = data['schedule-signature'];

  // When the page is contructed, it includes a tbody for every roundid that has
  // scheduled heats, The mention of a new roundid in the update implies we need
  // to reload the page to reflect newly-scheduled rounds.  The exception is if
  // we're intentionally limiting the display to a single roundid
  // (g_limited_to_roundid).
  if (!g_limited_to_roundid) {
    $("tbody[data-roundid]").each(function() {
      var roundid = $(this).attr('data-roundid');
      if (!rounds.hasOwnProperty(roundid)) {
        console.log("tbody for non-existent roundid " + roundid);
        location.reload(true);
      }
    });
  }

  var keys = [];
  for (var r in rounds) {
    if (rounds.hasOwnProperty(r)) {
      keys.push(r);
    }
  }

  rewrite_table_sections(rounds, keys, 0, function() {
    update_results(data.results);
    var current = data['current-heat'];
    var next_heat = data['next-heat'];

    notice_change_current_tbody(current.tbodyid, current.round,
                                current.classname);
  });
}

// Each tbody in racer-results has an id with the roundid.
function rewrite_table_sections(rounds, keys, index, completed) {
  if (index < keys.length) {
    var roundid = keys[index];
    var signature = rounds[roundid];
    var tbody = $("#tbody_" + roundid);

    if (/* round.textContent && */ tbody.attr('data-signature') != signature) {
      if (tbody.length == 0) {
        // console.log("Reloading page for new roundid " + round.textContent);
        // Wholly-new roundid implies added a new round; just reload rather than
        // try to guess where the new tbody should go.
        location.reload(true);
        return;
      }
      console.log("tbody load for " + roundid
                  + " because old " + tbody.attr('data-signature') + ' != new ' + signature);

      tbody.attr('data-signature', signature);
      tbody.load(location.href + " #tbody_" + roundid + " tr", /* data */ '',
                 function() { rewrite_table_sections(rounds, keys, 1 + index, completed); });

      rewrite_table_sections(rounds, keys, 1 + index, completed);
    } else {
      rewrite_table_sections(rounds, keys, 1 + index, completed);
    }
  } else {
    completed();
  }
}

function update_results(results) {
  for (var i = 0; i < results.length; ++i) {
    var result = results[i];
    $("td.resultid_" + result.resultid + " span.time").text(
      result.outcome[0] == 'x' ? result.outcome.substring(1) : result.outcome);
  }
  if (results.length > 0) {
    mark_heat_winners_on_page();
  }

  if (g_as_kiosk) {
    // Any tbody's with no results should be collapsed or hidden
    $("tbody[data-roundid]").not(".being-scrolled").each(function() {
      var tbody = $(this);
      tbody.toggleClass('hidden',
                        tbody.find("span.time").filter(function() {
                          return $(this).text() != '--';
                        }).length == 0);
    });
  }
}

// After live results arrive, outline each heat's winner: the lowest time
// (or best place) among that heat's lanes on the page.  Only on the full
// page; showing one racer, the page lacks the other lanes, so the server's
// marks (racer-results.php) stand until the next reload.
function mark_heat_winners_on_page() {
  if (/[?&]racerid=/.test(location.search)) {
    return;
  }
  var heats = {};
  $("td[data-heat]").each(function() {
    var v = parseFloat($(this).find("span.time").text());
    if (isNaN(v)) return;
    var key = $(this).attr('data-heat');
    (heats[key] = heats[key] || []).push({td: $(this), v: v});
  });
  for (var key in heats) {
    var best = Math.min.apply(null, heats[key].map(function(c) { return c.v; }));
    heats[key].forEach(function(c) { c.td.toggleClass('heat_winner', c.v == best); });
  }
}
