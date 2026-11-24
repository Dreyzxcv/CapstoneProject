import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Input } from '@/Components/ui/input';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePoll } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Download, History, Inbox, Search } from 'lucide-react';

interface AuditLogEntry {
    id: number;
    action: string;
    model_type: string | null;
    model_id: number | null;
    ip_address: string | null;
    created_at: string;
    user?: { name: string };
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface AuditLogsProps {
    logs: {
        data: AuditLogEntry[];
        links?: PaginationLink[];
        from?: number;
        to?: number;
        total?: number;
    };
    filters: {
        search: string;
        date_from: string;
        date_to: string;
    };
}

type ActionCategory = 'created' | 'processed' | 'verified' | 'scanned' | 'changed' | 'failed' | 'other';

const CARD = 'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm';
const TH = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500';
const TD = 'px-4 py-3 text-sm';
const LABEL = 'mb-1 block text-xs font-medium text-gray-500';

const CATEGORY_STYLES: Record<ActionCategory, string> = {
    created:   'bg-emerald-100 text-emerald-800',
    processed: 'bg-blue-100 text-blue-800',
    verified:  'bg-green-100 text-green-800',
    scanned:   'bg-amber-100 text-amber-800',
    changed:   'bg-gray-200 text-gray-700',
    failed: 'bg-red-100 text-red-800',
    other:     'bg-gray-100 text-gray-600',
};

const CATEGORY_CHIP_STYLES: Record<ActionCategory | 'all', string> = {
    all:       'bg-gray-800 text-white',
    created:   'bg-emerald-600 text-white',
    processed: 'bg-blue-600 text-white',
    verified:  'bg-green-600 text-white',
    scanned:   'bg-amber-500 text-white',
    changed:   'bg-gray-500 text-white',
    failed: 'bg-red-600 text-white',
    other:     'bg-gray-400 text-white',
};

const CATEGORY_CHIP_INACTIVE: Record<ActionCategory | 'all', string> = {
    all:       'bg-gray-100 text-gray-600 hover:bg-gray-200',
    created:   'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    processed: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    verified:  'bg-green-50 text-green-700 hover:bg-green-100',
    scanned:   'bg-amber-50 text-amber-700 hover:bg-amber-100',
    changed:   'bg-gray-100 text-gray-600 hover:bg-gray-200',
    failed: 'bg-red-50 text-red-700 hover:bg-red-100',
    other:     'bg-gray-100 text-gray-500 hover:bg-gray-200',
};

const AVATAR_COLORS = [
    'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
    'bg-amber-600', 'bg-rose-600', 'bg-cyan-600',
];

const CATEGORY_LABELS: Record<ActionCategory | 'all', string> = {
    all:       'All',
    created:   'Created',
    processed: 'Processed',
    verified:  'Verified',
    scanned:   'Scanned',
    changed:   'Changed',
    failed: 'Failed',
    other:     'Other',
};

const ACTION_LABELS: Record<string, string> = {
    // Assets
    'asset.intake_created':        'Asset intake created',
    'asset.updated':               'Asset updated',
    'asset.status_changed':        'Asset status changed',
    'asset.piece_updated': 'Asset piece updated',
    'asset.split_remainder':       'Asset split (remainder created)',
    'asset.case_details_updated':  'Case details updated',
    'asset.aap_number_updated':    'AAP number updated',
    'asset.stcp_number_updated':   'STCP number updated',
    'qr.scanned':                  'QR code scanned',

    // Incidents and documents
    'incident.created':            'Incident created',
    'document.verified':           'Document verified',
    'document.rejected':           'Document rejected',

    // JEV
    'jev.issued':                  'JEV issued',
    'jev.uploaded':                'JEV file uploaded',
    'disposal_jev.issued':         'Disposal JEV issued',
    'disposal_jev.uploaded':       'Disposal JEV file uploaded',

    // Disposals and donations
    'disposal.partial_processed':  'Disposal partially processed',
    'donation.batch_created':      'Donation batch created',
    'donation.released':           'Donation released',

    // Backup
    'backup.started':              'Backup started',
    'backup.completed':            'Backup completed',
    'backup.failed':               'Backup failed',
    'backup.deleted':              'Old backup deleted',
    'backup.settings_updated':     'Backup settings updated',
};

function categorize(action: string): ActionCategory {
    if (/failed|rejected/.test(action))                                          return 'failed';
    if (/created|intake|split_remainder/.test(action))                           return 'created';
    if (/processed|issued|uploaded|released|started|completed/.test(action))     return 'processed';
    if (/verified/.test(action))                                                 return 'verified';
    if (/scanned/.test(action))                                                  return 'scanned';
    if (/status_changed|case_resolved|updated|deleted/.test(action))             return 'changed';
    return 'other';
}

function formatAction(action: string): string {
    if (ACTION_LABELS[action]) return ACTION_LABELS[action];

    const [module, ...rest] = action.split('.');
    const title = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return rest.length ? `${title(module)}: ${title(rest.join(' '))}` : title(action);
}

function formatModel(modelType: string | null, modelId: number | null): string {
    if (!modelType) return '—';
    const shortName = modelType.split('\\').pop() ?? modelType;
    return modelId ? `${shortName} #${modelId}` : shortName;
}

function formatAbsoluteTime(dateString: string): string {
    return new Date(dateString).toLocaleString('en-PH', {
        month:  'short',
        day:    'numeric',
        hour:   '2-digit',
        minute: '2-digit',
    });
}

function relativeTime(dateString: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    const units: Array<[string, number]> = [
        ['year', 31536000], ['month', 2592000],
        ['day', 86400], ['hour', 3600], ['minute', 60],
    ];
    for (const [label, s] of units) {
        const v = Math.floor(seconds / s);
        if (v >= 1) return `${v} ${label}${v > 1 ? 's' : ''} ago`;
    }
    return 'just now';
}

function avatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function ModelCell({ modelType, modelId }: { modelType: string | null; modelId: number | null }) {
    const label     = formatModel(modelType, modelId);
    const shortName = modelType?.split('\\').pop();

    if (shortName === 'Asset' && modelId) {
        return (
            <Link
                href={route('assets.show', modelId)}
                className="font-mono text-xs text-emerald-700 hover:underline"
            >
                {label}
            </Link>
        );
    }
    return <span className="font-mono text-xs text-gray-600">{label}</span>;
}

// Flash new rows that appeared after a poll
function useNewRowIds(data: AuditLogEntry[]) {
    const prevIdsRef  = useRef<Set<number>>(new Set());
    const [newIds, setNewIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        const currentIds = new Set(data.map((l) => l.id));
        const incoming   = new Set<number>();

        if (prevIdsRef.current.size > 0) {
            for (const id of currentIds) {
                if (!prevIdsRef.current.has(id)) incoming.add(id);
            }
        }

        prevIdsRef.current = currentIds;

        if (incoming.size > 0) {
            setNewIds(incoming);
            const timer = setTimeout(() => setNewIds(new Set()), 2000);
            return () => clearTimeout(timer);
        }
    }, [data]);

