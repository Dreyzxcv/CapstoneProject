# ForesTrack Installation Guide

This guide covers Windows development and an office-LAN setup using IIS with
PHP FastCGI, Caddy for HTTPS, and PostgreSQL in Docker. The application runs
on the host computer and the database runs in a local container; other
devices connect through Caddy.

## Requirements

Install these tools before setting up the project:

| Tool | Required version / notes |
|---|---|
| Windows | 64-bit Windows edition with full IIS support (typically Pro, Enterprise, or Education; Windows Home does not include full IIS) |
| Git | Current version, for cloning the repository |
| PHP | 8.3 or newer in the 8.x series; PHP 8.3 is required by `composer.json` |
| Composer | Composer 2 |
| Node.js | 20.19+ or 22.12+; npm is included with Node.js |
| Docker Desktop | Current version with the Docker CLI; start Docker Desktop before running the database |
| PostgreSQL client tools | `pg_dump` at the same or a newer major version than the server; required for database backups |
| IIS | Windows edition with IIS support; enable CGI and IIS Management Console |
| IIS URL Rewrite | Required to route Laravel URLs to its front controller |
| Caddy | Required for HTTPS when serving the application to other devices on the LAN |
| Browser | Current Chrome or Edge; camera access for QR scanning requires HTTPS or localhost |

## PHP configuration

Check which `php.ini` the command line uses:

```powershell
php --ini
```

Open the listed `php.ini` and enable the extensions below in its Dynamic
Extensions section. If a matching line is present but starts with `;`, remove
the semicolon. Do not add duplicate entries.

ForesTrack is configured to use PostgreSQL by default, so make sure these
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

## Get the project

Clone the repository and change into its directory:

```powershell
git clone https://github.com/Dreyzxcv/CapstoneProject.git
Set-Location CapstoneProject
```

If the project is already cloned, open PowerShell in the repository folder.

## Start PostgreSQL with Docker

Start Docker Desktop. This repository does not include a Docker Compose
configuration, so create and start the PostgreSQL container directly. Run
these commands once for the initial setup:

```powershell
docker volume create foresttrack-postgres-data
docker run --name foresttrack-postgres --restart unless-stopped `
  -e POSTGRES_DB=foresttrack `
  -e POSTGRES_USER=foresttrack `
  -e POSTGRES_PASSWORD=foresttrack_local_only `
  -p 127.0.0.1:5432:5432 `
  -v foresttrack-postgres-data:/var/lib/postgresql `
  -d postgres:18
docker ps --filter "name=foresttrack-postgres"
```

The container stores PostgreSQL 18 data in the
`foresttrack-postgres-data` Docker volume and binds the port to loopback so
other LAN devices cannot connect directly. To start the existing container
after a stop or restart, use:

```powershell
docker start foresttrack-postgres
docker ps --filter "name=foresttrack-postgres"
```

Its local development database settings are:

| Setting | Value |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `foresttrack` |
| Username | `foresttrack` |
| Password | `foresttrack_local_only` |

These credentials are for local development only. Do not reuse them in a
production environment. To stop PostgreSQL while preserving its data, run
`docker stop foresttrack-postgres`. The named volume preserves the data when
the container stops; do not remove the volume unless you intend to delete the
database data. The backup service runs `pg_dump` on the host; install the
PostgreSQL 18 client tools and make `pg_dump.exe` available in `PATH`, or set
`PG_DUMP_PATH` in `.env` to its full path. See the
[backup plan](BACKUP_PLAN.md) for the backup setup.

## Install dependencies and configure the application

Install the PHP and JavaScript dependencies:

```powershell
composer install
npm install
```

There is no `package-lock.json` in the repository, so use `npm install` rather
than `npm ci`.

Create the local environment file only if one does not already exist. Generate
the application key only when `APP_KEY` is empty; changing an existing key
will invalidate encrypted data and sessions.

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Select-String -Path .env -Pattern '^APP_KEY=.+$' -Quiet)) { php artisan key:generate }
```

Edit `.env` and set these local values:

```dotenv
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000
APP_TIMEZONE=Asia/Manila

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=foresttrack
DB_USERNAME=foresttrack
DB_PASSWORD=foresttrack_local_only

