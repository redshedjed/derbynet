# Running DerbyNet on Raspberry Pis

This guide is for whoever sets up the Pis before an event. It covers choosing
hardware, preparing each Pi, deciding what each one does, and what to do on
race day if something goes wrong.

## The pieces

Every Pi runs the same software. What it *does* is set by its **roles**, in a
settings file on its SD card:

| Role      | What it does |
|-----------|--------------|
| `server`  | Runs DerbyNet itself. Everything else connects to it. You need exactly one. |
| `timer`   | Connects the track's timer to the server. Plug the timer's USB cable into this Pi. |
| `kiosk`   | A full-screen browser: a display (on-deck list, results, awards), a **track camera**, or a **photo stand**. Which one is chosen on the Kiosk Dashboard, not on the Pi. |
| `standby` | A spare server that keeps a copy of the server's data, ready to take over. |

A Pi can have several roles. Common combinations:

- `server timer` — the server, with the track timer plugged into it. The
  recommended setup: race times never travel over Wi-Fi.
- `kiosk` — a TV by the track, the awards screen, a track camera, or a photo
  stand.
- `standby` — a hot spare.
- `server timer kiosk` — the whole race on one Pi (small events).

## What you need

- **Raspberry Pi 4 or 5.** 2 GB is enough for a kiosk; use 4 GB or more for
  the server, especially if it's also a kiosk.
- **A microSD card for each Pi**, 16 GB or larger.
- **A good power supply for each Pi** (the official one). Underpowered Pis
  misbehave in confusing ways, and cameras draw extra power.
- **A Wi-Fi router.** A small travel router (around $30–60) is plenty. Connect
  the server Pi to it with an Ethernet cable if you can; everything else can
  use Wi-Fi. Don't rely on a Pi as the Wi-Fi hotspot: it can only handle about
  ten devices, and the audience's phones (voting, following the race) will
  far exceed that.
- For a **kiosk**: a screen (HDMI), and for setup a keyboard and mouse.
- For a **track camera**: a USB webcam or a Raspberry Pi camera.
- For a **photo stand**: a camera and a USB barcode scanner.
- For the **timer**: the timer's USB serial cable (or a USB-to-serial adapter).

## 1. Write the SD card

Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on any
computer.

