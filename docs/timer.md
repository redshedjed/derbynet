# The timer

DerbyNet talks to the track's electronic timer over its serial (usually
USB-serial) cable. With a timer connected, heats are sent to the timer as
they're staged, and lane times come back to DerbyNet as each heat finishes,
with no typing.

The timer has no network connection of its own, so something has to sit
between its cable and the server: the **timer interface**. It finds the timer,
sends it each heat's set-up (such as which lanes to ignore), reads the times,
and passes them to the server. There are two ways to run it — the same code
either way:

- **On a Raspberry Pi, with no screen** (recommended). Give a Pi the `timer`
  role and plug the timer into it; ideally the server Pi, so the times never
  cross Wi-Fi. It starts at boot, finds the timer by itself, and finds it again
  if the cable is unplugged and plugged back in. See
  [Raspberry Pi](raspberry-pi.md#6-the-timer).
- **In a browser.** The **Timer** button in the Race Dashboard's timer panel
  opens the timer page. Plug the timer into the computer running that browser
  and press **Scan**. This needs Chrome or Edge (for their Web Serial support),
  and a secure connection: `localhost`, or `https://`. The timer page has to
  stay open, and some browsers slow it down when its window isn't in front —
  so for a whole race, the Pi is the better choice.

Only one timer interface can be connected at a time: while one is, the server
refuses another.

## Supported timers

Found automatically:

- MicroWizard FastTrack, K- and Q-series
- "The Champ" (SmartLine / eTekGadget / BestTrack), and The Champ (SRM)
- The Judge (New Directions)
- PDT timer (dfgtec.com)
- Derby Timer (derbytimer.com)
- Derby Magic (two baud rates; if neither is found automatically, choose one by
  hand)
- Bert Drake
- JIT Racemaster
- SuperTimer II (not yet tested with a real one)

These don't answer when asked what they are, so they're shown as
"unconfirmed" until their first result arrives. On the timer page, choose the
timer by hand:

- MicroWizard FastTrack P-series
- NewBold DT, TURBO, or DerbyStick

The list of timers, and how DerbyNet talks to each, is
[timer/derbynet-timer/src/js/profiles.js](../timer/derbynet-timer/src/js/profiles.js).
Adding a timer means adding an entry there.

## Settings

- **Number of lanes, and unused lanes**: Settings > Track and Timer. Unused
  lanes are masked off on the timer for every heat.
- **The timer's own options**: the **Timer Testing** page (the **Test** button
  in the Race Dashboard's timer panel). For example:
  - *FastTrack automatic gate release*: turn this on if a MicroWizard light
    tree and automatic gate release is fitted. Without it, DerbyNet's handling
    of the laser reset opens the gate as soon as a heat is staged.
  - *Ignore place*, *minimum gate time* (ignore gate flickers shorter than
    this), *reset after start*, and others; each is described on the page.

## Starting a heat from the Race Dashboard

If the timer can release the start gate itself, the Race Dashboard shows a
**Start Race** button. That's the FastTrack with automatic gate release
(turn the option on, above), the Derby Magic, and the PDT. Otherwise, someone
pulls the gate lever as usual.

## Racing without a timer

Turn off **Warn when timer not connected** in Settings, then enter each heat's
times or places with **Manual Results** on the Race Dashboard.

## Troubleshooting

**The timer isn't found.** Check it's plugged in and turned on — easy to miss
in the rush of setting up. On a Pi, `derbynet-pi doctor` lists the serial
ports it can see; if the timer's adapter isn't there, suspect the cable or the
adapter. A P-series FastTrack or NewBold has to be chosen by hand on the timer
page.

**The timer's log.** The timer interface can send a log of everything passing
between it and the timer to the server: turn it on from the Timer Testing
page. Repeated polling (the "is the gate closed?" checks, several a second) is
summarized as one line, like `19 more like that (RG) over 4.5s`, so what
actually happened stands out. On a timer Pi, the interface's own messages are
in `journalctl -u derbynet-timer`.

**For developers**: the messages between the timer interface and the server
are described in [Timer messages](developers/timer-messages.md).
