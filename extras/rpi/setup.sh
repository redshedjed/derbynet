#! /bin/bash
#
# One-time setup of a Raspberry Pi for DerbyNet.  Installs everything needed for
# every role (server, standby, kiosk, replay camera, photo station); which roles
# the Pi actually performs is chosen by ROLES= in derbynet.conf on the SD card's
# boot partition, and can be changed later without re-running this script.
#
# Run from a DerbyNet source checkout, as the user who'll be logged in to the
# desktop (not with sudo; the script calls sudo itself):
#
#   bash extras/rpi/setup.sh                    # keeps existing ROLES, or asks
#   bash extras/rpi/setup.sh --roles "server kiosk"
#
# Safe to re-run: re-running also deploys the checkout's current website code.
# Needs internet access the first time (to install packages).

set -e

ROLES_ARG=""
while [ $# -gt 0 ] ; do
    case "$1" in
        --roles) ROLES_ARG="$2" ; shift 2 ;;
        --roles=*) ROLES_ARG="${1#--roles=}" ; shift ;;
        *) echo "Usage: $0 [--roles \"server kiosk ...\"]" >&2 ; exit 1 ;;
    esac
done

if [ "$(id -u)" -eq 0 ] ; then
    echo "Run this as the user who'll be logged in to the desktop, not as root or with sudo." >&2
    exit 1
fi
command -v apt-get >/dev/null || { echo "This script is for Raspberry Pi OS (Debian)." >&2 ; exit 1 ; }

REPO=$(cd "$(dirname "$0")/../.." && pwd)
for f in website/index.php extras/scripts/kiosk.sh extras/rpi/derbynet-pi extras/rpi/derbynet-pi.conf \
         installer/nginx-configs/conf.d/derbynet_log_format.conf ; do
    [ -f "$REPO/$f" ] || { echo "Missing $REPO/$f; run this from a DerbyNet source checkout." >&2 ; exit 1 ; }
done

if [ -f /boot/firmware/config.txt ] ; then
    BOOT_DIR=/boot/firmware
else
    BOOT_DIR=/boot
fi
BOOT_CONF="$BOOT_DIR/derbynet.conf"
ME=$(id -un)

HAVE_DESKTOP=0
if [ -e /usr/bin/labwc ] || [ -e /usr/bin/wayfire ] || [ -e /usr/bin/startlxde-pi ] ; then
    HAVE_DESKTOP=1
fi

step() { echo ; echo "==> $*" ; }

# Strips Windows line endings, in case the checkout came from a Windows machine.
install_text() {  # install_text MODE SRC DEST
    sed -e 's/\r$//' "$2" | sudo tee "$3" > /dev/null
    sudo chmod "$1" "$3"
}

######## Initial roles

if [ -z "$ROLES_ARG" ] && ! { [ -f "$BOOT_CONF" ] && grep -q '^ROLES=' "$BOOT_CONF" ; } ; then
    echo "Which roles should this Pi start with?  Any of: server standby kiosk replay photo"
    echo "(You can change this later by editing $BOOT_CONF.)"
    read -r -p "Roles [kiosk]: " ROLES_ARG
    ROLES_ARG=${ROLES_ARG:-kiosk}
fi

######## Packages

step "Installing packages"
REQUIRED="curl rsync sqlite3 iputils-ping avahi-daemon avahi-utils libnss-mdns
          nginx php-fpm php-curl php-gd php-sqlite3 ssl-cert
          python3 gphoto2 fswebcam mpg123 v4l-utils"
OPTIONAL="flite"
if [ $HAVE_DESKTOP -eq 1 ] ; then
    REQUIRED="$REQUIRED lxterminal x11-utils xbitmaps"
    OPTIONAL="$OPTIONAL unclutter x11-xserver-utils wlrctl rpicam-apps"
fi

missing() {
    for p in "$@" ; do
        dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q "install ok installed" || echo "$p"
    done
}
NEED=$(missing $REQUIRED $OPTIONAL)
if [ $HAVE_DESKTOP -eq 1 ] && [ ! -x /usr/bin/chromium ] && [ ! -x /usr/bin/chromium-browser ] ; then
    NEED="$NEED chromium"
