# ForestTrack Installation Guide

This guide covers Windows development and an office-LAN setup using IIS with
PHP FastCGI, Caddy for HTTPS, and PostgreSQL in Docker. The application and
database run on the host; other devices connect through Caddy.

## Requirements

Install these tools before setting up the project:

| Tool | Required version / notes |
|---|---|
| Windows | 64-bit Windows edition with full IIS support (typically Pro, Enterprise, or Education; Windows Home does not include full IIS) |
| Git | Current version, for cloning the repository |
| PHP | 8.3 or newer in the 8.x series; PHP 8.3 is required by `composer.json` |
| Composer | Composer 2 |
| Node.js | 20.19+ or 22.12+; npm is included with Node.js |
| Docker Desktop | Current version with Docker Compose; start Docker Desktop before running the database |
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

To access ForestTrack from other devices on the same network, put Caddy in
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

   Clear Laravel's cached configuration and recycle the IIS application pool
   after changing `.env`:

   ```powershell
   Import-Module WebAdministration
   php artisan optimize:clear
   Restart-WebAppPool -Name ForestTrackPool
   ```

   Keep the queue worker running as described above. Build frontend assets on
   the host with `npm run build`.

5. Open `https://192.168.1.25` from a device on the same LAN. Since the
   `tls internal` directive uses Caddy's internal certificate authority,
   client devices must trust Caddy's root CA for the certificate to be trusted
   without browser warnings. Install the root CA on each client device using
   Caddy's certificate-trust guidance; `caddy trust` on the host does not
   automatically trust the certificate on other devices.

Use a trusted network only. Do not expose IIS port `8080` or PostgreSQL port
`5432` to the LAN or public internet. The Compose file binds PostgreSQL to
`127.0.0.1` for host-only access. If the host IP changes, update the Caddyfile
and `APP_URL`, then restart Caddy and recycle the IIS application pool.

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