SESSION_SECURE_COOKIE=false
```

`SESSION_SECURE_COOKIE=false` is for local HTTP development only. Use HTTPS
and secure cookies in production. The example environment uses
`MAIL_MAILER=log`; configure a mail transport in `.env` if the installation
must send password-reset emails. Set `APP_TIMEZONE=Asia/Manila` so scheduled
backup times use Philippine local time rather than Laravel's UTC default.

Create the database tables and seed the initial roles and users:

```powershell
php artisan migrate
php artisan db:seed
```

On a fresh database, the seeder creates five starter accounts that share a
development password (`Password123!`). Change the password for every seeded
account before allowing access from other LAN devices. Review
`database\seeders\UsersSeeder.php` for the seeded account names and email
addresses. Do not rely on reseeding to reset an existing user's password.

Build the frontend assets:

```powershell
npm run build
```

## Run locally for development

For development on the host computer only, start:

```powershell
php artisan serve
```

In a second PowerShell window, start the queue worker:

```powershell
php artisan queue:work --tries=1 --timeout=0 --sleep=3
```

Open <http://127.0.0.1:8000> on the host. Do not use `php artisan serve` for
the shared LAN deployment; configure IIS with PHP FastCGI as described below.
For frontend development with hot reload, run `npm run dev` in another
PowerShell window instead of relying on the previously built assets. Run the
scheduler in a separate window when testing scheduled tasks such as automatic
backups:

```powershell
php artisan schedule:work
```

The queue worker must also be running for queued jobs, including backups, to
finish.

## Configure IIS with PHP FastCGI

Use IIS to serve the Laravel `public` directory, with PHP running through
FastCGI. Caddy will handle HTTPS and forward requests to IIS on loopback.

1. Open **Turn Windows features on or off** and enable:
   - **Internet Information Services**
   - **World Wide Web Services > Common HTTP Features > Default Document**
   - **World Wide Web Services > Common HTTP Features > Static Content**
   - **World Wide Web Services > Common HTTP Features > HTTP Errors**
   - **World Wide Web Services > Application Development Features > CGI**
   - **Web Management Tools > IIS Management Console**

   Restart Windows if prompted. CGI is required for IIS's FastCGI support.

2. Install the **IIS URL Rewrite Module** from the
   [Microsoft IIS URL Rewrite download page](https://www.iis.net/downloads/microsoft/url-rewrite).
   Restart IIS Manager after installation. The repository includes
   `public\web.config`, which uses this module to route Laravel requests to
   `index.php`.

3. In **IIS Manager > FastCGI Settings**, add an application:
   - **Full Path:** the full path to `php-cgi.exe`, for example
     `C:\php\php-8.3.31\php-cgi.exe`

   In the FastCGI application's **Environment Variables** collection, add
   `PHPRC` with the path to the PHP configuration file, for example
   `C:\php\php-8.3.31\php.ini`. This makes IIS use the same configured PHP
   extensions as the CLI.

   Ensure the PHP binary's architecture matches the application pool setting
   (normally 64-bit PHP with 32-bit applications disabled).

4. In IIS Manager, create an application pool named `ForestTrackPool`:
   - **.NET CLR version:** No Managed Code
   - **Managed pipeline mode:** Integrated
   - **Enable 32-Bit Applications:** False for 64-bit PHP
   - **Start Mode:** AlwaysRunning
   - **Idle Time-out (minutes):** `0` for a dedicated, always-on host

   Add a handler mapping for the ForestTrack site (or at the server level):
   - **Request path:** `*.php`
   - **Module:** `FastCgiModule`
   - **Executable:** the same full path to `php-cgi.exe`
   - **Name:** `PHP_via_FastCGI`

   If IIS Manager asks to create the corresponding FastCGI application, accept.
   Leave FastCGI instance limits at their defaults initially; adjust them only
   after measuring host CPU and memory while several clients are using the
   application.

5. Create an IIS website named `ForestTrack`:
   - **Physical path:** the repository's `public` directory, for example
     `C:\ForestTrack\public` (not the repository root)
   - **Application pool:** `ForestTrackPool`
   - **Binding:** HTTP, IP address `127.0.0.1`, port `8080`, no host name

   Binding IIS only to loopback keeps direct IIS requests off the LAN; Caddy
   will be the network-facing web server.

6. Give the application-pool identity read access to the project and write
   access only to Laravel's runtime directories. Run PowerShell as
   Administrator, changing the project path if necessary:

   ```powershell
   $project = "C:\ForestTrack"
   icacls $project /grant "IIS AppPool\ForestTrackPool:(OI)(CI)RX" /T
   icacls "$project\storage" /grant "IIS AppPool\ForestTrackPool:(OI)(CI)M" /T
   icacls "$project\bootstrap\cache" /grant "IIS AppPool\ForestTrackPool:(OI)(CI)M" /T
   ```

   If `upload_tmp_dir` or `sys_temp_dir` in `php.ini` points to a custom
   directory, create it and grant the same application-pool identity Modify
   access. Keep `.env` outside the IIS site root; the site's physical path must
   remain the `public` directory.

7. Start the `ForestTrackPool` application pool and `ForestTrack` website in
   IIS Manager. Check the local health endpoint from PowerShell:

   ```powershell
   Invoke-WebRequest http://127.0.0.1:8080/up
   ```

   A successful response confirms IIS can serve Laravel. If it fails, check
   the IIS logs under `C:\inetpub\logs\LogFiles` and the Laravel log at
   `storage\logs\laravel.log`.

## Serve over the LAN with Caddy

To access ForesTrack from other devices on the same network, put Caddy in
front of the loopback-only IIS site.

1. Find the host computer's LAN IPv4 address with:

   ```powershell
   ipconfig
   ```

   Use the IPv4 address of the network adapter that client devices can reach
   (for example, `192.168.1.25`). Reserve that address in the router or assign
   a static address so the URL does not change.

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
       reverse_proxy 127.0.0.1:8080
   }
   ```

   For example, open Notepad from the project directory and save the file as
   `Caddyfile` (set **Save as type** to **All files** so Notepad does not append
   `.txt`). Validate the configuration and start Caddy from that directory:

   ```powershell
   caddy validate --config .\Caddyfile --adapter caddyfile
   caddy run --config .\Caddyfile --adapter caddyfile
   ```

   Leave this PowerShell window open while ForesTrack is being served. Press
   `Ctrl+C` to stop Caddy. Allow inbound TCP traffic to ports `443` and `80` in
   Windows Firewall for the trusted local network. Port 80 allows Caddy to
   redirect HTTP requests to HTTPS.