fi
if [ -n "$(echo $NEED)" ] ; then
    sudo apt-get update
    # shellcheck disable=SC2046
    sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y $(missing $REQUIRED)
    for p in $(missing $OPTIONAL) ; do
        sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "$p" || echo "(optional package $p not available; skipping)"
    done
    if [ $HAVE_DESKTOP -eq 1 ] && [ ! -x /usr/bin/chromium ] && [ ! -x /usr/bin/chromium-browser ] ; then
        sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y chromium \
            || sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y chromium-browser
    fi
else
    echo "All packages already installed."
fi

######## DerbyNet website, from this checkout

step "Deploying DerbyNet website from $REPO"
WWW=/var/www/html/derbynet
sudo mkdir -p "$WWW/local" /var/lib/derbynet/imagery /var/lib/derbynet/slides
sudo rsync -a --delete --exclude=/local/ "$REPO/website/" "$WWW/"
sudo cp "$REPO/installer/nginx-configs/index.html" /var/www/html/index.html
sudo chown -R www-data:www-data "$WWW/local" /var/lib/derbynet
sudo chmod 775 "$WWW/local" /var/lib/derbynet

######## PHP

step "Configuring PHP"
FPM_INI=$(ls /etc/php/*/fpm/php.ini | sort -V | tail -n 1)
FPM_POOL=$(dirname "$FPM_INI")/pool.d/www.conf
# Same settings the derbynet-server package uses
sudo sed -i \
     -e 's#^upload_max_filesize = .*#upload_max_filesize = 16M#' \
     -e 's#^post_max_size = .*#post_max_size = 16M#' \
     -e 's#^memory_limit = 128M#memory_limit = 256M#' \
     -e 's#^session.gc_maxlifetime = .*#session.gc_maxlifetime = 28800#' \
     "$FPM_INI"
FPM_SOCKET=$(sed -n -e 's/^listen *= *//p' "$FPM_POOL" | head -n 1)
[ -n "$FPM_SOCKET" ] || { echo "Couldn't find php-fpm's socket in $FPM_POOL" >&2 ; exit 1 ; }

######## nginx

step "Configuring nginx"
[ -f /etc/ssl/certs/ssl-cert-snakeoil.pem ] || sudo make-ssl-cert generate-default-snakeoil
sudo cp "$REPO/installer/nginx-configs/conf.d/derbynet_log_format.conf" /etc/nginx/conf.d/
sudo tee /etc/nginx/sites-available/derbynet > /dev/null <<EOF
# Written by DerbyNet's extras/rpi/setup.sh
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    include snippets/snakeoil.conf;

    root /var/www/html;
    index index.php index.html;
    server_name _;

    access_log /var/log/nginx/access.log derbynet_log;

    location /derbynet {
        index index.php;
    }

    location ~ derbynet/.*\.php(/.*)?\$ {
        client_max_body_size 16M;
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:$FPM_SOCKET;
        fastcgi_param DERBYNET_CONFIG_DIR $WWW/local;
        fastcgi_param DERBYNET_DATA_DIR /var/lib/derbynet;
    }

    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/derbynet /etc/nginx/sites-enabled/derbynet
sudo nginx -t

######## Client scripts (same layout as the derbynet-extras package)

step "Installing DerbyNet scripts"
sudo mkdir -p /usr/share/derbynet/scripts/lib /usr/share/derbynet/sounds /usr/share/derbynet/conf
for f in "$REPO"/extras/scripts/*.sh ; do
    install_text 755 "$f" "/usr/share/derbynet/scripts/$(basename "$f")"
done
for f in "$REPO"/extras/scripts/lib/* ; do
    install_text 755 "$f" "/usr/share/derbynet/scripts/lib/$(basename "$f")"
done
sudo cp "$REPO"/extras/scripts/*.png /usr/share/derbynet/scripts/ 2>/dev/null || true
sudo cp "$REPO"/extras/sounds/*.mp3 /usr/share/derbynet/sounds/
for f in "$REPO"/extras/conf/* ; do
    install_text 644 "$f" "/usr/share/derbynet/conf/$(basename "$f")"
done
install_text 755 "$REPO/extras/rpi/derbynet-pi" /usr/local/bin/derbynet-pi
# Left over from an earlier, kiosk-only version of this script
sudo rm -f /usr/local/bin/derbynet-kiosk
rm -f "$HOME/.config/autostart/derbynet-kiosk.desktop"

######## Configuration files

step "Writing configuration"
if [ ! -f /etc/derbynet.conf ] ; then
    install_text 644 "$REPO/extras/derbynet.conf" /etc/derbynet.conf
fi
if [ ! -f "$BOOT_CONF" ] ; then
    install_text 644 "$REPO/extras/rpi/derbynet-pi.conf" "$BOOT_CONF"
elif ! grep -q '^ROLES=' "$BOOT_CONF" ; then
    # An older derbynet.conf (e.g. from the derbynet-extras package): keep its
    # settings and add the Pi ones after them.
    sed -e 's/\r$//' "$REPO/extras/rpi/derbynet-pi.conf" | sudo tee -a "$BOOT_CONF" > /dev/null
fi
if [ -n "$ROLES_ARG" ] ; then
    sudo sed -i -e 's/\r$//' -e "s/^ROLES=.*/ROLES=\"$ROLES_ARG\"/" "$BOOT_CONF"
fi

######## systemd units

step "Installing services"
sudo tee /etc/systemd/system/derbynet-roles.service > /dev/null <<'EOF'
[Unit]
Description=Apply DerbyNet roles from derbynet.conf
After=local-fs.target
# Decide whether to announce this Pi as a server before avahi starts
Before=avahi-daemon.service nginx.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/derbynet-pi apply

[Install]
WantedBy=multi-user.target
EOF
sudo tee /etc/systemd/system/derbynet-alias.service > /dev/null <<'EOF'
[Unit]
Description=Publish the DerbyNet server alias (e.g. derbynet.local)
After=avahi-daemon.service network-online.target
Wants=avahi-daemon.service network-online.target

[Service]
ExecStart=/usr/local/bin/derbynet-pi alias
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
# From an earlier version of this script
if [ -f /etc/systemd/system/derbynet-hostname.service ] ; then
    sudo systemctl disable derbynet-hostname.service > /dev/null 2>&1 || true
    sudo rm -f /etc/systemd/system/derbynet-hostname.service
fi
for job in export sync ; do
    sudo tee /etc/systemd/system/derbynet-$job.service > /dev/null <<EOF
[Unit]
Description=DerbyNet standby copying ($job)
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/derbynet-pi $job
Nice=10
IOSchedulingClass=idle
EOF
    sudo tee /etc/systemd/system/derbynet-$job.timer > /dev/null <<EOF
[Unit]
Description=DerbyNet standby copying ($job), every 20 seconds

[Timer]
OnBootSec=30s
OnUnitInactiveSec=20s
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF
done
sudo systemctl daemon-reload
sudo systemctl enable derbynet-roles.service

######## Desktop session

if [ $HAVE_DESKTOP -eq 1 ] ; then
    step "Setting up the desktop session for $ME"
    mkdir -p "$HOME/.config/autostart"
    cat > "$HOME/.config/autostart/derbynet.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Version=1.0
Name=DerbyNet
Comment=Starts the kiosk, replay camera, and/or photo station, per ROLES in derbynet.conf
Exec=/usr/local/bin/derbynet-pi desktop
X-GNOME-Autostart-enabled=true
EOF
    if command -v raspi-config > /dev/null ; then
        sudo raspi-config nonint do_boot_behaviour B4   # desktop, logged in automatically
        sudo raspi-config nonint do_blanking 1          # no screen blanking
    else
        echo "raspi-config not found: enable desktop autologin and disable screen blanking by hand."
    fi
    # Photo station: read the barcode scanner directly
    sudo usermod -a -G input "$ME"
    # Photo station: keep the desktop from grabbing a tethered camera first
    sudo systemctl --global mask gvfs-gphoto2-volume-monitor.service gvfs-mtp-volume-monitor.service \
        > /dev/null 2>&1 || true
else
    step "No desktop installed"
    echo "This is Raspberry Pi OS Lite, so only the server and standby roles will work."
fi

######## Apply

step "Applying roles"
sudo /usr/local/bin/derbynet-pi apply
sudo systemctl reload-or-restart "$(systemctl list-unit-files --type=service --no-legend 'php*-fpm.service' | awk '{print $1}' | sort -V | tail -n 1)" || true
if systemctl is-active -q nginx ; then
    sudo systemctl reload nginx
fi

echo
/usr/local/bin/derbynet-pi status || true
cat <<EOF

Setup complete.  Reboot to start:   sudo reboot

To change what this Pi does, edit ROLES in $BOOT_CONF (on the SD card's
boot partition, which you can also edit from Windows or a Mac), then reboot.
Check on it any time with:   derbynet-pi status    (or: derbynet-pi doctor)
EOF
