# ForestTrack Operations Runbook

This runbook is for the administrator operating the Windows host on the
trusted office LAN. IIS serves Laravel through PHP FastCGI, PostgreSQL runs in
Docker, and Caddy provides HTTPS as the LAN-facing reverse proxy.

> `php artisan serve` is for local development only. The IIS/FastCGI setup is
> for the trusted LAN deployment described here, not a hardened public
> production deployment. Do not expose IIS or the database directly to the
> public internet.

## Host prerequisites

- A fixed or DHCP-reserved LAN IPv4 address reachable by office devices.
- Docker Desktop running PostgreSQL via the repository's Compose file.
- IIS with CGI, URL Rewrite, and a configured PHP FastCGI handler, plus
  Composer, Node.js/npm, and Caddy installed as described in the
  [installation guide](INSTALLATION.md).
- An IIS website named `ForestTrack` using application pool `ForestTrackPool`,
  rooted at the repository's `public` directory and bound to `127.0.0.1:8080`.
- The IIS application pool set to start automatically and stay warm on the
  dedicated host (Start Mode `AlwaysRunning`; Idle Time-out `0`).
- The Caddy internal root certificate trusted on every client device that
  needs warning-free HTTPS access.
- Windows Firewall allowing inbound HTTPS (TCP 443) only on the trusted office
  network. Allow TCP 80 only if using Caddy's HTTP-to-HTTPS redirect.

## Normal startup

Start Docker Desktop and ensure the Windows services **World Wide Web
Publishing Service (W3SVC)** and Caddy are running. The queue worker can run
as an NSSM service as documented in the [backup guide](BACKUP_PLAN.md).

1. Open PowerShell in the project folder and start PostgreSQL:

   ```powershell
   docker compose up -d
   docker compose ps
   ```

   Confirm the `db` service is running.

2. Start the IIS application pool and website if they are stopped:

   ```powershell
   Import-Module WebAdministration
   Start-WebAppPool -Name ForestTrackPool
   Start-Website -Name ForestTrack
   ```

3. Confirm IIS can reach Laravel locally:

   ```powershell
   Invoke-WebRequest http://127.0.0.1:8080/up
   ```

4. Start Caddy from the directory containing the `Caddyfile` if it is not
   running as a service:

   ```powershell
   caddy run --config .\Caddyfile --adapter caddyfile
   ```

5. Confirm the queue worker service is running. If it is run manually, start
   it in a separate PowerShell window:

   ```powershell
   php artisan queue:work --tries=1 --timeout=0 --sleep=3
   ```

6. From a trusted LAN client, open the configured HTTPS address, for example
   `https://192.168.1.25`. Sign in and check the dashboard. If the certificate
   is untrusted, confirm that the client has Caddy's internal root CA installed.

When run manually, the queue worker and Caddy must remain running in their
windows. IIS and PostgreSQL should be configured to start with Windows/Docker
Desktop. For automatic startup after a host reboot, configure Caddy and the
queue worker as services with the correct working directory and service
account; the [backup guide](BACKUP_PLAN.md) documents the queue-worker and
Task Scheduler setup.

## Health checks

Run these checks from the project folder:

```powershell
docker compose ps
docker compose logs --tail 50 db
php artisan about
php artisan queue:failed
Invoke-WebRequest http://127.0.0.1:8080/up
```

Also verify in a browser that the HTTPS URL loads and that an authorized user
can sign in. Test QR scanning from a client device after allowing camera
permission.

Review Laravel logs when requests fail:

```powershell
Get-Content storage\logs\laravel.log -Tail 80
```

The PHP FastCGI, Docker, IIS, and Caddy logs also report startup and runtime
errors; check them rather than treating an unavailable feature as a successful
operation. IIS request logs are normally under
`C:\inetpub\logs\LogFiles`.

## Routine operations

| When | Operation |
|---|---|
| Daily/weekly | Confirm the app loads, PostgreSQL is running, and any configured automatic backup succeeded. |
| Weekly | Copy a recent backup to a separate drive or approved off-host location. |
| Before an update | Make a backup and confirm it completed; follow the restore plan in the backup guide. |
| After an update | Run migrations as needed, rebuild frontend assets, recycle the IIS app pool, restart the queue worker, and verify sign-in and key workflows. |
| Quarterly | Perform a restore test using the procedure in the backup guide. |

## Applying an application update

Schedule a maintenance window and notify users before updating. Keep a known
good backup before changing the application or database.

1. Stop the queue worker service/process and put the application into
   maintenance mode. Leave IIS and PostgreSQL running while preparing the
   update.

   ```powershell
   php artisan down
   ```

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

6. Restart the queue worker so it loads the new code. Recycle the IIS app pool:

   ```powershell
   Import-Module WebAdministration
   Restart-WebAppPool -Name ForestTrackPool
   ```

   Restart Caddy only if its configuration changed, then bring the application
   out of maintenance mode:

   ```powershell
   php artisan up
   ```

7. Verify the HTTPS site, login, asset lookup, QR scan, and the workflows
   affected by the update. Review Laravel logs and the queue's failed jobs.

Do not apply database migrations to a live system without a verified backup
and a recovery plan. If an update fails, put the system into maintenance,
preserve logs, and follow the restore instructions in the backup guide rather
than improvising destructive database changes.

## Shutdown

1. Stop the queue worker and Caddy services/processes if shutting the system
   down. Stop the IIS website and application pool if needed:

   ```powershell
   Stop-Website -Name ForestTrack
   Stop-WebAppPool -Name ForestTrackPool
   ```

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
- Restrict firewall access to trusted office devices. Do not expose ports
  `5432` or `8080` to the LAN or public internet; Caddy proxies locally to
  `127.0.0.1:8080`, and PostgreSQL is bound to `127.0.0.1`.
- If the host IP changes, update the Caddyfile and `.env`, restart the
  affected processes, and make sure client devices trust the issuing Caddy
  root certificate.
- For backup scheduling, off-host copies, restore testing, and emergency
  recovery, use the detailed [backup guide](BACKUP_PLAN.md).
