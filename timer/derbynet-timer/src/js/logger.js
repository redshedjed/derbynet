'use script';

const REMOTE_LOG_DELTA_MS = 100;
// A run of repeated serial exchanges gets a line in the log at least this often
const REPEAT_SUMMARY_MS = 30000;
// An exchange is written out once nothing more has come for it in this long
const EXCHANGE_DONE_MS = 1000;

class Logger {
  static url = 'post-timer-log.php';

  buffer = [];
  last_write = Date.now();

  do_logging = false;

  scope = "";

  first_stacktrace;  // Records the argument to the very first call to stacktrace,
                     // so it can be reported when do_logging becomes true.
  first_probe_start_time = -1;  // Date.now() when probing first started

  constructor(do_logging) {
    this.set_remote_logging(do_logging);
  }
  
  set_remote_logging(do_logging) {
    if (do_logging && !this.do_logging) {
      Logger.set_url(HostPoller.url);
      this.do_logging = true;
      this.start_log();
    }
    this.do_logging = do_logging;
  }

  static set_url(url) {
    Logger.url = url.replace(/action.php$/, 'post-timer-log.php');
  }

  // 
  start_log() {
    this.write_decorated(' HELLO',
                         '\n   version=' + g_version.branch + '-' + g_version.revision +
                                 ', ' + g_version.date +
                         '\n   platform=' + navigator.platform +
                         '\n   vendor=' + navigator.vendor +
                         '\n   userAgent=' + navigator.userAgent +
                         '\n   page loaded=' + ((Date.now() - g_page_loaded)/1000) + 's ago' +
                         '\n   scan started=' + (this.first_probe_start_time < 0 ? 'Not yet'
                                                 : ((Date.now() - this.first_probe_start_time)/1000)
                                                   + 's ago')
                        );
    if (this.first_stacktrace) {
      this.internal_msg('Stacktrace recorded earlier:');
      this.stacktrace(this.first_stacktrace);
    }
    this.flush();
  }

  probing_started() {
    if (this.first_probe_start_time < 0) {
      this.first_probe_start_time = Date.now();
    }
  }

  // Serial traffic is mostly the same polls (e.g., FastTrack's RG, "is the
  // gate closed?", and LR, in turn) and the same answers, several times a
  // second.  So it's logged an exchange at a time -- a command, then whatever
  // came back before the next one -- and when exchanges start repeating in a
  // short cycle (one to MAX_CYCLE exchanges long), the repeats are only
  // counted.  Any change in what the timer says breaks the cycle, so it's
  // written out as it happened.  The count goes in the log as one line when
  // something different happens (the gate opens, a result arrives, a message
  // from the server...), or every REPEAT_SUMMARY_MS while it keeps going.
  static MAX_CYCLE = 3;
  exchange = null;       // In progress: {lines: [decorated], key: undecorated, start: ms}
  history = [];          // Keys of the latest exchanges, oldest first
  cycle = 0;             // Length of the cycle being repeated, or 0
  repeats = 0;           // Exchanges in the cycle, not yet reported
  repeats_start = 0;
  repeats_end = 0;

  serial_in(s) {
    if (this.do_logging) {
      this.add_to_exchange('S <-- ', s);
    }
  }

  serial_in_inferred(s) {
    if (this.do_logging) {
      this.add_to_exchange('S <-* ', s);
    }
  }

  serial_out(s) {
    if (this.do_logging) {
      this.end_exchange();
      this.exchange = {lines: [], key: '', start: Date.now()};
      this.add_to_exchange('S --> ', s);
    }
  }

  serial_match(s) {
    if (this.do_logging) {
      this.add_to_exchange('S /-/ ', s);
    }
  }

  add_to_exchange(key, s) {
    if (!this.exchange) {
      // Something from the timer without a command first, e.g. a result
      this.exchange = {lines: [], key: '', start: Date.now()};
    }
    this.exchange.lines.push(this.decorate(key, s));
    this.exchange.key += key + s + '\n';
  }

