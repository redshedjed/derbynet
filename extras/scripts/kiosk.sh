#! /bin/sh

# Shows DerbyNet full-screen in Chromium: a kiosk (a TV by the track, the
# awards screen, ...) or a replay camera.  For current Raspberry Pi OS
# (Bookworm and later, whose desktop is Wayland) as well as the older X11
# desktop.  Copy the companion kiosk.desktop file into ~/.config/autostart/ to
# start it when the Pi starts; see ../autostart/00README.
#
# Settings come from derbynet.conf -- /etc/derbynet.conf, or on a Pi the copy
# in the boot partition (/boot/firmware/derbynet.conf, or /boot/derbynet.conf
# on older systems), which can be edited from another computer:
#
#   DERBYNET_SERVER  The server, with no trailing slash,
#                    e.g. DERBYNET_SERVER="http://192.168.1.100/derbynet".
#                    (Or give it as this script's first argument.)
#   ADDRESS          This kiosk's name on the Kiosk Dashboard.  Defaults to
#                    the Pi's serial number, so it keeps its name (and the page
#                    assigned to it) across restarts.  No two kiosks may share
#                    one.
#   KIOSK_PAGE       What to show, if not a kiosk: e.g. KIOSK_PAGE=camera.php
#                    for a replay camera.
#   BROWSER          The browser command, if not chromium or chromium-browser.
#
# The screen shouldn't go blank: on the Wayland desktop, turn off Screen
# Blanking in raspi-config (Display Options); on X11 this script does it.

log() {
    test -x /usr/bin/logger && logger -t kiosk "$*"
    echo "kiosk: $*"
}

# On the X11 desktop, a message box while waiting, and no screen blanking or
# mouse pointer.  (The Wayland desktop has no equivalents to call from here.)
if [ -z "$WAYLAND_DISPLAY" -a -n "$DISPLAY" ] ; then
    X11=1
    xset s off
    xset -dpms
    xset s noblank
    test -x /usr/bin/unclutter && unclutter &
    if [ "$LC_ALL" = "" ] ; then
        export LC_ALL=C   # avoids an xmessage font warning
    fi
else
    X11=0
fi
XFONT='-adobe-helvetica-*-r-*--40-0-0-0-p-*-iso8859-1'
message() {
    log "$1"
    if [ $X11 -eq 1 -a -x /usr/bin/xmessage ] ; then
        printf '\n\n   %s\n\n\n' "$1" | \
            xmessage -fn "$XFONT" -buttons '' -center -timeout "$2" -file - &
    fi
}

message "Initializing, please wait." 2

BROWSER=
test -x /usr/bin/chromium-browser && BROWSER=chromium-browser
test -x /usr/bin/chromium && BROWSER=chromium

test -f /etc/derbynet.conf          && . /etc/derbynet.conf
test -f /boot/derbynet.conf         && . /boot/derbynet.conf
test -f /boot/firmware/derbynet.conf && . /boot/firmware/derbynet.conf

test -n "$1" && DERBYNET_SERVER="$1"

if [ -z "$DERBYNET_SERVER" ] ; then
    message "No DERBYNET_SERVER in derbynet.conf." 30
    exit 1
fi
if [ -z "$BROWSER" ] ; then
    message "Chromium isn't installed (sudo apt install chromium)." 30
    exit 1
fi

# The kiosk's name: if the browser restarts, it comes back as the same kiosk,
# rather than as a new one.  The Pi's serial number, else the host name.
if [ -z "$ADDRESS" -a -f /proc/cpuinfo ] ; then
    ADDRESS=$(sed -n -e 's/^Serial[ \t:]*0*\(.*\)/\1/p' /proc/cpuinfo)
fi
if [ -z "$ADDRESS" -a -r /sys/firmware/devicetree/base/serial-number ] ; then
    ADDRESS=$(tr -d '\0' < /sys/firmware/devicetree/base/serial-number | sed -e 's/^0*//')
fi
if [ -z "$ADDRESS" ] ; then
    ADDRESS=$(hostname)
fi

if [ -n "$KIOSK_PAGE" ] ; then
    URL="$DERBYNET_SERVER/$KIOSK_PAGE"
else
    URL="$DERBYNET_SERVER/kiosk.php?address=$ADDRESS"
fi

sleep 2

# Wait for the network and the server, since the browser would otherwise just
# show an error page.
until curl --insecure --connect-timeout 6 --location --silent --output /dev/null \
           "$DERBYNET_SERVER/index.php" ; do
    message "Waiting for the DerbyNet server at $DERBYNET_SERVER" 5
    sleep 5
done

# Chromium's profile: no "restore pages?" prompt after a power cut
PREFS="$HOME/.config/chromium/Default/Preferences"

# The loop restarts the browser if it crashes or is closed
while true ; do
    if [ -f "$PREFS" ] ; then
        sed -i \
            -e 's/"exited_cleanly": *false/"exited_cleanly": true/' \
            -e 's/"exit_type": *"[^"]*"/"exit_type": "Normal"/' \
            "$PREFS"
    fi
    log "Starting $BROWSER at $URL"
    # --unsafely-treat-insecure-origin-as-secure and
    # --use-fake-ui-for-media-stream: a replay camera can use the camera over
    # plain http, without asking.  --autoplay-policy: replays and sounds play
    # without a tap.  --password-store=basic: no "unlock keyring" prompt when
    # the Pi logs in automatically.  The rest: no prompts, bubbles,
    # swipe-back or pinch zoom.
    "$BROWSER" --kiosk \
               --password-store=basic \
               --noerrdialogs \
               --no-first-run \
               --no-default-browser-check \
               --disable-session-crashed-bubble \
               --disable-infobars \
               --disable-features=Translate \
               --disable-pinch \
               --overscroll-history-navigation=0 \
               --autoplay-policy=no-user-gesture-required \
               --unsafely-treat-insecure-origin-as-secure="$DERBYNET_SERVER" \
               --use-fake-ui-for-media-stream \
               --check-for-update-interval=31536000 \
               "$URL"
    log "$BROWSER exited; restarting"
    sleep 3
done
