# Running DerbyNet in Docker

For running the server somewhere other than a Raspberry Pi — a laptop, a
desktop, a home server — or for development. Raspberry Pis are the main way
to run an event; see [Raspberry Pi](raspberry-pi.md).

## Build the image

From a checkout of this repository, generate the website files git doesn't
carry, then build the image. This needs [Apache Ant](https://ant.apache.org/)
(and so Java) and Docker:

```bash
ant generated timer-in-browser
docker build -t derbynet_server -f installer/docker/Dockerfile .
```

(The image on Docker Hub, `jeffpiazza/derbynet_server`, is the original
DerbyNet, not this version.)

## Run it

Keep the data in a folder outside the container, so it survives replacing the
container:

```bash
mkdir -p ~/derbynet-data
docker run -d --name derbynet -p 80:80 -p 443:443 \
  -v ~/derbynet-data:/var/lib/derbynet \
  derbynet_server
```

Then browse to `http://localhost/`. The first visit walks you through setting
up the database.

That folder holds each event's database and photos, and DerbyNet's own
configuration (`config-database.inc`, `config-roles.inc`).

To stop it: `docker stop derbynet`. To start it again: `docker start
derbynet`.

## Other computers, and HTTPS

Other devices on the network reach the server at this computer's address,
`http://<its address>/`.

Browsers only let a page use a camera (photos at check-in, track cameras) or a
serial port (the timer page) over a secure connection: `localhost`, or
`https://`. The image serves `https://` too, with a self-signed certificate:
browse to `https://<its address>/` and accept the browser's warning the first
time.

## Behind another web server

To serve DerbyNet as part of an existing site, publish the container's port 80
on the loopback interface only, and have the site's web server pass requests
through:

```bash
docker run -d -p 127.0.0.1:8000:80 -v /var/lib/derbynet:/var/lib/derbynet derbynet_server
```

```nginx
location /derbynet/ {
    proxy_pass http://127.0.0.1:8000/;
}
```

(Not tested in this version.)

## Development

To run your working copy's website code instead of the copy baked into the
image, mount it over the image's:

```bash
docker run -d -p 80:80 -p 443:443 \
  -v ~/derbynet-data:/var/lib/derbynet \
  --mount type=bind,src="$PWD/website",target=/var/www/html,readonly \
  derbynet_server
```

Changes to the PHP and JavaScript show on the next page load. See the
repository's [README](../README.md) for building and testing.
