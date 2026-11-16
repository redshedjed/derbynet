# Timer messages

How the timer interface talks to the DerbyNet server. The timer interface is
the code in [timer/derbynet-timer/src/js](../../timer/derbynet-timer/src/js),
run either by the timer page in a browser or by the headless timer on a Pi
([timer/headless](../../timer/headless)). A "smart" timer could implement this
protocol itself and talk to the server directly.

```
  Race timer  <-- serial -->  timer interface  <-- HTTP -->  DerbyNet server
```

The timer interface sends HTTP POST requests to `action.php`, with a
form-encoded body (`application/x-www-form-urlencoded`; `multipart/form-data`
also works). Every request has an `action` parameter. Logs go to a different
URL; see [Remote logging](#remote-logging).

## Logging in

Before the server accepts anything, the interface logs in and gets a session
cookie:

```
POST /derbynet/action.php
Content-Type: application/x-www-form-urlencoded

action=role.login&name=Timer&password=
```

(By default there's a Timer role with no password.) The reply is JSON, with a
`Set-Cookie` header for the session:

```json
{"outcome": {"summary": "success", "code": "success", "description": ""}}
```

Send the cookie with every later request. The timer page in a browser uses the
browser's own login instead.

The server tells timer interfaces apart by their **User-Agent** header (see
[One interface at a time](#one-interface-at-a-time)), so keep it the same for
the life of a connection.

## Messages to the server

After logging in, every request has `action=timer-message` and a `message`
parameter saying what's being reported. Every message also carries
`remote-start=YES` or `remote-start=NO`, saying whether the timer can release
the start gate (see [Remote start](#remote-start)).

### `message=HELLO`

Sent once after logging in: the interface is running and looking for the
timer. Optional `interface` and `build` parameters name the interface and its
version, for the server to show.

### `message=IDENTIFIED`

The timer has been found. Optional parameters:

- `lane_count`: the number of lanes, if the timer reports it
- `timer`: an identifier for the type of timer
- `human`: a human-readable name for it (maker and model)
- `ident`: the timer's own identification, e.g. a serial number
- `options`: special features of this timer, as `key:value` pairs separated by
  commas
- `vid`, `pid`: the USB vendor and product ids of the serial adapter
- `confirmed`: `0` if the timer can't answer when asked what it is, so its
  identity isn't confirmed until it sends something

### `message=STARTED`

The start gate opened (for timers that report it).

### `message=FINISHED`

The heat's results. For each lane with a result, `laneN` is the time and
`placeN` the place (if the timer reports places):

```
action=timer-message&message=FINISHED&lane1=3.2100&place1=2&lane2=3.0500&place2=1
```

A lane whose car never finished is sent as `9.9999`. The server refuses
results if no heat is being raced.

### `message=HEARTBEAT`

A keep-alive, sent about twice a second when nothing else is. It's also how
the interface hears about the next heat, in the reply. Optional parameters:

- `unhealthy`: present if the timer isn't currently usable
- `confirmed`: `0` if the timer's identity isn't confirmed yet (see
  IDENTIFIED)

### `message=MALFUNCTION`

Contact with the timer has been lost (an unplugged cable, say), or something
else is wrong. Parameters:

- `detectable`: `1` if the interface will notice when the problem is fixed
  (the cable is plugged back in), `0` if someone will have to say so
- `error`: a description of the problem

### `message=FLAGS`

The interface's settings ("flags"), sent when the server asks with `<query/>`.
Each flag is two parameters:

- `flag-NAME=TYPE:VALUE`, e.g. `flag-ignore-place=bool:false`
- `desc-NAME=DESCRIPTION`

The server shows these on the Timer Testing page, and changes them with
`<assign-flag>`.

## Replies from the server

Replies to `timer-message` are XML, an `<action-response>` element that may
carry any of these, some of them not about the message just sent:

| Element | Meaning |
|---------|---------|
| `<success/>` | The message was received and handled. |
| `<failure code="...">text</failure>` | It wasn't; `code` is short, the text human-readable. E.g., results with no heat being raced. |
| `<heat-ready lane-mask="..." class="..." round="..." roundid="..." heat="..." lanes="..."/>` | A heat is staged. See below. |
| `<abort/>` | Forget the last `heat-ready`: the schedule changed. |
| `<remote-start/>` | Release the start gate now (see [Remote start](#remote-start)). |
| `<remote-log send="true\|false"/>` | Turn remote logging on or off (see [Remote logging](#remote-logging)). |
| `<query/>` | Send a FLAGS message. |
| `<assign-flag flag="..." value="..."/>` | Change a flag's value. |
| `<competing>user agent</competing>` | Another timer interface is connected (see below). |

`heat-ready` attributes:

- `lane-mask`: which lanes have cars, as a decimal bit mask: bit 0 is lane 1.
  E.g. `14` (binary 1110) means lane 1 is empty and lanes 2, 3 and 4 have cars.
- `class`: the racing group's name
- `round`: the round number within the group (1 for the first round)
- `roundid`: the round's id, unique across all groups
- `heat`: the heat number within the round, starting at 1
- `lanes`: the number of lanes on the track

## One interface at a time

The server accepts one timer interface at a time, and tells them apart by
User-Agent. If a HELLO arrives while another interface has been heard from in
the last second, the newcomer gets `<competing>` and should stop; once the
first interface goes quiet, a new one is accepted, and the old one then gets
`<competing>` if it comes back.

## Remote start

Some timers can release the start gate with a solenoid. A timer interface for
one says so with `remote-start=YES` on every message, and the Race Dashboard
then offers a **Start Race** button. When it's pressed, the next reply
includes `<remote-start/>`, and the interface releases the gate.

## Remote logging

When the server sends `<remote-log send="true"/>` (turned on from the Timer
Testing page), the interface POSTs its log to `post-timer-log.php`, as
`text/plain`; the server appends it to the timer log it keeps. Each line
starts with a time (`+ss.mmm`), then a direction: `S -->` to the timer,
`S <--` from it, `H <--` from the server, `* INT` the interface's own notes.
Repeated polling is summarized as `S ... N more like that`.
