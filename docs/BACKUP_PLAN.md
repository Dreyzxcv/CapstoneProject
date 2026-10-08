# ForestTrack: Backup Setup Guide for Admins

This guide gets automatic backups running. Do the **one-time setup** once on the server. After that, everything is managed from **Settings > Backup** in the system.

> The server (or PC) must stay **turned on** at the scheduled backup time. If it is off, the backup is skipped.

---

## What a backup contains

One ZIP file with:

- `database/db_<timestamp>.sql`: full copy of the database
- `documents/`: all uploaded and generated PDFs

Saved in: `storage\app\private\backups\backup_YYYY-MM-DD_HHMMSS.zip`

---

## Part 1: One-time setup (done on the server)

Open **PowerShell** in the project folder (example: `C:\Users\jjjj\Projects\foresTrack`) for each step.

### Step 1. Check that `pg_dump` works

```powershell
pg_dump --version
```

- Shows a version number: good, go to Step 2.
- "not recognized": find `pg_dump.exe` (usually `C:\Program Files\PostgreSQL\<version>\bin\`) and add this line to `.env`:
  ```
  PG_DUMP_PATH="C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
  ```

### Step 2. Check `.env` settings

Make sure these lines exist in `.env`:

```
APP_TIMEZONE=Asia/Manila
QUEUE_CONNECTION=database
```

Then run:

```powershell
php artisan config:clear
php artisan migrate
```

> `APP_TIMEZONE` matters. Without it, "02:00" means 10:00 AM Philippine time.

### Step 3. Find your PHP path

```powershell
where.exe php
```

Write down the result (example: `C:\php\php.exe`). You need it in Steps 4 and 5.

### Step 4. Turn on the scheduler (Windows Task Scheduler)

This makes the system check every minute if a backup is due.

1. Open **Task Scheduler** > **Create Task** (not "Basic Task").
2. **General** tab:
   - Name: `ForestTrack Scheduler`
   - Select **Run whether user is logged on or not**
   - Check **Run with highest privileges**
3. **Triggers** tab > **New**:
   - Begin the task: **On a schedule** > **Daily**
   - Check **Repeat task every: 1 minute**, **for a duration of: Indefinitely**
   - Check **Enabled** > OK
4. **Actions** tab > **New**:
   - Program/script: your PHP path from Step 3 (example: `C:\php\php.exe`)
   - Add arguments: `artisan schedule:run`
   - Start in: the project folder (example: `C:\Users\jjjj\Projects\foresTrack`)
5. **Settings** tab: uncheck **Stop the task if it runs longer than**. Click OK and enter the Windows password if asked.

### Step 5. Turn on the queue worker (runs the backup itself)

Use **NSSM** so the worker starts automatically when the server boots.

1. Download NSSM from https://nssm.cc and extract it (example: `C:\nssm`).
2. In PowerShell (**Run as administrator**):
   ```powershell
   C:\nssm\win64\nssm.exe install ForestTrackQueue
   ```
3. In the window that opens:
   - **Path:** your PHP path (example: `C:\php\php.exe`)
   - **Startup directory:** the project folder
   - **Arguments:** `artisan queue:work --timeout=1800 --tries=1`
4. Click **Install service**, then start it:
   ```powershell
   C:\nssm\win64\nssm.exe start ForestTrackQueue
   ```

> After every code update, run `php artisan queue:restart` so the worker uses the new code.

### Step 6. Test everything

1. Log in as **System Admin** > **Settings > Backup**.
2. Click **Run Backup Now**. A progress bar should appear and move.
3. When it finishes, the page shows **Last backup succeeded** with the file location.
4. Check the file exists:
   ```powershell
   Get-ChildItem storage\app\private\backups | Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name, Length, LastWriteTime
   ```

If the bar stays at **0% / Queued**, the queue worker (Step 5) is not running.

To test the automatic part: set the time a few minutes ahead on the Backup page, save, and wait. A progress bar should appear on its own.

---

## Part 2: Setting the schedule (done in the system)

Go to **Settings > Backup > Backup Schedule**:

| Setting | What it does |
|---|---|
| Enable automatic backup | Turn auto backup on or off |
| Frequency | Daily, or weekly (then pick the day) |
| Time | Time of day to start the backup |
| Delete backups older than (days) | Backups older than this are deleted automatically (1 to 365, default 30) |

Click **Save settings**. The page shows the **next automatic backup** date and time.

Notes:
- The newest successful backup is **never** deleted, even if it is older than the limit.
- Pick a time when the server is on and people are not busy (example: 12:00 NN if the office PC is off at night).
- If a backup fails, every System Admin gets a notification.

---

## Part 3: Routine (keep backups safe)

| When | What to do |
|---|---|
| Every week | Copy the newest ZIP from `storage\app\private\backups` to an **external drive or another PC**. Backups on the same disk are lost if the disk fails. |
| Every month | Keep one of those copies as the monthly snapshot (for COA audit). Do not delete these. |
| Every quarter | Do a **restore test** (see Part 4, "Test a backup") and write down the date and result. |
| Every day or week | Open the Backup page and check that it says **Last backup succeeded** with a recent date. |

---

## Part 4: Restoring a backup

Use this only if the data is lost or corrupted. **Restoring replaces the current data.** Anything encoded after the backup was made is lost.

### Test a backup first (safe, do this quarterly)

```powershell
# Extract the SQL file from the newest ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Get-ChildItem storage\app\private\backups\*.zip | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$z = [IO.Compression.ZipFile]::OpenRead($zip.FullName)
New-Item -ItemType Directory -Force $env:TEMP\backup-test | Out-Null
$entry = $z.Entries | Where-Object { $_.FullName -like 'database/*.sql' }
[IO.Compression.ZipFileExtensions]::ExtractToFile($entry, "$env:TEMP\backup-test\$($entry.Name)", $true)
$z.Dispose()

# Load it into a throwaway database
$env:PGPASSWORD="your_password"
createdb -h 127.0.0.1 -U your_user restore_test
psql -h 127.0.0.1 -U your_user -d restore_test -f "$env:TEMP\backup-test\$($entry.Name)"

# Compare row counts (should match)
psql -h 127.0.0.1 -U your_user -d restore_test -c "SELECT count(*) FROM assets;"
psql -h 127.0.0.1 -U your_user -d your_db       -c "SELECT count(*) FROM assets;"

# Clean up
dropdb -h 127.0.0.1 -U your_user restore_test
Remove-Item $env:TEMP\backup-test -Recurse -Force
```

Replace `your_user`, `your_db`, and `your_password` with the real values.

### Real restore (emergency)

```powershell
# 1. Stop the app and background workers
php artisan down
C:\nssm\win64\nssm.exe stop ForestTrackQueue

# 2. Safety copy of the current state
$env:PGPASSWORD="your_password"
pg_dump -h 127.0.0.1 -U your_user -f "$env:USERPROFILE\Desktop\before-restore.sql" your_db
Copy-Item storage\app\private\documents "$env:USERPROFILE\Desktop\documents-before-restore" -Recurse

# 3. Extract the backup you want
$backup = "storage\app\private\backups\backup_YYYY-MM-DD_HHMMSS.zip"   # change this
Expand-Archive $backup -DestinationPath $env:TEMP\restore -Force

# 4. Recreate the database and load the dump
psql -h 127.0.0.1 -U your_user -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='your_db' AND pid <> pg_backend_pid();"
dropdb   -h 127.0.0.1 -U your_user your_db
createdb -h 127.0.0.1 -U your_user your_db
psql -h 127.0.0.1 -U your_user -d your_db -f (Get-ChildItem $env:TEMP\restore\database\*.sql).FullName

# 5. Restore the documents
robocopy "$env:TEMP\restore\documents" "storage\app\private\documents" /MIR

# 6. Clear caches and bring the app back
php artisan migrate
php artisan optimize:clear
php artisan permission:cache-reset
php artisan up
C:\nssm\win64\nssm.exe start ForestTrackQueue

# 7. Clean up
Remove-Item $env:TEMP\restore -Recurse -Force
```

After restoring:
- Log in and check assets, documents, and recent JEV records.
- If the Backup page shows a backup stuck as "running", clear it:
  ```powershell
  php artisan tinker
  >>> \App\Models\BackupRecord::whereNull('completed_at')->update(['completed_at' => now()]);
  ```

---

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| Progress bar stays at 0% / "Queued" | Queue worker is not running. Start it: `C:\nssm\win64\nssm.exe start ForestTrackQueue` |
| "Backup did not finish. Make sure the queue worker is running." | Same as above. Start the worker, then click **Run Backup Now** again. |
| No automatic backup at the scheduled time | The server was off, or the Task Scheduler task (Step 4) is disabled. Check that `ForestTrack Scheduler` is Ready and running every minute. |
| Automatic backup ran at the wrong hour | `APP_TIMEZONE=Asia/Manila` is missing in `.env`. Add it, then run `php artisan config:clear`. |
| `pg_dump failed: ...` | Check `pg_dump --version` (Step 1), and that `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` in `.env` are correct. `pg_dump` must not be older than the database server. |
| "Unsupported DB driver" | `DB_CONNECTION` in `.env` is not `pgsql`, `mysql`, or `sqlite`. |
| Backup is slow | Normal. The documents folder is large (about 350 MB now). It takes a few minutes. |
| Backup page not in the Settings menu | The user does not have the `backup.run` permission. Only System Admin has it. |

More details are in `storage\logs\laravel.log`:

```powershell
Get-Content storage\logs\laravel.log -Tail 40
```

---

## Known limits

- No restore button in the system. Restore is manual on purpose, so it cannot be triggered by accident.
- No download button yet. Copy the ZIP files from `storage\app\private\backups` directly.
- Catch-up is same day only. If the server is off the whole day, that day's (or week's) automatic backup is skipped.
- Off-site copy and encryption are manual for now.
- Retention is by days only. Monthly snapshots are kept by hand (see Part 3).