  // Writes out (or counts) the exchange in progress
  end_exchange() {
    const ex = this.exchange;
    this.exchange = null;
    if (!ex) {
      return;
    }
    const h = this.history;
    if (this.cycle > 0) {
      if (h[h.length - this.cycle] == ex.key) {
        this.count_repeat(ex);
        return;
      }
      this.report_repeats();
    } else {
      for (let n = 1; n <= Logger.MAX_CYCLE && n <= h.length; ++n) {
        if (h[h.length - n] == ex.key) {
          this.cycle = n;
          this.repeats_start = ex.start;
          this.count_repeat(ex);
          return;
        }
      }
    }
    for (const line of ex.lines) {
      this.write_raw(line);
    }
    this.remember(ex.key);
  }

  count_repeat(ex) {
    ++this.repeats;
    this.repeats_end = ex.start;
    this.remember(ex.key);
  }

  remember(key) {
    this.history.push(key);
    if (this.history.length > 2 * Logger.MAX_CYCLE) {
      this.history.shift();
    }
  }

  // One line for the repeats so far; the cycle may carry on
  report_repeats() {
    if (this.repeats > 0) {
      const commands = this.history.slice(-this.cycle)
            .map(key => key.split('\n')[0].replace(/^S --> /, ''))
            .filter(c => c).join(', ');
      this.write_raw(this.decorate('S ... ', this.repeats + ' more like '
                                   + (this.cycle == 1 ? 'that' : 'those')
                                   + (commands ? ' (' + commands + ')' : '')
                                   + (this.repeats > 1
                                      ? ' over ' + ((this.repeats_end - this.repeats_start) / 1000).toFixed(1) + 's'
                                      : ''),
                                   this.repeats_end));
      this.repeats = 0;
      this.repeats_start = this.repeats_end;
    }
  }

  // Anything else in the log first ends the exchange, so the log stays in order
  end_serial() {
    this.end_exchange();
    this.report_repeats();
    this.history = [];
    this.cycle = 0;
  }

  internal_msg(s) {
    if (this.do_logging) {
      this.end_serial();
      this.write_decorated('* INT ', s);
    }
  }

  debug_msg(s) {
    if (this.do_logging) {
      this.end_serial();
      this.write_decorated('* DBG ', s);
    }
  }

  host_in(s) {  // Message from host
    if (this.do_logging) {
      this.end_serial();
      this.write_decorated('H <-- ', s);
    }
  }

  stacktrace(err) {
    if (!this.first_stacktrace) {
      this.first_stacktrace = err;
    }
    if (this.do_logging) {
      this.end_serial();
      this.write_decorated('!!!!! ', err.toString());
      if (err.hasOwnProperty('stack')) {
        this.write_decorated('!!!!! ', err.stack);
      }
    }
    Gui.trouble_message(err);
  }

  decorate(key, s, when = Date.now()) {
    var d = new Date(when);
    return '+' + /* d.getHours().toString().padStart(2, '0') +
                   ':' + d.getMinutes().toString().padStart(2, '0') +
                   ':' + */ d.getSeconds().toString().padStart(2, '0') +
                   '.' + d.getMilliseconds().toString().padStart(3, '0') +
                   key + s;
  }

  write_decorated(key, s) {
    this.write_raw(this.decorate(key, s));
  }

  write_raw(s) {
    if (this.do_logging == 0) {
      return;
    }
    this.buffer.push(s);
  }

  poll() {
    if (this.do_logging) {
      const now = Date.now();
      if (this.exchange && now - this.exchange.start >= EXCHANGE_DONE_MS) {
        this.end_exchange();
      }
      if (this.repeats > 0 && this.repeats_end - this.repeats_start >= REPEAT_SUMMARY_MS) {
        // Still repeating: say so, and keep counting
        this.report_repeats();
      }
    }
    if (this.buffer.length > 0) {
      this.flush();
    }
  }
  
  flush() {
    var p = this.buffer.join('\n') + '\n';
    this.buffer = [];
    this.last_write = Date.now();
    $.ajax(Logger.url,
           {type: 'POST',
            data: p,
            success: function(data) {
              if (typeof data == "object" && data["cease"]) {
                window.location.href = '../index.php';
                return;
              }
            }
           });
  }

}

var g_logger = new Logger(false);
