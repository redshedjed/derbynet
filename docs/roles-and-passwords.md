# Roles and passwords

DerbyNet doesn't have user accounts. Instead, people log in as a **role**, and
the role decides what they can do. Visitors who don't log in can see the race
schedule and results, and vote.

| Role | Default password | For |
|------|------------------|-----|
| **Administrator** | `backstage` | The back end: Set-Up, Settings, the database, importing and exporting. Everything. |
| **RaceCoordinator** | `doyourbest` | Running the event: the Race Dashboard, the Kiosk Dashboard, presenting awards, plus everything the race crew does. |
| **RaceCrew** | `murphy` | Front of house: check-in, photos (including the stand-alone Photo Stand page), judging, printables. |
| **Timer** | *(none)* | Not for people: the timer connection logs in as this. |

Kiosks — displays, track cameras and photo stands — don't log in. What a kiosk
may do comes with the page the Kiosk Dashboard gives it. (A photo stand, for
instance, can upload photos and check racers in only while it shows the Photo
Stand page.)

## How careful to be

The logins are there to stop accidents — a helper wandering into Set-Up and
purging the database — on a private event network. They're not meant to stand
up to a determined attacker, so don't put a DerbyNet server on the public
internet. Do change the default passwords, though: they're printed here, and
a curious kid with a phone can find them.

## Changing passwords

Roles and passwords are in `config-roles.inc`, in the server's configuration
folder:

- On a Raspberry Pi server: `/var/www/html/derbynet/local/config-roles.inc`
- In the Docker image: `/var/lib/derbynet/config-roles.inc` (on the data
  volume)

Edit the `'password' => '...'` entries. A password can be plain text, or a
hash made with PHP's `password_hash()`, so the file needn't hold the real
password:

```bash
php -r 'echo password_hash($argv[1], PASSWORD_DEFAULT), "\n";' 'new password'
```

Put a hash in single quotes in the file, since it contains `$` characters.

If you change the Timer role's password, set `TIMER_PASSWORD` to match in
`derbynet.conf` on the timer Pi (see [Raspberry Pi](raspberry-pi.md)).

The file is created, with the defaults above, when the database is first set
up. **Until then, anyone who connects can do anything** — that's how the
first set-up works — so set up the database before the server is on a network
other people use.
