<?php @session_start();
// The DerbyNet Quick Reference (a PDF the build makes from docs/), for anyone
// logged in -- not for visitors.  The web server configs keep quickref.pdf
// itself from being fetched directly.
require_once('inc/authorize.inc');
session_write_close();

if (!@$_SESSION['role']) {
  header('Location: login.php?next=quickref.php');
  exit(0);
}

$pdf = __DIR__.DIRECTORY_SEPARATOR.'quickref.pdf';
if (!is_readable($pdf) || filesize($pdf) == 0) {
  require_once('inc/banner.inc');
?><!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Quick Reference</title>
<?php require('inc/stylesheet.inc'); ?>
</head>
<body>
<?php make_banner('Quick Reference', 'index.php'); ?>
<div class="page-content narrow">
  <div class="card card-accent accent-ink">
    <p>The Quick Reference isn't part of this installation.  It's made from
      the documents in DerbyNet's docs folder when DerbyNet is built.</p>
  </div>
</div>
</body>
</html>
<?php
  exit(0);
}

header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="DerbyNet Quick Reference.pdf"');
header('Content-Length: '.filesize($pdf));
readfile($pdf);
?>
