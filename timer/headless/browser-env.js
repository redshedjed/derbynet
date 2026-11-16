'use strict';

// Just enough of a browser for the timer page's JavaScript
// (derbynet-timer/src/js) to run in Node with no page: jQuery's $(ready) and
// $.ajax, a Web Worker for the clock, window, and navigator.  The page's
// display calls ($("#ports-list li")..., show_modal) do nothing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { DOMParser } = require('@xmldom/xmldom');

// ---- $.ajax, over fetch, with the server's session cookie ----

class Ajax {
  constructor(baseUrl, userAgent) {
    this.base = baseUrl.replace(/\/?$/, '/');
    this.userAgent = userAgent;
    this.cookies = new Map();
    this.lastSuccess = 0;  // Date.now() of the last answer from the server
  }

  static param(data) {
    // As jQuery's $.param, for the flat objects the timer code sends
    return Object.entries(data)
      .map(([k, v]) => {
        if (typeof v === 'function') v = v();
        if (v === null || v === undefined) v = '';
        return encodeURIComponent(k) + '=' + encodeURIComponent(v);
      })
      .join('&').replace(/%20/g, '+');
  }

  saveCookies(headers) {
    const list = headers.getSetCookie ? headers.getSetCookie()
          : (headers.get('set-cookie') || '').split(/,(?=\s*[^;=\s]+=)/);
    for (const c of list) {
      const m = c.match(/^\s*([^=;\s]+)=([^;]*)/);
      if (m) {
        this.cookies.set(m[1], m[2]);
      }
    }
  }

  async fetch(url, settings = {}) {
    const type = (settings.type || settings.method || 'GET').toUpperCase();
    let full = new URL(url, this.base).toString();
    const headers = { 'User-Agent': this.userAgent,
                      'X-Requested-With': 'XMLHttpRequest' };
    let body;
    if (settings.data !== undefined) {
      const encoded = typeof settings.data === 'string' ? settings.data
            : Ajax.param(settings.data);
      if (type === 'GET') {
        full += (full.includes('?') ? '&' : '?') + encoded;
      } else {
        body = encoded;
        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      }
    }
    if (this.cookies.size > 0) {
      headers['Cookie'] = [...this.cookies].map(([k, v]) => k + '=' + v).join('; ');
    }

    const response = await fetch(full, { method: type, headers, body,
                                         signal: AbortSignal.timeout(10000) });
    this.saveCookies(response.headers);
    const text = await response.text();
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' from ' + full);
    }
    this.lastSuccess = Date.now();
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      return JSON.parse(text);
    }
    if (contentType.includes('xml')) {
      return new DOMParser().parseFromString(text, 'text/xml');
    }
    return text;
  }

  // $.ajax(url, settings): calls settings.success or settings.error, and
  // returns a promise for those that await it.
  ajax(url, settings = {}) {
    if (typeof url === 'object') {
      settings = url;
      url = settings.url;
    }
    const result = this.fetch(url, settings).then(
      data => {
        if (settings.success) {
          try {
            settings.success.call(settings, data, 'success', null);
          } catch (e) {
            console.error('ajax success handler failed:', e);
          }
        }
        return data;
      },
      err => {
        if (settings.error) {
          try {
            settings.error.call(settings, null, 'error', err);
          } catch (e) {
            console.error('ajax error handler failed:', e);
          }
        }
        throw err;
      });
    // Most callers don't await: don't let a failure crash the process.
    result.catch(() => {});
    return result;
  }
}

// ---- $(...): ready handlers run on start(); everything else does nothing ----

// Display methods that take a "done" callback; it's called, so code awaiting
// an animation carries on.
const ANIMATIONS = new Set(['fadeTo', 'fadeIn', 'fadeOut', 'slideUp', 'slideDown',
                            'animate', 'addClass', 'removeClass', 'show', 'hide']);

function makeNothing() {
  const nothing = new Proxy(function() {}, {
    get(target, prop) {
      if (prop === 'length') return 0;
      if (prop === Symbol.iterator) return function* () {};
      // In a string, e.g. 'Last result: ' + $("#racing-round").text()
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'then' || typeof prop === 'symbol') return undefined;
      return function(...args) {
        const last = args[args.length - 1];
        if (ANIMATIONS.has(prop) && typeof last === 'function') {
          setTimeout(() => last.call(nothing), 0);
        }
        return nothing;
      };
    },
    apply() { return nothing; },
  });
  return nothing;
}

// ---- new Worker('js/timer/clock-worker.js'), in this process ----

function makeWorkerClass(jsDir) {
  return class Worker {
    onmessage = null;

    constructor(src) {
      const file = path.join(jsDir, path.basename(src));
      const worker = this;
      const context = vm.createContext({
        console, setTimeout, clearTimeout, setInterval, clearInterval, Date,
        onmessage: null,
        // From the worker to us, copied as a browser would
        postMessage(msg) {
          const copy = structuredClone(msg);
          setImmediate(() => worker.onmessage && worker.onmessage({ data: copy }));
        },
      });
      vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
      this.context = context;
    }

    // From us to the worker
    postMessage(msg) {
      const copy = structuredClone(msg);
      setImmediate(() => this.context.onmessage && this.context.onmessage({ data: copy }));
    }
  };
}

// Sets up the globals the timer code expects.  Returns {ajax, ready}, where
// ready holds the $(function) handlers, to run once logged in.
function install({ jsDir, serverUrl, userAgent, version, serial, onModal }) {
  const ajax = new Ajax(serverUrl, userAgent);
  const ready = [];
  const nothing = makeNothing();

  const $ = function(arg) {
    if (typeof arg === 'function') {
      ready.push(arg);
      return nothing;
    }
    return nothing;
  };
  $.ajax = ajax.ajax.bind(ajax);

  const Worker = makeWorkerClass(jsDir);

  Object.assign(globalThis, {
    $, jQuery: $,
    window: globalThis,
    Worker,
    isSecureContext: true,
    focus() {},
    location: {
      set href(v) { console.error('The server asked the timer to stop.'); process.exit(5); },
      get href() { return serverUrl; },
    },
    // Not used without a page
    BroadcastChannel: class { postMessage() {} close() {} },
    show_modal(selector) { onModal && onModal(selector); },
    close_modal() {},
    flipswitch() {},
    mobile_select_refresh() {},
    // From the inline script in templates/timer.html
    g_version: version,
    g_page_loaded: Date.now(),
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, writable: true,
    value: {
      serial,
      platform: os.platform() + ' ' + os.arch(),
      vendor: 'Node.js ' + process.version,
      userAgent,
    },
  });

  return { ajax, ready };
}

// Runs one of the timer's script files, as a <script> tag would: its
// top-level classes and variables are seen by the files after it.
function runScript(file) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}

// A top-level class or variable from the timer's scripts, by name
function global(name) {
  return vm.runInThisContext(name);
}

module.exports = { Ajax, install, runScript, global };
