# Running a race

From an empty database to the awards ceremony. Page and button names are as
they appear in DerbyNet; the home page's tiles are grouped by who uses them.

## Before race day

Log in as **Administrator** and open **Set-Up**. Its **Getting Ready for Race
Day** list is the order to work in:

1. **Settings.** Number of lanes, how heats are scored, photo folders, the
   home page's title, the visitor Wi-Fi. Each setting says what it does.
2. **Import Roster.** Load your racers from a spreadsheet (CSV): names, car
   numbers, and their group (den, class, age group…). For practice, **Fake
   Roster** makes up a field of racers; clear it afterwards with **Purge
   Data**.
3. **Racing Groups.** How the field is divided for racing. See below.
4. **Rounds Playlist** (optional). The order rounds are raced in, and any
   finals, so the event runs from one round to the next by itself. Without
   one, the race coordinator starts each round from the Race Dashboard.
5. **Import Awards.** The design and other awards. (Speed awards come from the
   results by themselves.) They're edited in the Awards Editor
   (Judging > Edit Awards).
6. **Printables.** Check-in cards with each racer's barcode, car stickers and
   tags, and award certificates.
7. **Kiosk Dashboard** (optional). What each screen shows. Set up the
   locations ahead of time (TV by the track, lobby, awards stage) in the
   **Kiosk Editor**, and what each location shows in each **scene** (racing,
   awards…) in the **Scene Editor**.

### Racing groups, subgroups, aggregates

- **Racing groups.** Every racer is in exactly one. A round is raced by one
  group: racers in different groups never race in the same heat (except in an
  aggregate round). The Racing Groups page offers: race each segment of your
  roster (each den, say) as its own group; race everyone as one big group; or
  custom groups (combine two small dens, for example).
- **Subgroups** divide a group for standings and speed awards, without
  changing the schedule: racers in different subgroups of a group can race in
  the same heat. (Turn on **Use Subgroups** on the Racing Groups page.)
- **Aggregates** are combinations of groups, for standings and awards across
  several groups — and for a **Grand Finals** round, where the top racers from
  each group race each other.

Standings and awards for the whole field are always calculated as well.

## On the day: setting up

- **The network.** Bring your own router; see
  [Raspberry Pi](raspberry-pi.md#what-you-need).
- **The timer.** Connect it and check the Race Dashboard shows it connected.
  **Timer Testing** (the **Test** button in the dashboard's timer panel)
  checks it end to end. See [The timer](timer.md).
- **Kiosks.** Power on the display Pis; they appear on the Kiosk Dashboard.
  Choose a scene with **Kiosk Scene** in the banner at the top of the page,
  or set each kiosk's page on the Kiosk Dashboard.
- **Cameras and photo stands.** See [Cameras and replays](cameras-and-replays.md)
  and [Photos](photos.md).

## Check-in

As each car passes inspection, check it in on **Race Check-In**: find the
racer (the columns sort, and there's a search) and flip **Checked In**. Only
checked-in racers are scheduled.

- **Barcode scanner**: scan the racer's check-in card; **Barcode Responses**
  on the page chooses what a scan does (check in, open the racer, take
  photos…).
- **Mobile Check-In**: helpers with phones can check racers in and take their
  photos. Log in, or scan the QR code shown under **Mobile** on the check-in
  page (no login needed; it stops working when you make a **New Code**).
- **Bulk** check-in, renumbering and award eligibility work on whole groups.
- **New Racer** adds a walk-up; **Delete Racer** removes one.
- **Photos**: take or upload racer and car photos from each racer's row. See
  [Photos](photos.md).

## Racing

Everything happens on the **Race Dashboard** (RaceCoordinator or
Administrator).

- **The rounds.** Each round has a card showing its status and its next step:
  schedule it, race it, or it's done. Click a round for its controls. If you
  have a playlist, **Start Playlist** runs it.
- **Racing.** Choose the round to race, and switch **Racing** on. The current
  heat goes to the timer (and to the "now racing" displays); when the timer
  reports results, they're recorded and the next heat is staged. If the timer
  can release the gate, **Start Race** does.
- **Manual Results** enters or corrects a heat's times or places by hand.
- **Re-Run** a heat: make it the current heat, then **Re-Run** (or **Manual
  Results > Discard Results**, then switch Racing back on).
- **Late arrivals, or a racer in the wrong group.** Check them in, or fix
  their group, on Race Check-In. If that changes a round already being raced,
  its card on the dashboard turns orange and offers to adjust the schedule;
  the now-racing displays show that the schedule is changing. If it was a
  mistake at check-in, undo it there and the warning clears.
- **More rounds.** **Add New Rounds**: a further round for a group (its top
  finishers from the last round), or an aggregate round drawing finalists from
  several groups. **Grand Finals** is the usual aggregate. Then schedule and
  race it like any other.
- **Replays**: **Replay Settings** and **Trigger Replay**; see
  [Cameras and replays](cameras-and-replays.md).

The **Race Schedule** and **Results By Racer** pages (home page, for everyone)
show who's up next and how everyone's done; they work well on phones.

## Awards

- **Speed awards** come from the standings (Settings > Awards sets how many
  per group). **Standings** shows them round by round and overall.
- **Judging** (RaceCrew and up): drag an award onto a racer, or a racer onto
  an award. Racers already getting a speed award are marked, for
  organizations that don't give them design awards too. Click a racer for an
  ad hoc award made up on the spot ("Best Use of the Color Red").
- **Voting**: let the audience choose some awards; see [Voting](voting.md).
- **Present Awards**: give a kiosk the award presentation page (the awards
  scene does), then on **Present Awards** pick each award and show it.

## Afterwards

- **Export Results** saves the results as a spreadsheet, for sharing.
- **Retrospective** looks back over the event.
- **System Info** (from Set-Up) saves a **snapshot** of the whole database;
  **Import Database** on Set-Up loads one.
- **Purge Data** (Set-Up > Database Tools) clears results, racers, or
  everything, after practice or before next year.

## Where the data is

Each event's data is in its own folder: on a Raspberry Pi server,
`/var/lib/derbynet/<year>/<event>/`:

- `derbynet.sqlite3`: the database (racers, schedules, results)
- `racers/`, `cars/`: photos
- `logs/`: timer logs, when they're turned on
- `imagery/`, `slides/`: your own images for kiosks and the slideshow

The `imagery` and `slides` folders directly in `/var/lib/derbynet` apply to
every event. A standby copies all of this.