4. Update `.env` to use the same HTTPS host address:

   ```dotenv
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://192.168.1.25
   APP_TIMEZONE=Asia/Manila
   SESSION_SECURE_COOKIE=true
   ```

   Because the host will serve the system to other users, do not run it with
   `APP_DEBUG=true`. Keep the generated `APP_KEY` and database credentials
   private.

   Clear Laravel's cached configuration and recycle the IIS application pool
   after changing `.env`:

   ```powershell
   Import-Module WebAdministration
   php artisan optimize:clear
   Restart-WebAppPool -Name ForestTrackPool
   ```

   Build frontend assets on the host with `npm run build`.

5. Ensure the Laravel queue worker and scheduler are running on the host. The
   queue worker is required for backup jobs; the scheduler runs the configured
   automatic-backup schedule. For a manually operated setup, open two
   PowerShell windows and run one command in each:

   ```powershell
   php artisan queue:work --tries=1 --timeout=0 --sleep=3
   ```

   ```powershell
   php artisan schedule:work
   ```

   For an always-on host, configure the queue worker and scheduled task as
   described in the [backup plan](BACKUP_PLAN.md). See the
   [operations runbook](OPERATIONS_RUNBOOK.md) for normal startup checks.

6. Open `https://192.168.1.25` from a device on the same LAN. Since the
   `tls internal` directive uses Caddy's internal certificate authority,
   client devices must trust Caddy's root CA for the certificate to be trusted
   without browser warnings. Install the root CA on each client device using
   Caddy's certificate-trust guidance; `caddy trust` on the host does not
   automatically trust the certificate on other devices.

Use a trusted network only. Do not expose IIS port `8080` or PostgreSQL port
`5432` to the LAN or public internet. The Docker command above binds
PostgreSQL to `127.0.0.1` for host-only access. If the host IP changes, update
the Caddyfile and `APP_URL`, then restart Caddy and recycle the IIS application
pool.

## Verify the installation

These commands report the installed tool versions and PHP platform
requirements:

```powershell
php --version
composer --version
composer check-platform-reqs
node --version
npm --version
docker ps --filter "name=foresttrack-postgres"
```

## Common commands

| Task | Command |
|---|---|
| Start the database | `docker start foresttrack-postgres` |
| View database logs | `docker logs -f foresttrack-postgres` |
| Stop the database and preserve data | `docker stop foresttrack-postgres` |
| Run new migrations | `php artisan migrate` |
| Rebuild frontend assets | `npm run build` |
| Run automated tests | `php artisan test` |
