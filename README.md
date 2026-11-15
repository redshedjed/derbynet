# DerbyNet (redshedjed fork)

Race management for Pinewood Derby events: check-in, photos, heat scheduling,
timer integration, results, voting and awards, all served from one web
server to browsers and kiosk displays around the room.

This is a fork of [jeffpiazza/derbynet](https://github.com/jeffpiazza/derbynet)
(see [derbynet.org](https://derbynet.org) for the original project and its
documentation). It has changed a lot since it was forked, and is now heading
into **alpha testing with real hardware**. Expect rough edges.

## What's different from upstream

- **Raspberry Pi deployment.** One script turns a fresh Raspberry Pi OS
  install into a server, a warm standby, a kiosk, or any mix of them, with
  automatic server discovery and failover. See
  [extras/rpi/00README](extras/rpi/00README).
- **Cameras.** Named track cameras (Start, Finish, ...) are set up in
  Settings and assigned to kiosks; replays from any number of cameras play in
  order on any number of displays. The Photo Stand page (camera plus barcode
  scanner) replaces the old photo scripts, and the Live Camera kiosk page
  shows a camera full-screen.
- **Kiosks.** Kiosks get stable numbers ("Kiosk 427") and are managed from
  the Kiosk Dashboard; kiosk locations and scenes are set up in the Kiosk and
  Scene Editors. Kiosk text scales with the screen.
- **Roles.** Three people-facing roles (default passwords in parentheses):
  - **Administrator** (`backstage`): the back end: settings, database, set-up.
  - **RaceCoordinator** (`doyourbest`): runs the event: Race and Kiosk
    Dashboards, presenting awards, plus everything the race crew does.
  - **RaceCrew** (`murphy`): front of house: check-in, photos, judging,
    printables.

  Plus two for devices: **Photo** (`flashbulb`) for photo stands, and
  **Timer** (no password). Logins are there to prevent accidental changes on a
  private event network, not to stand up to a determined attacker. Change the
  passwords in `config-roles.inc` in the server's configuration folder.
- **A new look.** A shared design system (tokens, cards, buttons, tables)
  across every page, a home menu grouped by role and job, a numbered set-up
  flow, and phone-first pages for Mobile Check-In, voting and results.
- **Security and maintenance.** Fixed privilege escalation and SQL injection
  issues, jQuery 3.7, an emulated FastTrack timer for testing, and CI that
  runs the full test suite against a Docker build.

## Running it

Two ways are supported: Raspberry Pis, and Docker. Upstream's Mac, Windows
and Debian installers have been removed.

**On Raspberry Pis** (the intended set-up for events): follow
[extras/rpi/00README](extras/rpi/00README).

**Anywhere else**, build the Docker image from your checkout. The website
needs some generated files that git doesn't carry, so build those first (see
the next section), then:

```bash
docker build -t derbynet_server -f installer/docker/Dockerfile .
docker run --detach -p 80:80 -p 443:443 derbynet_server
```

and browse to `http://localhost/`.

Camera and photo features need a [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts):
`localhost`, or HTTPS. See `docs/Secure Contexts and DerbyNet.fodt`.

## Developing

1. Install [Apache Ant](https://ant.apache.org/), a JDK, and Node. On Windows,
   [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) works:

   ```bash
   sudo apt-get update
   sudo apt-get install ant
   ```

2. From the root of the repository, generate the website files:

   ```bash
   ant generated
   ```

   This also builds PDFs from the documents in [docs/](docs/); that step is
   silently skipped if LibreOffice's `soffice` isn't installed.

3. To talk to a hardware timer, build one or both timer interfaces:

   ```bash
   ant timer-in-browser   # the in-browser timer page
   ant timer-jar          # derby-timer.jar
   ```

4. Run the server image with your local sources mounted in place of the ones
   baked into it. `PATH_TO_YOUR_DATA` is where databases, photos and other data
   go; `PATH_TO_YOUR_REPOSITORY` is this checkout.

   ```powershell
   docker run --detach -p 80:80 -p 443:443 `
     --volume PATH_TO_YOUR_DATA\lib\:/var/lib/derbynet `
     --mount type=bind,src=PATH_TO_YOUR_REPOSITORY\website\,target=/var/www/html,readonly `
     derbynet_server
   ```

### Tests

The test scripts in [testing/](testing/) drive a running server over HTTP.
CI ([.github/workflows/test.yml](.github/workflows/test.yml)) builds the
Docker image, starts it on port 8080, and runs:

```bash
testing/exercise-one-database.sh localhost:8080 ez
testing/test-timer-hardware.sh localhost:8080
```

### Repository layout

| Path         | What's there                                              |
|--------------|-----------------------------------------------------------|
| `website/`   | The PHP web application: every page, kiosk and action      |
| `timer/`     | Timer interfaces (Java jar and in-browser JavaScript)     |
| `extras/`    | Raspberry Pi set-up, kiosk scripts, and other tools       |
| `installer/` | The Docker image and the nginx configs the Pi also uses   |
| `docs/`      | User documentation (LibreOffice sources)                  |
| `testing/`   | Test scripts and test data                                |

Event artwork (logos, emblems) goes in `website/user_images/`, which git
ignores; official logos stay out of the repository.

## Reporting problems

Open an [issue](https://github.com/redshedjed/derbynet/issues) describing
what you did, what you expected, and what actually happened. Logs and
screenshots help, and for hardware problems, the output of
`derbynet-pi doctor` from the Pi involved.

## License

MIT. See [MIT-LICENSE.txt](MIT-LICENSE.txt).
