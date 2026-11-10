#! /bin/bash

# This only works when run on the server machine, not a separate client

BASE_URL=$1
set -e -E -o pipefail
source `dirname $0`/common.sh

user_login_coordinator

curl_postj action.php "action=photo.assign&repo=car&racer=1&photo=Car-1234.jpg" | check_jfailure
# For demo purposes, we want at least one car photo assigned early in the process
curl_postj action.php "action=photo.assign&repo=car&racer=1&photo=Car-1637.jpg" | check_jsuccess

# Racer 33 has a racer photo but no car photo; see test-slide-next.sh
curl_postj action.php "action=photo.assign&repo=head&racer=33&photo=Car-1862.jpg" | check_jsuccess

curl_postj action.php "action=photo.assign&repo=car&racer=1&photo=Car-1637.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=2&photo=Car-1638.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=3&photo=Car-1639.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=4&photo=Car-1640.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=5&photo=Car-1641.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=6&photo=Car-1642.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=7&photo=Car-1643.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=8&photo=Car-1644.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=9&photo=Car-1645.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=10&photo=Car-1646.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=11&photo=Car-1647.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=12&photo=Car-1648.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=13&photo=Car-1649.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=14&photo=Car-1650.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=15&photo=Car-1651.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=16&photo=Car-1652.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=17&photo=Car-1688.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=18&photo=Car-1845.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=19&photo=Car-1848.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=20&photo=Car-1849.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=21&photo=Car-1850.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=22&photo=Car-1851.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=23&photo=Car-1852.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=24&photo=Car-1853.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=25&photo=Car-1854.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=26&photo=Car-1855.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=27&photo=Car-1856.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=28&photo=Car-1857.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=29&photo=Car-1858.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=30&photo=Car-1859.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=31&photo=Car-1860.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=32&photo=Car-1861.jpg" | check_jsuccess
# See test-slide-next.sh
# curl_postj action.php "action=photo.assign&repo=car&racer=33&photo=Car-1862.jpg" | check_jsuccess
# curl_postj action.php "action=photo.assign&repo=car&racer=34&photo=Car-1863.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=35&photo=Car-1864.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=36&photo=Car-1865.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=37&photo=Car-1866.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=38&photo=Car-1867.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=39&photo=Car-1868.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=40&photo=Car-1869.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=41&photo=Car-1870.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=42&photo=Car-1871.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=43&photo=Car-1872.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=44&photo=Car-1873.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=45&photo=Car-1874.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=46&photo=Car-1875.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=47&photo=Car-1876.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=48&photo=Car-1877.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=49&photo=Car-1878.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=50&photo=Car-1879.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=51&photo=Car-1880.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=52&photo=Car-1881.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=53&photo=Car-1882.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=54&photo=Car-1883.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=55&photo=Car-5611.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=56&photo=Car-5612.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=57&photo=Car-5613.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=58&photo=Car-5614.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=59&photo=Car-5615.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=60&photo=Car-5616.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=61&photo=Car-5618.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=62&photo=Car-5619.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=63&photo=Car-5620.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=64&photo=Car-5621.jpg" | check_jsuccess
# These photo assignments should have already occurred in photo-setup.sh
# curl_postj action.php "action=photo.assign&repo=car&racer=65&photo=Car-5622.jpg" | check_jsuccess
# curl_postj action.php "action=photo.assign&repo=car&racer=66&photo=Car-5623.jpg" | check_jsuccess
# curl_postj action.php "action=photo.assign&repo=car&racer=67&photo=Car-5624.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=68&photo=Car-5625.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=69&photo=Car-5626.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=70&photo=Car-5627.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=71&photo=Car-5628.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=72&photo=Car-5629.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=73&photo=Car-5630.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=74&photo=Car-5631.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=75&photo=Car-5632.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=76&photo=Car-5633.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=77&photo=Car-5634.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=78&photo=Car-5635.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=79&photo=Car-5636.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=80&photo=Car-5637.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=81&photo=Car-5638.jpg" | check_jsuccess
curl_postj action.php "action=photo.assign&repo=car&racer=82&photo=Car-5639.jpg" | check_jsuccess
# curl_postj action.php "action=photo.assign&repo=car&racer=83&photo=Car-7261.jpg" | check_jsuccess

## Once this runs, the file links in the database become invalid
## TODO rm -rf "$PHOTO_DIR" "$CAR_PHOTO_DIR"
