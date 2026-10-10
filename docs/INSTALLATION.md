# ForestTrack Installation Guide

This guide covers a local Windows development setup using PHP on Windows and
PostgreSQL in Docker. The application itself runs on the host; Docker runs the
database.

## Requirements

Install these tools before setting up the project:

| Tool | Required version / notes |
|---|---|
| Windows | Windows 10/11 64-bit |
| Git | Current version, for cloning the repository |
| PHP | 8.3 or newer in the 8.x series; PHP 8.3 is required by `composer.json` |
| Composer | Composer 2 |
| Node.js | 20.19+ or 22.12+; npm is included with Node.js |
| Docker Desktop | Current version with Docker Compose; start Docker Desktop before running the database |
| Caddy | Required when serving the application to other devices on the LAN over HTTPS |
| Browser | Current Chrome or Edge; camera access for QR scanning requires HTTPS or localhost |

## PHP configuration

Check which `php.ini` the command line uses:

```powershell
php --ini
```

Open the listed `php.ini` and enable the extensions below in its Dynamic
Extensions section. If a matching line is present but starts with `;`, remove
the semicolon. Do not add duplicate entries.

ForestTrack is configured to use PostgreSQL by default, so make sure these
PostgreSQL extensions are enabled:

```ini
extension=pdo_pgsql
extension=pgsql
```

The application and its PDF generation also need the following extensions.
They are commonly enabled by default in PHP distributions for Windows:

```ini
extension=curl
extension=fileinfo
extension=gd
extension=mbstring
extension=openssl
extension=zip
```

Restart any terminal or web server using PHP after editing `php.ini`, then
verify the CLI extensions:

```powershell
php -m
```

Confirm the output includes `PDO`, `pdo_pgsql`, `pgsql`, `curl`, `fileinfo`,
`gd`, `mbstring`, `openssl`, and `zip`.

### MySQL extension lines

The following lines were supplied for the project's PHP setup. They enable
MySQL support, not PostgreSQL. The checked-in application configuration uses
`DB_CONNECTION=pgsql`, so these MySQL extensions are not needed for the
Docker setup below. If the application is intentionally switched to MySQL,
enable these lines instead and configure a MySQL database and Laravel
connection accordingly:

```ini
[PHP]
extension=php_mysqli.dll
extension=php_pdo_mysql.dll
```

For current PHP versions, the equivalent extension names are generally written
as `extension=mysqli` and `extension=pdo_mysql`. Enabling MySQL extensions alone
does not switch the application from PostgreSQL to MySQL.

## Get the project

Clone the repository and change into its directory:

```powershell
git clone https://github.com/Dreyzxcv/CapstoneProject.git
Set-Location CapstoneProject
```

If the project is already cloned, open PowerShell in the repository folder.

## Start PostgreSQL with Docker

Start Docker Desktop, then run this from the project root:

```powershell
docker compose up -d
docker compose ps
```

The Compose file starts PostgreSQL 18 and persists its data in the
`foresttrack-postgres-data` Docker volume. Its local development database
settings are:

| Setting | Value |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `foresttrack` |
| Username | `foresttrack` |
| Password | `foresttrack_local_only` |

These credentials are for local development only. Do not reuse them in a
production environment. To stop PostgreSQL while preserving its data, run
`docker compose down`. Do not add `-v` unless you intend to delete the
database volume and all data in it.

## Install dependencies and configure the application

Install the PHP and JavaScript dependencies:

```powershell
composer install
npm ci
```

Create the local environment file and application key:

```powershell
Copy-Item .env.example .env
php artisan key:generate
```

Edit `.env` and set these local values:

```dotenv
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=foresttrack
DB_USERNAME=foresttrack
DB_PASSWORD=foresttrack_local_only

SESSION_SECURE_COOKIE=false
```

`SESSION_SECURE_COOKIE=false` is for local HTTP development only. Use HTTPS
and secure cookies in production.

Create the database tables and seed the initial roles and users:

