#! /bin/bash

# Races through the headless timer (timer/headless, as run on a Raspberry Pi),
# with an emulated FastTrack Q-series timer on the serial port: the same races
# as test-timer-hardware.sh, which uses the timer page in a browser.
#
# Requires node, and timer/headless's packages (npm ci there); resets the
# database.

BASE_URL=$1
set -e -E -o pipefail
source `dirname $0`/common.sh

user_login_admin

RESET_SOURCE=timer-headless `dirname $0`/reset-database.sh "$BASE_URL"
`dirname $0`/import-roster.sh "$BASE_URL"
`dirname $0`/test-basic-checkins.sh "$BASE_URL"

curl_postj action.php "action=settings.write&unused-lane-mask=0&n-lanes=4" | check_jsuccess
curl_postj action.php "action=schedule.generate&roundid=1" | check_jsuccess
curl_postj action.php "action=heat.select&roundid=1&now_racing=1" | check_jsuccess

node "`dirname $0`/puppeteer/headless-timer-test.js" "$BASE_URL"
