import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent, CardTitle } from '@/Components/ui/card';
import { Head, router, useForm } from '@inertiajs/react';
import {
    HardDrive,
    CheckCircle2,
    XCircle,
    Loader2,
    FolderOpen,
} from 'lucide-react';
import { FormEvent, useEffect } from 'react';

interface BackupStatus {
    status: 'success' | 'failed' | 'running';
    progress: number;
    stage: string | null;
    filename: string;
    location: string;
    size: string;
    completed_at: string | null;
    error_message: string | null;
}

interface BackupSettings {
    auto_enabled: boolean;
    frequency: 'daily' | 'weekly';
    time: string;
    day_of_week: number;
    backup_path: string | null;
    default_path: string;
    retention_days: number;
    next_run: string | null;
}

interface Props {
    backupStatus: BackupStatus | null;
    canRunBackup: boolean;
    backupSettings: BackupSettings;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BackupPage({ backupStatus, canRunBackup, backupSettings }: Props) {
    const { post, processing } = useForm();

    const settingsForm = useForm({
        auto_enabled:   backupSettings.auto_enabled,
        frequency:      backupSettings.frequency,
        time:           backupSettings.time,
        backup_path: backupSettings.backup_path ?? '',
        day_of_week:    backupSettings.day_of_week,
        retention_days: backupSettings.retention_days,
    });

    const succeeded = backupStatus?.status === 'success';
    const failed    = backupStatus?.status === 'failed';
    const running   = backupStatus?.status === 'running';

    useEffect(() => {
        const refresh = () => {
            if (document.hidden) return;
            router.reload({ only: ['backupStatus', 'backupSettings'] });
        };

        const id = window.setInterval(refresh, running ? 2000 : 10000);
        document.addEventListener('visibilitychange', refresh);

        return () => {
            window.clearInterval(id);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [running]);

    function handleRunBackup(e: FormEvent) {
        e.preventDefault();
        post(route('backup.run'));
    }

    function handleSaveSettings(e: FormEvent) {
        e.preventDefault();
        settingsForm.post(route('backup.settings.update'), { preserveScroll: true });
    }

    const busy = processing || running;

    const formattedDate = backupStatus?.completed_at
        ? new Intl.DateTimeFormat('en-PH', {
              year:   'numeric',
              month:  'short',
              day:    'numeric',
              hour:   '2-digit',
              minute: '2-digit',
          }).format(new Date(backupStatus.completed_at))
        : null;

    const nextRun = backupSettings.next_run
        ? new Intl.DateTimeFormat('en-PH', {
              weekday: 'short',
              month:   'short',
              day:     'numeric',
              hour:    '2-digit',
              minute:  '2-digit',
          }).format(new Date(backupSettings.next_run))
        : null;

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">System Backup</h2>}>
            <Head title="System Backup" />

            <div className="mx-auto max-w-2xl space-y-4 px-4 sm:px-6 lg:px-8">
                {/* Latest backup */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-4">
                                <span
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                        failed
                                            ? 'bg-red-50 text-red-600'
                                            : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                >
                                    <HardDrive className="h-5 w-5" />
                                </span>

                                <div>
                                    <CardTitle className="text-base">Latest Backup</CardTitle>

                                    {backupStatus === null && (
                                        <p className="mt-1 text-sm text-gray-500">
                                            No backups have been created yet. Set an automatic schedule below or run one manually.
                                        </p>
                                    )}

                                    {running && (
                                        <div className="mt-2 w-72 max-w-full space-y-1.5">
                                            <div className="flex items-center justify-between text-sm text-gray-600">
                                                <span>{backupStatus.stage ?? 'Starting...'}</span>
                                                <span className="font-medium text-emerald-700">
                                                    {backupStatus.progress}%
                                                </span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                                <div
                                                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                                    style={{ width: `${backupStatus.progress}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                This can take a few minutes depending on how many documents are
                                                stored. You can leave this page; the backup keeps running in the
                                                background.
                                            </p>
                                        </div>
                                    )}

                                    {succeeded && (
                                        <div className="mt-1 space-y-0.5">
                                            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                                Last backup succeeded
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {formattedDate} &middot; {backupStatus.size}
                                            </p>
                                            <p className="flex items-start gap-1.5 break-all text-xs text-gray-500">
                                                <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                <span>{backupStatus.location}</span>
                                            </p>
                                        </div>
                                    )}

                                    {failed && (
                                        <div className="mt-1 space-y-0.5">
                                            <p className="flex items-center gap-1.5 text-sm text-red-600">
                                                <XCircle className="h-4 w-4 shrink-0" />
                                                Last backup failed
                                            </p>
                                            {formattedDate && (
                                                <p className="text-sm text-gray-500">{formattedDate}</p>
                                            )}
                                            {backupStatus.error_message && (
                                                <p className="max-w-prose text-xs text-red-500">
                                                    {backupStatus.error_message}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {canRunBackup && (
                                <form onSubmit={handleRunBackup} className="shrink-0">
                                    <button
                                        type="submit"
                                        disabled={busy}
                                        className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
                                    >
                                        {busy
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <HardDrive className="h-4 w-4" />
                                        }
                                        {busy ? 'Running...' : 'Run Backup Now'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Schedule & retention */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                        <CardTitle className="text-base">Backup Schedule</CardTitle>

                        <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={settingsForm.data.auto_enabled}
                                    onChange={(e) => settingsForm.setData('auto_enabled', e.target.checked)}
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                Enable automatic backup
                            </label>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-500">Frequency</label>
                                    <select
                                        value={settingsForm.data.frequency}
                                        onChange={(e) =>
                                            settingsForm.setData('frequency', e.target.value as 'daily' | 'weekly')
                                        }
                                        disabled={!settingsForm.data.auto_enabled}
                                        className="w-full rounded-md border-gray-300 text-sm disabled:opacity-50"
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                    </select>
                                </div>

                                {settingsForm.data.frequency === 'weekly' && (
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-gray-500">Day</label>
                                        <select
                                            value={settingsForm.data.day_of_week}
                                            onChange={(e) =>
                                                settingsForm.setData('day_of_week', Number(e.target.value))
                                            }
                                            disabled={!settingsForm.data.auto_enabled}
                                            className="w-full rounded-md border-gray-300 text-sm disabled:opacity-50"
                                        >
                                            {DAYS.map((d, i) => (
                                                <option key={d} value={i}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-500">Time</label>
                                    <input
                                        type="time"
                                        value={settingsForm.data.time}
                                        onChange={(e) => settingsForm.setData('time', e.target.value)}
                                        disabled={!settingsForm.data.auto_enabled}
                                        className="w-full rounded-md border-gray-300 text-sm disabled:opacity-50"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-500">
                                        Delete backups older than (days)
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={settingsForm.data.retention_days}
                                        onChange={(e) =>
                                            settingsForm.setData('retention_days', Number(e.target.value))
                                        }
                                        className="w-full rounded-md border-gray-300 text-sm"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-xs font-medium text-gray-500">Backup folder</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={settingsForm.data.backup_path}
                                            onChange={(e) => settingsForm.setData('backup_path', e.target.value)}
                                            placeholder={backupSettings.default_path}
                                            className="w-full rounded-md border-gray-300 font-mono text-xs"
                                        />
                                        {settingsForm.data.backup_path !== '' && (
                                            <button
                                                type="button"
                                                onClick={() => settingsForm.setData('backup_path', '')}
                                                className="shrink-0 rounded-md border border-gray-300 px-3 text-xs text-gray-600 hover:bg-gray-50"
                                            >
                                                Use default
                                            </button>
                                        )}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-400">
                                        Full path on the server, for example <code>D:\Backups</code> or{' '}
                                        <code>\\SERVER\Share\Backups</code>. Leave empty to use the default folder.
                                        Use a different drive or computer from the system for real protection.
                                    </p>
                                </div>
                            </div>

                            {Object.values(settingsForm.errors).map((err) => (
                                <p key={err} className="text-xs text-red-500">{err}</p>
                            ))}

                            <div className="flex items-center justify-between gap-4">
                                <p className="text-xs text-gray-500">
                                    {backupSettings.auto_enabled && nextRun ? (
                                        <>
                                            Next automatic backup:{' '}
                                            <span className="font-medium text-gray-700">{nextRun}</span>
                                        </>
                                    ) : (
                                        'Automatic backup is off.'
                                    )}
                                </p>
                                <button
                                    type="submit"
                                    disabled={settingsForm.processing}
                                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                                >
                                    {settingsForm.processing ? 'Saving...' : 'Save settings'}
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="space-y-1 text-xs text-gray-400">
                    <p>
                        Backups include the database and all uploaded and generated documents.
                        Backups older than the retention period are deleted automatically, but the latest
                        successful backup is always kept.
                    </p>
                    <p>
                        New backups are saved on the server in{' '}
                        <code>{backupSettings.backup_path ?? backupSettings.default_path}</code>.
                    </p>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}