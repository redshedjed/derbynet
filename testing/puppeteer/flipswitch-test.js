// Clicks real on/off switches (mobile.js flipswitch) the way a person does, and
// checks that each click sends exactly one request.  Under jQuery 3, an earlier
// version of the switch re-triggered every click until the stack overflowed.
//
// Expects racers who are checked in and a schedule with a current heat; leaves
// every switch as it found it.

const puppeteer = require('puppeteer');

var root = process.argv[2] || 'http://localhost/derbynet';
if (!root.startsWith('http://')) {
  root = 'http://' + root;
}
root = root.replace(/\/$/, '');

function fail(message) {
  throw new Error(message);
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const browser = await puppeteer.launch();
  try {
    const page = (await browser.pages())[0];
    const errors = [];
    const posts = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    page.on('request', r => {
      if (r.method() == 'POST' && r.url().endsWith('/action.php')) {
        posts.push(r.postData() || '');
      }
    });
    page.on('dialog', d => d.accept());  // e.g., "Are you sure you want to unregister...?"

    await page.goto(root + '/login.php');
    await Promise.all([page.waitForNavigation(),
                       page.evaluate(() => window.handle_login('RaceCoordinator', 'doyourbest'))]);

    // Clicks the visible switch that wraps a checkbox; returns the requests the
    // click sent that match `action`.
    async function clickSwitch(selector, action) {
      posts.length = 0;
      const wrapper = await (await page.$(selector)).evaluateHandle(el => el.parentElement);
      await wrapper.click();
      await sleep(1500);
      return posts.filter(p => p.includes('action=' + action));
    }

    function check(sent, action, what) {
      if (errors.length > 0) {
        fail(what + ': page errors: ' + errors.slice(0, 3).join(' | '));
      }
      if (sent.length != 1) {
        fail(what + ': expected 1 ' + action + ' request, got ' + sent.length);
      }
      console.log('      ok: ' + what + ' sent one ' + action + ' request');
    }

    console.log('   Race Dashboard racing switch');
    await page.goto(root + '/coordinator.php', {waitUntil: 'networkidle2'});
    const racingBefore = await page.$eval('#is-currently-racing', el => el.checked);
    check(await clickSwitch('#is-currently-racing', 'heat.select'), 'heat.select', 'Racing switch');
    if ((await page.$eval('#is-currently-racing', el => el.checked)) != racingBefore) {
      check(await clickSwitch('#is-currently-racing', 'heat.select'), 'heat.select',
            'Racing switch, set back');
    }

    console.log('   Check-in switch');
    await page.goto(root + '/checkin.php', {waitUntil: 'networkidle2'});
    // A racer who isn't checked in yet: the server refuses to un-check-in a
    // racer who has already raced, so a checked-in racer may not toggle back.
    const boxId = await page.$$eval('input[id^="passed-"]',
                                    els => (els.find(el => !el.checked) || {}).id);
    if (!boxId) {
      fail('No racer left to check in; this test needs one');
    }
    const box = '#' + boxId;
    const passedBefore = await page.$eval(box, el => el.checked);
    check(await clickSwitch(box, 'racer.pass'), 'racer.pass', 'Check-in switch');
    if ((await page.$eval(box, el => el.checked)) == passedBefore) {
      fail('Check-in switch did not change state');
    }
    check(await clickSwitch(box, 'racer.pass'), 'racer.pass', 'Check-in switch, set back');
    if ((await page.$eval(box, el => el.checked)) != passedBefore) {
      fail('Check-in switch did not return to its original state');
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.log('FLIPSWITCH TEST FAILURE: ' + error.message);
  process.exit(1);
});
