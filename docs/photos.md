# Photos

Photos of each racer and each car make the event: they show on the race
displays, the results, the awards screen, the ballot, and the printables.
DerbyNet keeps two sets, **racer photos** (head shots) and **car photos**.

There are several ways to get them in.

## A photo stand

A photo stand is a camera and a USB barcode scanner at a table. Scan a racer's
barcode (from their check-in card; see **Printables**) and the photo is taken,
uploaded and assigned to that racer. It can also check the racer in.

**As a kiosk** (the usual way, on a Raspberry Pi): on the Kiosk Dashboard,
give the kiosk the **Photo Stand** page and choose its options:

- racer photos or car photos;
- when to take the picture: as soon as the barcode is scanned, 3 seconds
  later, or with the Space bar first and then the scan (best for catching a
  smile);
- check in each racer scanned;
- crop racer photos to the face;
- say what happened, out loud;
- which camera, if the kiosk has more than one.

A kiosk photo stand needs no login. It can upload photos and check racers in
only while it's showing the Photo Stand page.

**On a laptop**: open `photo-stand.php` on the server (log in as RaceCrew or
above) and set the same options on the page. The laptop's browser needs a
secure connection to use its camera: `https://`, or `localhost`.

## At check-in

On **Race Check-In**, each racer's row has racer and car photo spots. Click one
to open the camera: **Capture & Check In** or **Capture Only**. Or drag a photo
file onto the dialog to upload it. (Uploading a file doesn't check the racer
in.)

On a phone, **Mobile Check-In** does the same: find a racer, take their
photos, check them in.

## Uploading files

On the **Photos** page, drop photo files on the upload area (or click it to
choose files), then drag each photo onto a racer to assign it. Click a photo to
crop or rotate it.

## Cameras and secure connections

Browsers only let a page use a camera over a secure connection. Kiosk Pis are
set up to allow it over plain `http`. On a laptop, tablet or phone, use the
server's `https://` address; the browser warns about the server's certificate
the first time, and you can accept it. See [Raspberry Pi](raspberry-pi.md) or
[Docker](docker.md).

## Where photos are kept

Settings > Photos chooses the folders for racer photos and car photos. On a
Raspberry Pi server, they default to folders under `/var/lib/derbynet`, which
a standby copies along with the database.