    return newIds;
}

export default function AuditLogs({ logs, filters }: AuditLogsProps) {
    usePoll(6000, { only: ['logs'] });

    const [search,   setSearch]   = useState(filters.search   ?? '');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo,   setDateTo]   = useState(filters.date_to   ?? '');
    const [category, setCategory] = useState<ActionCategory | 'all'>('all');

    const newIds = useNewRowIds(logs.data);

    // Debounced server-side filter (search + dates)
    useEffect(() => {
        if (
            search === (filters.search ?? '') &&
            dateFrom === (filters.date_from ?? '') &&
            dateTo === (filters.date_to ?? '')
        ) {
            return;
        }

        const timeout = setTimeout(() => {
            router.get(
                route('audit-logs.index'),
                { search: search || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined },
                { preserveState: true, replace: true, only: ['logs', 'filters'] },
            );
        }, 400);
        return () => clearTimeout(timeout);
    }, [search, dateFrom, dateTo]);

    // Client-side category filter (applied on top of server results)
    const filtered = category === 'all'
        ? logs.data
        : logs.data.filter((log) => categorize(log.action) === category);

    const exportUrl = (() => {
        const params = new URLSearchParams();
        if (search)   params.set('search',    search);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo)   params.set('date_to',   dateTo);
        const qs = params.toString();
        return route('audit-logs.export') + (qs ? `?${qs}` : '');
    })();

    const categories: Array<ActionCategory | 'all'> = [
        'all', 'created', 'processed', 'verified', 'scanned', 'changed', 'failed', 'other',
    ];

    const hasLinks = !!logs.links && logs.links.length > 3;
    const hasTotal = typeof logs.total === 'number';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <History className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">Audit Logs</h2>
                        <p className="text-sm text-gray-500">Append-only record of every tracked action</p>
                    </div>
                </div>
            }
        >
            <Head title="Audit Logs" />

            <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                {/* ── Filters ── */}
                <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                        <div className="sm:col-span-2 lg:col-span-5">
                            <label htmlFor="log-search" className={LABEL}>Search</label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    id="log-search"
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search user, action, IP…"
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-3">
                            <label htmlFor="log-from" className={LABEL}>From</label>
                            <Input
                                id="log-from"
                                type="date"
                                value={dateFrom}
                                max={dateTo || undefined}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                        <div className="lg:col-span-3">
                            <label htmlFor="log-to" className={LABEL}>To</label>
                            <Input
                                id="log-to"
                                type="date"
                                value={dateTo}
                                min={dateFrom || undefined}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-1">
                            <a
                                href={exportUrl}
                                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600 hover:bg-gray-50"
                                title="Export current view as CSV"
                            >
                                <Download className="h-4 w-4" />
                                <span className="lg:hidden">Export CSV</span>
                            </a>
                        </div>
                    </div>

                    {/* Category filter chips */}
                    <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCategory(cat)}
                                aria-pressed={category === cat}
                                className={cn(
                                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                                    category === cat
                                        ? CATEGORY_CHIP_STYLES[cat]
                                        : CATEGORY_CHIP_INACTIVE[cat],
                                )}
                            >
                                {CATEGORY_LABELS[cat]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Activity ── */}
                <div className={CARD}>
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                <Inbox className="h-6 w-6 text-gray-400" />
                            </span>
                            <div>
                                <p className="font-medium text-gray-700">
                                    {search || category !== 'all' ? 'No matching entries' : 'No activity yet'}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {search || category !== 'all'
                                        ? 'Try a different search term or filter.'
                                        : 'Tracked actions will appear here as they happen.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: stacked cards */}
                            <ul className="divide-y divide-gray-100 md:hidden">
                                {filtered.map((log) => {
                                    const cat      = categorize(log.action);
                                    const userName = log.user?.name ?? 'System';
                                    const isNew    = newIds.has(log.id);
                                    return (
                                        <li
                                            key={log.id}
                                            className={cn(
                                                'space-y-2 px-4 py-4 transition-colors duration-[1500ms]',
                                                isNew && 'bg-emerald-50',
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <Badge className={cn('whitespace-normal', CATEGORY_STYLES[cat])}>
                                                    {formatAction(log.action)}
                                                </Badge>
                                                <span
                                                    className="shrink-0 text-xs text-gray-500"
                                                    title={relativeTime(log.created_at)}
                                                >
                                                    {formatAbsoluteTime(log.created_at)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                                <span
                                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(userName)}`}
                                                >
                                                    {userName.charAt(0).toUpperCase()}
                                                </span>
                                                {userName}
                                            </div>
                                            <p className="font-mono text-xs text-gray-500">
                                                <ModelCell modelType={log.model_type} modelId={log.model_id} />
                                                {log.ip_address && (
                                                    <span className="ml-2 text-gray-400">{log.ip_address}</span>
                                                )}
                                            </p>
                                        </li>
                                    );
                                })}
                            </ul>

                            {/* Tablet / desktop: table */}
                            <table className="hidden w-full divide-y divide-gray-200 md:table">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className={TH}>Time</th>
                                        <th scope="col" className={TH}>User</th>
                                        <th scope="col" className={TH}>Action</th>
                                        <th scope="col" className={TH}>Model</th>
                                        <th scope="col" className={TH}>IP Address</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((log) => {
                                        const cat      = categorize(log.action);
                                        const userName = log.user?.name ?? 'System';
                                        const isNew    = newIds.has(log.id);
                                        return (
                                            <tr
                                                key={log.id}
                                                className={cn(
                                                    'transition-colors duration-[1500ms] hover:bg-gray-50',
                                                    isNew && 'bg-emerald-50',
                                                )}
                                            >
                                                <td
                                                    className={cn(TD, 'whitespace-nowrap text-gray-600')}
                                                    title={relativeTime(log.created_at)}
                                                >
                                                    {formatAbsoluteTime(log.created_at)}
                                                </td>
                                                <td className={TD}>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(userName)}`}
                                                        >
                                                            {userName.charAt(0).toUpperCase()}
                                                        </span>
                                                        <span className="font-medium text-gray-800">{userName}</span>
                                                    </div>
                                                </td>
                                                <td className={TD}>
                                                    <Badge className={cn('whitespace-nowrap', CATEGORY_STYLES[cat])}>
                                                        {formatAction(log.action)}
                                                    </Badge>
                                                </td>
                                                <td className={TD}>
                                                    <ModelCell modelType={log.model_type} modelId={log.model_id} />
                                                </td>
                                                <td className={cn(TD, 'font-mono text-xs text-gray-500')}>
                                                    {log.ip_address ?? '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </>
                    )}

                    {(hasLinks || hasTotal) && (
                        <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/50 px-4 py-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                            {hasTotal ? (
                                <span>
                                    Showing {logs.from ?? 0}–{logs.to ?? 0} of {logs.total} entries
                                </span>
                            ) : (
                                <span />
                            )}

                            {hasLinks && (
                                <div className="flex flex-wrap items-center gap-1">
                                    {logs.links!.map((link, index) => (
                                        <Link
                                            key={index}
                                            href={link.url ?? '#'}
                                            preserveScroll
                                            aria-current={link.active ? 'page' : undefined}
                                            className={cn(
                                                'min-w-8 rounded-md border px-3 py-1.5 text-center text-xs font-medium',
                                                link.active
                                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                                    : link.url
                                                      ? 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                                      : 'pointer-events-none cursor-not-allowed border-gray-200 bg-white text-gray-300 opacity-40',
                                            )}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}