1. Choose your Pi model, then the operating system:
   - **Raspberry Pi OS (64-bit)**, the version *with desktop*, for any Pi that
     is or might become a kiosk.
   - **Raspberry Pi OS Lite** is enough for a Pi that will only ever be a
     server, timer or standby. (A Lite Pi can't become a kiosk later.)
2. When Imager offers to customize settings, do:
   - **Hostname**: something you'll recognize, e.g. `derby-server`,
     `derby-kiosk1`. Every Pi needs a different one.
   - **Username and password**: your choice; you'll log in with these.
   - **Wi-Fi**: the event router's network name and password.
   - **Locale and time zone**.
   - **SSH** (under Services): turn it on, so you can work on a Pi from a
     laptop instead of plugging in a keyboard.
3. Write the card, put it in the Pi, and power it on.

## 2. Install DerbyNet on each Pi

The Pi needs internet access for this step (at home, before the event is
fine). On the Pi — in a terminal on its desktop, or over SSH — as the user you
created (not with `sudo`):

```bash
sudo apt install -y git
git clone https://github.com/redshedjed/derbynet.git
bash derbynet/installer/rpi/setup.sh --roles "server timer"
sudo reboot
```

Change `--roles` to suit the Pi (see the table above). Leave it off and the
script asks.

The script installs everything for every role, so a Pi can change roles later
without internet access. It takes a while the first time.

## 3. Changing what a Pi does

The roles, and every other Pi setting, are in **`derbynet.conf` on the SD
card's boot partition**. That partition can be read by Windows, Mac and Linux,
so you can change a Pi without a keyboard or screen:

1. Power the Pi off and take out the SD card.
2. Put the card in any computer and open `derbynet.conf` on it (the drive is
   called `bootfs`).
3. Change `ROLES=`, save, put the card back, and power the Pi on.

Or, on the Pi: edit `/boot/firmware/derbynet.conf`, then run
`sudo derbynet-pi apply` (or reboot).

The file explains every setting. Most are only needed in unusual setups.

## 4. Set up the server

Once the server Pi is running, browse to it from a laptop on the same network:

    http://derbynet.local/derbynet

The first visit walks you through setting up the database. Then log in as
**Administrator** and work through the **Set-Up** page: roster, racing
groups, awards and settings. Default passwords are in
[Roles and passwords](roles-and-passwords.md).

**Finding the server.** The server announces itself on the network, and the
other Pis find it on their own; nothing to configure. It also answers to
`derbynet.local`, so people can type that address. Some Android phones don't
understand `.local` names; use the server's IP address there
(`derbynet-pi status` on the server shows it).

If the server isn't a Pi set up this way (a laptop, say), set
`DERBYNET_SERVER` in `derbynet.conf` on each of the other Pis.

**Cameras and HTTPS.** Browsers only let a page use a camera over a secure
connection. Kiosk Pis are set up to allow it anyway. On a laptop or phone (for
example, taking photos at check-in), use
`https://derbynet.local/derbynet` instead; the browser will warn about the
certificate the first time, and you can accept it.

## 5. Set up the kiosks

A kiosk Pi starts its browser full-screen when it boots, shows "Waiting for
the DerbyNet server" until it can reach the server, then shows up on the
**Kiosk Dashboard**, named by its serial number (it keeps that name across
restarts). From the Kiosk Dashboard you:

- **Name it** (e.g. "Lobby TV").
- **Choose what it shows**: on-deck list, results, awards presentation,
  slideshow, Live Camera, Photo Stand, and so on.
- **Give it track cameras**: when you name a kiosk that has a camera, assign
  each of its cameras to one of the track cameras set up in
  **Settings > Cameras** (Start, Finish, …). It then streams that camera for
  replays and Live Camera displays.
- **Make it a photo stand**: give it the Photo Stand page. A photo stand needs
  no login; it can upload photos and check racers in only while it's showing
  that page.

To leave the full-screen browser on a kiosk (with a keyboard): **Alt+F4**
closes it, and it restarts by itself a few seconds later.

## 6. The timer

Plug the timer's USB cable into the Pi with the `timer` role and turn the
timer on. The Pi tries each supported timer model on each USB serial port
until one answers, then reports it to the server: the Race Dashboard shows the
timer as connected. If the cable comes out, the server shows a timer problem,
and the Pi finds the timer again when it's plugged back in. There's no screen
and nothing to click.

The number of lanes and any unused lanes are set on the **Settings** page. The
timer's own options (FastTrack automatic gate release and the like) are on the
**Timer Testing** page: the **Test** button in the Race Dashboard's timer
panel. To use only one serial port, set `TIMER_PORT` in `derbynet.conf`.

Only one timer connection at a time: while the Pi's timer is connected, the
server refuses another, such as the timer page opened on a laptop. See
[The timer](timer.md) for the supported timers and troubleshooting.

## 7. A standby, and what to do if the server fails

A standby keeps a copy of the server's database and photos, at most about 40
seconds old. To set one up, give it the `standby` role, and set the same
`SYNC_PASSWORD` in `derbynet.conf` on **both** the server and the standby.
Without it, the standby can't copy anything.

If the server fails during the race:

1. **Power the old server off.**
2. On the standby, run:

   ```bash
   sudo derbynet-pi promote
   ```

   It refuses while the old server is still on the network, so the two never
   both act as the server.
3. The standby takes over: it announces itself and takes the `derbynet.local`
   name. Kiosks, track cameras and photo stands notice the old server has gone
   and switch to the new one by themselves, within about a minute.
4. If the timer was plugged into the old server, move its cable to the new one
   (and add `timer` to its roles, if it hasn't got it).
5. Before powering the old server back on, change its `ROLES` (to `standby`,
   say), so the two don't both act as the server.

The last 40 seconds or so of changes before the failure may be missing; check
the most recent heat's results.

## Checking on a Pi

On any Pi (on its desktop terminal, or over SSH):

| Command | Shows |
|---------|-------|
| `derbynet-pi status` | What the Pi is doing, and whether each part is healthy |
| `derbynet-pi doctor` | `status`, plus hardware checks: cameras, barcode scanners, the timer's serial port |
| `derbynet-pi servers` | DerbyNet servers announced on the network |
| `journalctl -u derbynet-timer -f` | The timer's log, live (on the timer Pi) |

`status` warns about common problems: settings changed but not applied, two
servers announcing, a standby that can't copy, a server it can't reach.

## Updating

To get a newer version, on each Pi:

```bash
cd derbynet
git pull
bash installer/rpi/setup.sh
```

Re-running `setup.sh` keeps each Pi's roles and settings.