```powershell
php artisan migrate
php artisan db:seed
```

Build the frontend assets:

```powershell
npm run build
```

## Run ForestTrack

Start the web server:

```powershell
php artisan serve
```

In a second PowerShell window in the project folder, start the queue worker:

```powershell
php artisan queue:work --tries=1 --timeout=0 --sleep=3
```

Open <http://127.0.0.1:8000> in a browser. The queue worker should remain
running while using the application so queued work can be processed.

## Serve over the LAN with Caddy

To access ForestTrack from other devices on the same network, use the host
computer's LAN IPv4 address and Caddy as an HTTPS reverse proxy. Do not expose
the PHP development server directly to the network.

1. Find the host computer's LAN IPv4 address with:

   ```powershell
   ipconfig
   ```

   Use the IPv4 address of the network adapter that the client devices can
   reach (for example, `192.168.1.25`). Reserve that address in the router or
   assign a static address so the URL does not change.

2. Install Caddy on the host computer. One straightforward Windows option is
   Chocolatey. Open PowerShell as Administrator and run:

   ```powershell
   choco install caddy -y
   ```

   Close and reopen PowerShell, then verify the installation:

   ```powershell
   caddy version
   ```

   If Chocolatey is not installed, follow its
   [Windows installation instructions](https://chocolatey.org/install), or
   download the Windows binary from the
   [official Caddy download page](https://caddyserver.com/download).

3. In the project root, create a file named `Caddyfile` (no file extension)
   with the host address. Replace the example IP with the actual address:

   ```caddyfile
   https://192.168.1.25 {
       tls internal
       reverse_proxy 127.0.0.1:8000
   }
   ```

   For example, open Notepad from the project directory and save the file as
   `Caddyfile` (set **Save as type** to **All files** so Notepad does not append
   `.txt`). Validate the configuration and start Caddy from that directory:

   ```powershell
   caddy validate --config .\Caddyfile --adapter caddyfile
   caddy run --config .\Caddyfile --adapter caddyfile
   ```

   Leave this PowerShell window open while ForestTrack is being served. Press
   `Ctrl+C` to stop Caddy. Allow inbound TCP traffic to ports `443` and `80` in
   Windows Firewall for the trusted local network. Port 80 allows Caddy to
   redirect HTTP requests to HTTPS.

4. Update `.env` to use the same HTTPS host address:

   ```dotenv
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://192.168.1.25
   SESSION_SECURE_COOKIE=true
   ```

   Because the host will serve the system to other users, do not run it with
   `APP_DEBUG=true`. Keep the generated `APP_KEY` and database credentials
   private.

   Restart the Laravel server after changing `.env`:

   ```powershell
   php artisan config:clear
   php artisan serve --host=127.0.0.1 --port=8000
   ```

   Keep the queue worker running in a separate PowerShell window as described
   above. Build frontend assets on the host with `npm run build`.

5. Open `https://192.168.1.25` from a device on the same LAN. Since the
   `tls internal` directive uses Caddy's internal certificate authority,
   client devices must trust Caddy's root CA for the certificate to be trusted
   without browser warnings. Install the root CA on each client device using
   Caddy's certificate-trust guidance; `caddy trust` on the host does not
   automatically trust the certificate on other devices.

Use a trusted network only, and do not expose the development server or
PostgreSQL port to the public internet. If the host IP changes, update the
Caddyfile and `APP_URL`, then restart Caddy and Laravel.

## Verify the installation

These commands report the installed tool versions and PHP platform
requirements:

```powershell
php --version
composer --version
composer check-platform-reqs
node --version
npm --version
docker compose ps
```

## Common commands

| Task | Command |
|---|---|
| Start the database | `docker compose up -d` |
| View database logs | `docker compose logs -f db` |
| Stop the database and preserve data | `docker compose down` |
| Run new migrations | `php artisan migrate` |
| Rebuild frontend assets | `npm run build` |
| Run automated tests | `php artisan test` |
