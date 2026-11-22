import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent, CardTitle } from '@/Components/ui/card';
import { Head, Link, router, useForm } from '@inertiajs/react';
import axios from 'axios';
import {
    HardDrive,
    CheckCircle2,
    XCircle,
    Loader2,
    FolderOpen,
    AlertTriangle,
    CalendarClock,
    ShieldCheck,
    History,
    BookOpen,
    Settings2,
    ChevronRight,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

type BackupState = 'success' | 'failed' | 'running' | 'stale';

interface BackupStatus {
    status: 'success' | 'failed' | 'running';
    state: BackupState;
    progress: number;
    stage: string | null;
    filename: string;
    location: string;
    size: string;
    started_at: string;
    completed_at: string | null;
    error_message: string | null;
}

interface LastSuccess {
    filename: string;
    location: string;
    size: string;
    completed_at: string | null;
    age: string | null;
}

interface HistoryItem {
    id: number;
    state: BackupState;
    filename: string;
    destination: string;
    size: string | null;
    started_at: string;
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
    timezone: string;
}

interface Props {
    backupStatus: BackupStatus | null;
    lastSuccess: LastSuccess | null;
    backupHistory: HistoryItem[];
    canRunBackup: boolean;
    backupSettings: BackupSettings;
}

interface PathTest {
    ok: boolean;
    message: string;
    path?: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATE_LABEL: Record<BackupState, string> = {
    success: 'Succeeded',
    failed: 'Failed',
    running: 'In progress',
    stale: 'Did not finish',
};

const STATE_BADGE: Record<BackupState, string> = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    failed: 'bg-red-50 text-red-600 ring-red-200',
    running: 'bg-blue-50 text-blue-700 ring-blue-200',
    stale: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const STATE_DOT: Record<BackupState, string> = {
    success: 'bg-emerald-500',
    failed: 'bg-red-500',
    running: 'bg-blue-500 animate-pulse',
    stale: 'bg-amber-500',
};

const labelCls = 'mb-1 block text-xs font-medium text-gray-500';
const inputCls =
    'w-full rounded-md border-gray-300 text-sm focus:border-emerald-500 focus:ring-emerald-500 disabled:bg-gray-50 disabled:opacity-50';

function Chip({ tone, children }: { tone: 'emerald' | 'red' | 'amber' | 'blue' | 'gray'; children: React.ReactNode }) {
    const map = {
        emerald: 'bg-emerald-50 text-emerald-700',
        red: 'bg-red-50 text-red-600',
        amber: 'bg-amber-50 text-amber-700',
        blue: 'bg-blue-50 text-blue-700',
        gray: 'bg-gray-100 text-gray-600',
    };
    return (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${map[tone]}`}>
            {children}
        </span>
    );
}

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
                <span className="text-emerald-700">{icon}</span>
                <CardTitle className="text-base">{title}</CardTitle>
            </div>
            {hint && <span className="text-xs text-gray-400">{hint}</span>}
        </div>
    );
}

export default function BackupPage({ backupStatus, lastSuccess, backupHistory, canRunBackup, backupSettings }: Props) {
    const { post, processing } = useForm();

    const settingsForm = useForm({
        auto_enabled:   backupSettings.auto_enabled,
        frequency:      backupSettings.frequency,
        time:           backupSettings.time,
        backup_path:    backupSettings.backup_path ?? '',
        day_of_week:    backupSettings.day_of_week,
        retention_days: backupSettings.retention_days,
    });

    const [testing, setTesting] = useState(false);
    const [pathTest, setPathTest] = useState<PathTest | null>(null);

    const state = backupStatus?.state ?? null;
    const running = state === 'running';

    useEffect(() => {
        const refresh = () => {
            if (document.hidden) return;
            router.reload({ only: ['backupStatus', 'backupSettings', 'lastSuccess', 'backupHistory'] });
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

    async function handleTestPath() {
        setTesting(true);
        setPathTest(null);
        try {
            const { data } = await axios.post(route('backup.test-path'), {
                backup_path: settingsForm.data.backup_path,
            });
            setPathTest({ ok: true, message: data.message, path: data.path });
        } catch (err: any) {
            const msg =
                err?.response?.data?.errors?.backup_path?.[0] ??
                err?.response?.data?.message ??
                'The test could not be completed.';
            setPathTest({ ok: false, message: msg });
        } finally {
            setTesting(false);
        }
    }

    const busy = processing || running;
    const tz = backupSettings.timezone;
    const auto = settingsForm.data.auto_enabled;

    const fmt = (iso: string | null, opts: Intl.DateTimeFormatOptions = {}) =>
        iso
            ? new Intl.DateTimeFormat('en-PH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: tz,
                  ...opts,
              }).format(new Date(iso))
            : null;

    const nextRun = fmt(backupSettings.next_run, { year: undefined, weekday: 'short' });

    // Overall health
    let health: { tone: 'emerald' | 'red' | 'amber' | 'blue'; title: string; text: string };
    if (running) {
        health = { tone: 'blue', title: 'Backup in progress', text: 'You can leave this page; it keeps running in the background.' };
    } else if (state === 'stale') {
        health = { tone: 'amber', title: 'Latest backup did not finish', text: 'Check that the queue worker is running on the server, then try again.' };
    } else if (state === 'failed') {
        health = {
            tone: 'red',
            title: 'Latest backup failed',
            text: lastSuccess ? 'The last good backup is shown below.' : 'There is no successful backup yet.',
        };
    } else if (!lastSuccess) {
        health = { tone: 'amber', title: 'No successful backup yet', text: 'Run one now or wait for the schedule.' };
    } else {
        health = { tone: 'emerald', title: 'Backups are healthy', text: 'The latest backup succeeded.' };
    }

    const accent = {
        emerald: 'border-t-emerald-500',
        red: 'border-t-red-500',
        amber: 'border-t-amber-500',
        blue: 'border-t-blue-500',
    }[health.tone];

    const HealthIcon = { emerald: ShieldCheck, red: XCircle, amber: AlertTriangle, blue: Loader2 }[health.tone];

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">System Backup</h2>}>
            <Head title="System Backup" />

            <div className="mx-auto max-w-4xl space-y-4 px-4 sm:px-6 lg:px-8">
                {/* Health overview */}
                <Card className={`overflow-hidden border-0 border-t-4 shadow-sm ${accent}`}>
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-4">
                                <Chip tone={health.tone}>
                                    <HealthIcon className={`h-5 w-5 ${running ? 'animate-spin' : ''}`} />
                                </Chip>
                                <div>
                                    <CardTitle className="text-base">{health.title}</CardTitle>
                                    <p className="mt-0.5 text-sm text-gray-500">{health.text}</p>
                                </div>
                            </div>

                            {canRunBackup && (
                                <form onSubmit={handleRunBackup} className="shrink-0">
                                    <button
                                        type="submit"
                                        disabled={busy}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                                    >
                                        {busy
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <HardDrive className="h-4 w-4" />}
                                        {busy ? 'Running...' : 'Run Backup Now'}
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* Progress / failure detail */}
                        {backupStatus && running && (
                            <div className="mt-4 space-y-1.5">
                                <div className="flex items-center justify-between text-sm text-gray-600">
                                    <span>{backupStatus.stage ?? 'Starting...'}</span>
                                    <span className="font-medium text-emerald-700">{backupStatus.progress}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${backupStatus.progress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400">
                                    This can take a few minutes depending on how many documents are stored.
                                </p>
                            </div>
                        )}

                        {backupStatus && (state === 'failed' || state === 'stale') && backupStatus.error_message && (
                            <p
                                className={`mt-4 break-words rounded-md px-3 py-2 text-xs ${
                                    state === 'failed' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                                }`}
                            >
                                {backupStatus.error_message}
                            </p>
                        )}

                        {/* Stat tiles */}
                        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                                <dt className="text-xs font-medium text-gray-500">Last successful backup</dt>
                                {lastSuccess ? (
                                    <>
                                        <dd className="mt-0.5 text-sm font-semibold text-gray-800">{lastSuccess.age}</dd>
                                        <dd className="text-xs text-gray-500">
                                            {fmt(lastSuccess.completed_at)} &middot; {lastSuccess.size}
                                        </dd>
                                    </>
                                ) : (
                                    <dd className="mt-0.5 text-sm text-gray-500">None yet</dd>
                                )}
                            </div>

                            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                                <dt className="text-xs font-medium text-gray-500">Next scheduled run</dt>
                                {backupSettings.auto_enabled && nextRun ? (
                                    <>
                                        <dd className="mt-0.5 text-sm font-semibold text-gray-800">{nextRun}</dd>
                                        <dd className="text-xs text-gray-500">Timezone: {tz}</dd>
                                    </>
                                ) : (
                                    <dd className="mt-0.5 text-sm text-gray-500">Automatic backup is off</dd>
                                )}
                            </div>

                            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                                <dt className="text-xs font-medium text-gray-500">Saved in</dt>
                                <dd className="mt-0.5 flex items-start gap-1.5 break-all text-xs text-gray-700">
                                    <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                                    <span>{backupSettings.backup_path ?? backupSettings.default_path}</span>
                                </dd>
                            </div>
                        </dl>

                        <p className="mt-3 text-xs text-gray-400">
                            The next run is the planned time. The system cannot confirm that the scheduler and queue
                            worker are running on the server.
                        </p>
                    </CardContent>
                </Card>

                {/* Schedule & retention */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                        <SectionTitle icon={<CalendarClock className="h-4 w-4" />} title="Backup Schedule" hint={`Timezone: ${tz}`} />

                        <form onSubmit={handleSaveSettings} className="mt-4 space-y-5">
                            {/* Switch */}
                            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2.5">
                                <span>
                                    <span className="block text-sm font-medium text-gray-700">Automatic backup</span>
                                    <span className="block text-xs text-gray-500">
                                        {auto ? 'On: runs on the schedule below.' : 'Off: only manual backups.'}
                                    </span>
                                </span>
                                <input
                                    type="checkbox"
                                    role="switch"
                                    checked={auto}
                                    onChange={(e) => settingsForm.setData('auto_enabled', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <span
                                    aria-hidden
                                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                                        auto ? 'bg-emerald-600' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                                            auto ? 'left-[22px]' : 'left-0.5'
                                        }`}
                                    />
                                </span>
                            </label>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className={labelCls}>Frequency</label>
                                    <select
                                        value={settingsForm.data.frequency}
                                        onChange={(e) =>
                                            settingsForm.setData('frequency', e.target.value as 'daily' | 'weekly')
                                        }
                                        disabled={!auto}
                                        className={inputCls}
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                    </select>
                                </div>

                                {settingsForm.data.frequency === 'weekly' && (
                                    <div>
                                        <label className={labelCls}>Day</label>
                                        <select
                                            value={settingsForm.data.day_of_week}
                                            onChange={(e) => settingsForm.setData('day_of_week', Number(e.target.value))}
                                            disabled={!auto}
                                            className={inputCls}
                                        >
                                            {DAYS.map((d, i) => (
                                                <option key={d} value={i}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className={labelCls}>Time ({tz})</label>
                                    <input
                                        type="time"
                                        value={settingsForm.data.time}
                                        onChange={(e) => settingsForm.setData('time', e.target.value)}
                                        disabled={!auto}
                                        className={inputCls}
                                    />
                                </div>

                                <div>
                                    <label className={labelCls}>Delete backups older than (days)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={settingsForm.data.retention_days}
                                        onChange={(e) => settingsForm.setData('retention_days', Number(e.target.value))}
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <p className="text-xs text-gray-400">
                                The time uses the server timezone ({tz}), not your browser's. Retention removes expired
                                successful backups automatically. The latest successful backup is always kept, even if
                                it is older than the limit.
                            </p>

                            {/* Folder */}
                            <div>
                                <label className={labelCls}>Backup folder</label>
                                <div className="flex flex-wrap gap-2">
                                    <input
                                        type="text"
                                        value={settingsForm.data.backup_path}
                                        onChange={(e) => {
                                            settingsForm.setData('backup_path', e.target.value);
                                            setPathTest(null);
                                        }}
                                        placeholder={backupSettings.default_path}
                                        className="min-w-0 flex-1 rounded-md border-gray-300 font-mono text-xs focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                    {settingsForm.data.backup_path !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                settingsForm.setData('backup_path', '');
                                                setPathTest(null);
                                            }}
                                            className="shrink-0 rounded-md border border-gray-300 px-3 text-xs text-gray-600 hover:bg-gray-50"
                                        >
                                            Use default
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleTestPath}
                                        disabled={testing}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
                                    >
                                        {testing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        {testing ? 'Testing...' : 'Test folder'}
                                    </button>
                                </div>

                                {pathTest && (
                                    <p
                                        role="status"
                                        className={`mt-2 flex items-start gap-1.5 break-words rounded-md px-3 py-2 text-xs ${
                                            pathTest.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                        }`}
                                    >
                                        {pathTest.ok
                                            ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                                        <span>
                                            {pathTest.message}
                                            {pathTest.ok && pathTest.path && (
                                                <span className="block break-all font-mono text-emerald-800/70">
                                                    {pathTest.path}
                                                </span>
                                            )}
                                        </span>
                                    </p>
                                )}

                                <p className="mt-1.5 text-xs text-gray-400">
                                    Full path on the server, for example <code>D:\Backups</code> or{' '}
                                    <code>\\SERVER\Share\Backups</code>. Leave empty to use the default folder. Use a
                                    different drive or computer from the system for real protection. "Test folder"
                                    creates the folder if missing and writes then deletes a small temporary file. It
                                    does not save anything.
                                </p>
                            </div>

                            {Object.values(settingsForm.errors).map((err) => (
                                <p key={err} className="text-xs text-red-500">{err}</p>
                            ))}

                            <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-4">
                                <p className="text-xs text-gray-500">
                                    {backupSettings.auto_enabled && nextRun ? (
                                        <>
                                            Next automatic backup:{' '}
                                            <span className="font-medium text-gray-700">{nextRun}</span> ({tz})
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

                {/* History */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                        <SectionTitle
                            icon={<History className="h-4 w-4" />}
                            title="Recent Backups"
                            hint={`Last ${backupHistory.length} attempts`}
                        />

                        {backupHistory.length === 0 ? (
                            <p className="mt-3 text-sm text-gray-500">
                                No backups have been created yet. Set an automatic schedule or run one manually.
                            </p>
                        ) : (
                            <ul className="mt-3 divide-y divide-gray-100">
                                {backupHistory.map((h) => (
                                    <li key={h.id} className="flex gap-3 py-3">
                                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATE_DOT[h.state]}`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_BADGE[h.state]}`}
                                                    >
                                                        {STATE_LABEL[h.state]}
                                                    </span>
                                                    <span className="text-sm text-gray-700">
                                                        {fmt(h.completed_at ?? h.started_at)}
                                                    </span>
                                                </div>
                                                {h.size && (
                                                    <span className="text-sm font-medium text-gray-600">{h.size}</span>
                                                )}
                                            </div>
                                            <p className="mt-1 flex items-start gap-1.5 break-all font-mono text-xs text-gray-500">
                                                <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                                                <span>{h.destination}</span>
                                            </p>
                                            <p className="mt-0.5 break-all pl-5 text-xs text-gray-400">{h.filename}</p>
                                            {h.error_message && h.state !== 'success' && (
                                                <p className="mt-1.5 break-words rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
                                                    {h.error_message}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                {/* Recovery */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4">
                                <Chip tone="gray">
                                    <BookOpen className="h-5 w-5" />
                                </Chip>
                                <div>
                                    <CardTitle className="text-base">Recovery</CardTitle>
                                    <p className="mt-0.5 max-w-prose text-sm text-gray-500">
                                        Restoring is a manual, server-side procedure on purpose, because it replaces
                                        live data. It cannot be started from this page.
                                    </p>
                                </div>
                            </div>
                            <Link
                                href={route('backup.guide')}
                                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                            >
                                Open backup &amp; restore guide
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <p className="flex items-start gap-1.5 text-xs text-gray-400">
                    <Settings2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Backups include the database and all uploaded and generated documents. They are not downloadable
                    from this page; copy them from the backup folder on the server.
                </p>
            </div>
        </AuthenticatedLayout>
    );
}