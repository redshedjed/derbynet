# Cameras and replays

DerbyNet can show live video of the track, and an instant replay of the finish
at the end of each heat, on any of the displays.

## Track cameras

A **track camera** is a named camera on the track: Start, Finish, Side, and
so on.

1. **Name the cameras**: Settings > Cameras > **Add Camera**. Do this before
   race day; no kiosks need to be running. The order there is the order
   replays show them in.
2. **Point a kiosk's camera at the track**: a kiosk Pi with a USB webcam or a
   Pi camera. When you give that kiosk its name on the Kiosk Dashboard
   (**Assign**), make each of its cameras one of the track cameras. From then
   on it streams that camera, whatever page it's showing. One kiosk can have
   several cameras.

Each camera in Settings shows whether it's connected, and can be turned off,
or given its own replay length, number of showings and speed (otherwise the
Race Dashboard's Replay Settings apply).

## Replays

At the end of each heat, displays set to show replays play the replay over
whatever they're showing: each track camera that's on, one after another.

- **Which displays**: in the **Kiosk Editor**, tick **Show replays** for the
  kiosk locations that should show them (the TV by the track, say).
- **How long, how many times, how fast**: the Race Dashboard's **Replay
  Settings**: the replay's length in seconds (down to half a second), how many
  times it plays, and its speed.
- **By hand**: the Race Dashboard's **Trigger Replay** plays a replay now,
  to try the settings. When entering a heat's times with **Manual Results**,
  **Show Replay** plays that heat's replay.

Replays come from the race itself: the timer's start and finish tell the
displays when to record and when to play. Without a timer, use Show Replay in
Manual Results.

## Live video

The **Live Camera** kiosk page shows one track camera's picture, full screen,
live. Give a kiosk that page on the Kiosk Dashboard, and choose the camera (or
leave it to show the first camera that's on). If the kiosk's location shows
replays, the replay slides in over the live picture at the end of each heat.

## Practical notes

- **Video goes over the network**, from each camera kiosk to each display.
  Wi-Fi works, but a busy room full of phones can make it stutter; a wired
  connection for the camera kiosks helps.
- **Power**: a Pi with a camera draws more power. Use a proper power supply,
  and keep USB cables to cameras short.
- **Checking**: `derbynet-pi doctor` on a camera kiosk lists the cameras the
  Pi can see. The Kiosk Dashboard and Settings > Cameras show each camera's
  status.
