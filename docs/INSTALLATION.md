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

When using the project's ngrok tunnel, set `APP_URL` in `.env` to the
HTTPS ngrok URL. Rebuild assets with `npm run build` after frontend changes;
the Vite development server is not reachable through the tunnel in the current
development setup.

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
