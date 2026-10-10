# ForestTrack Operations Runbook

This runbook is for the administrator operating the Windows host on the
trusted office LAN. The current setup runs Laravel and its queue worker on the
host, PostgreSQL in Docker, and Caddy as an HTTPS reverse proxy.

> The Laravel command `php artisan serve` is a development server. This
> runbook describes the current LAN pilot setup, not a hardened public
> production deployment. Do not expose the PHP development server or database
> to the public internet.

## Host prerequisites

- A fixed or DHCP-reserved LAN IPv4 address reachable by office devices.
- Docker Desktop running PostgreSQL via the repository's Compose file.
- PHP, Composer, Node.js/npm, and Caddy installed as described in the
  [installation guide](INSTALLATION.md).
- The Caddy internal root certificate trusted on every client device that
  needs warning-free HTTPS access.
- Windows Firewall allowing inbound HTTPS (TCP 443) only on the trusted office
  network. Allow TCP 80 only if using Caddy's HTTP-to-HTTPS redirect.

## Normal startup

Open PowerShell in the project folder. Start each long-running process in its
own window, or use the service setup documented in the
[backup guide](BACKUP_PLAN.md) for the queue worker and scheduler.

1. Start Docker Desktop, then start PostgreSQL:

   ```powershell
   docker compose up -d
   docker compose ps
   ```

   Confirm the `db` service is running before starting Laravel.

2. Start the Laravel app:

   ```powershell
   php artisan serve --host=127.0.0.1 --port=8000
   ```

3. Start the queue worker in another PowerShell window:

   ```powershell
   php artisan queue:work --tries=1 --timeout=0 --sleep=3
   ```

4. Start Caddy from the directory containing the `Caddyfile`:

   ```powershell
   caddy run --config .\Caddyfile --adapter caddyfile
   ```

5. From a trusted LAN client, open the configured HTTPS address, for example
   `https://192.168.1.25`. Sign in and check the dashboard. If the certificate
   is untrusted, confirm that the client has Caddy's internal root CA installed.

Keep the application, queue worker, and Caddy windows open when running them
manually. Closing a window stops its process. For automatic startup after a
host reboot, configure services/tasks with the correct executable paths,
working directory, and service account; the
[backup guide](BACKUP_PLAN.md) documents the existing queue-worker and
Task Scheduler setup.

## Health checks

Run these checks from the project folder:

```powershell
docker compose ps
docker compose logs --tail 50 db
php artisan about
php artisan queue:failed
```

Also verify in a browser that the HTTPS URL loads and that an authorized user
can sign in. Test QR scanning from a client device after allowing camera
permission.

Review Laravel logs when requests fail:

```powershell
Get-Content storage\logs\laravel.log -Tail 80
```

The PHP, Docker, and Caddy consoles also report startup and runtime errors;
check those windows or service logs rather than treating an unavailable
feature as a successful operation.

## Routine operations

| When | Operation |
|---|---|
| Daily/weekly | Confirm the app loads, PostgreSQL is running, and any configured automatic backup succeeded. |
| Weekly | Copy a recent backup to a separate drive or approved off-host location. |
| Before an update | Make a backup and confirm it completed; follow the restore plan in the backup guide. |
| After an update | Run migrations as needed, rebuild frontend assets, restart Laravel and the queue worker, and verify sign-in and key workflows. |
| Quarterly | Perform a restore test using the procedure in the backup guide. |

## Applying an application update

Schedule a maintenance window and notify users before updating. Keep a known
good backup before changing the application or database.

1. Stop the Laravel server and queue worker (or stop their configured
   services). Leave PostgreSQL running while preparing the update.
2. Update the project files using the team's approved source-control process.
3. From the project root, install dependencies and build assets:

   ```powershell
   composer install
   npm ci
   npm run build
   ```

4. Review the update notes for database changes. If migrations are included,
   run them after verifying the backup:

   ```powershell
   php artisan migrate --force
   ```

5. Clear cached configuration and application data:

   ```powershell
   php artisan optimize:clear
   ```

6. Restart Laravel, the queue worker, and Caddy if its configuration changed.
   Restart the worker after application code changes so it loads the new code.
7. Verify the HTTPS site, login, asset lookup, QR scan, and the workflows
   affected by the update. Review Laravel logs and the queue's failed jobs.

Do not apply database migrations to a live system without a verified backup
and a recovery plan. If an update fails, put the system into maintenance,
preserve logs, and follow the restore instructions in the backup guide rather
than improvising destructive database changes.

## Shutdown

1. Stop Caddy and Laravel/queue processes with `Ctrl+C` in their respective
   windows, or stop their configured services.
2. Stop the database only when needed:

   ```powershell
   docker compose down
   ```

   This stops the container but preserves the `foresttrack-postgres-data`
   volume. Do not use `docker compose down -v` unless intentionally deleting
   the database and all its stored data.

## Configuration and security reminders

- Keep `.env`, `APP_KEY`, database credentials, uploaded files, and backups
  private. Do not commit `.env` or production data to source control.
- Keep `APP_DEBUG=false` when other users access the LAN installation.
- Use `APP_URL` matching the HTTPS address in the Caddyfile, and keep
  `SESSION_SECURE_COOKIE=true` for HTTPS access.
- Restrict firewall access to trusted office devices. Do not expose port 5432
  or port 8000 to the LAN or public internet; Caddy proxies locally to
  `127.0.0.1:8000`.
- If the host IP changes, update the Caddyfile and `.env`, restart the
  affected processes, and make sure client devices trust the issuing Caddy
  root certificate.
- For backup scheduling, off-host copies, restore testing, and emergency
  recovery, use the detailed [backup guide](BACKUP_PLAN.md).
