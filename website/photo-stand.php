<?php @session_start();
// Photo Stand: a camera and a barcode scanner at a table, taking racer or car
// photos.  Scan a racer's barcode and the photo is taken and uploaded (and
// the racer checked in, if chosen); or take the photo with the Space bar
// first, then scan to say whose it is.  See js/photo-stand.js.
//
// The barcode scanner types like a keyboard, ending each barcode with Enter.
require_once('inc/data.inc');
require_once('inc/authorize.inc');
require_once('inc/banner.inc');
require_once('inc/photo-config.inc');

// The Photo role (the photo station) only shows on the login page with ?all
if (!have_permission(PHOTO_UPLOAD_PERMISSION)) {
  header('Location: login.php?all&next=photo-stand.php');
  exit(0);
}
session_write_close();
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Photo Stand</title>
<?php require('inc/stylesheet.inc'); ?>
<link rel="stylesheet" type="text/css" href="css/photo-frame.css"/>
<link rel="stylesheet" type="text/css" href="css/photo-stand.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-migrate.js"></script>
<script type="text/javascript" src="js/camera-source.js"></script>
<script type="text/javascript" src="js/photo-frame.js"></script>
<script type="text/javascript">
// Shapes (width / height) racer and car photos are framed to; 0 = any
var g_photo_aspects = <?php echo photo_aspects_json(); ?>;
</script>
<script type="text/javascript" src="js/photo-stand.js"></script>
</head>
<body>
<?php make_banner('Photo Stand'); ?>

<div id="stand">
  <div id="stand-camera">
    <div id="stand-preview-box">
      <video id="stand-preview" autoplay="autoplay" muted="muted" playsinline="playsinline"></video>
      <div id="stand-countdown" class="hidden"></div>
      <div id="stand-flash"></div>
    </div>
    <div id="stand-held" class="hidden">
      <img id="stand-held-img" alt="The photo waiting for a barcode"/>
      <div>Photo taken.  <b>Scan the racer's barcode</b> to assign it,
        or press Space to take it again.</div>
    </div>
    <div id="no-camera-warning" class="hidden"></div>
  </div>

  <div id="stand-panel">
    <section class="card">
      <div id="stand-status" class="ready">Starting the camera...</div>
      <div id="stand-hint">Scan a racer's barcode.  (Or type it, e.g. PWD101, and press Enter.)</div>
    </section>

    <section class="card" id="stand-settings">
      <div class="stand-row">
        <span class="stand-label">Photos of</span>
        <label><input type="radio" name="stand-repo" value="head"/> Racers</label>
        <label><input type="radio" name="stand-repo" value="car"/> Cars</label>
      </div>
      <div class="stand-row">
        <label class="stand-label" for="stand-when">Take the photo</label>
        <select id="stand-when">
          <option value="now">As soon as a barcode is scanned</option>
          <option value="countdown">3 seconds after scanning</option>
          <option value="space">With the Space bar, then scan to assign it</option>
        </select>
      </div>
      <div class="stand-row" id="take-photo-row">
        <button type="button" id="stand-take" class="btn">Take Photo (Space)</button>
      </div>
      <div class="stand-row">
        <label><input type="checkbox" id="stand-checkin"/> Check in each racer scanned</label>
      </div>
      <div class="stand-row">
        <label><input type="checkbox" id="stand-autocrop"/> Crop racer photos to the face</label>
      </div>
      <div class="stand-row">
        <label><input type="checkbox" id="stand-speak"/> Say what happened, out loud</label>
      </div>
      <div class="stand-row">
        <label class="stand-label" for="stand-device">Camera</label>
        <select id="stand-device"><option>Please wait</option></select>
      </div>
    </section>

    <section class="card hidden" id="stand-failed">
      <h3>Not uploaded</h3>
      <p class="stand-note">These are kept here until they're uploaded.  Leaving this page
        loses them.</p>
      <div class="stand-row">
        <button type="button" class="btn btn-secondary btn-sm" id="stand-retry-all">Retry All</button>
      </div>
      <ul id="stand-failed-list"></ul>
    </section>

    <!-- For a stand with only a scanner nearby: print these, and scan one to
         change a setting -->
    <details class="card" id="stand-barcodes">
      <summary>Settings barcodes, to print</summary>
      <div class="stand-barcode-grid">
<?php
foreach (array('PWDcheckin-ON' => 'Check in each racer: on',
               'PWDcheckin-OFF' => 'Check in each racer: off',
               'PWDcrop-ON' => 'Crop racer photos: on',
               'PWDcrop-OFF' => 'Crop racer photos: off',
               'PWDspeedtest' => 'Test the upload speed',
               'PWDuploadonly' => 'Upload a photo for no racer')
         as $code => $label) {
  echo '        <figure><img src="img/stand-barcodes/'.$code.'.png" alt="'.$code.'"/>'
      .'<figcaption>'.htmlspecialchars($label, ENT_QUOTES, 'UTF-8').'</figcaption></figure>'."\n";
}
?>
      </div>
    </details>
  </div>
</div>

</body>
</html>
