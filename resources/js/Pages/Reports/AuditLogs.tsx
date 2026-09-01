import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/Components/ui/table';
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

type ActionCategory = 'created' | 'processed' | 'verified' | 'scanned' | 'changed' | 'other';

const CATEGORY_STYLES: Record<ActionCategory, string> = {
    created:   'bg-emerald-100 text-emerald-800',
    processed: 'bg-blue-100 text-blue-800',
    verified:  'bg-green-100 text-green-800',
    scanned:   'bg-amber-100 text-amber-800',
    changed:   'bg-gray-200 text-gray-700',
    other:     'bg-gray-100 text-gray-600',
};

const CATEGORY_CHIP_STYLES: Record<ActionCategory | 'all', string> = {
    all:       'bg-gray-800 text-white',
    created:   'bg-emerald-600 text-white',
    processed: 'bg-blue-600 text-white',
    verified:  'bg-green-600 text-white',
    scanned:   'bg-amber-500 text-white',
    changed:   'bg-gray-500 text-white',
    other:     'bg-gray-400 text-white',
};

const CATEGORY_CHIP_INACTIVE: Record<ActionCategory | 'all', string> = {
    all:       'bg-gray-100 text-gray-600 hover:bg-gray-200',
    created:   'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    processed: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    verified:  'bg-green-50 text-green-700 hover:bg-green-100',
    scanned:   'bg-amber-50 text-amber-700 hover:bg-amber-100',
    changed:   'bg-gray-100 text-gray-600 hover:bg-gray-200',
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
    other:     'Other',
};

function categorize(action: string): ActionCategory {
    if (/created|intake/.test(action))                        return 'created';
    if (/processed|issued|uploaded|released/.test(action))    return 'processed';
    if (/verified/.test(action))                              return 'verified';
    if (/scanned/.test(action))                               return 'scanned';
    if (/status_changed|case_resolved|updated/.test(action))  return 'changed';
    return 'other';
}

function formatAction(action: string): string {
    const parts = action.split('.');
    const verb  = parts[parts.length - 1] ?? action;
    return verb.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
        'all', 'created', 'processed', 'verified', 'scanned', 'changed', 'other',
    ];

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

            <div className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6 lg:px-8">
                <Card>
                    <CardHeader className="space-y-3 pb-3">
                        {/* Top row: title + search + dates + export */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base">Activity Feed</CardTitle>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Search */}
                                <div className="relative w-full sm:w-60">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search user, action, IP…"
                                        className="pl-9"
                                    />
                                </div>

                                {/* Date range */}
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-36 text-sm"
                                    title="From date"
                                />
                                <span className="text-xs text-gray-400">to</span>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-36 text-sm"
                                    title="To date"
                                />

                                {/* Export */}
                                <a
                                    href={exportUrl}
                                    className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                    title="Export current view as CSV"
                                >
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Export CSV</span>
                                </a>
                            </div>
                        </div>

                        {/* Category filter chips */}
                        <div className="flex flex-wrap gap-1.5">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={
                                        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                                        (category === cat
                                            ? CATEGORY_CHIP_STYLES[cat]
                                            : CATEGORY_CHIP_INACTIVE[cat])
                                    }
                                >
                                    {CATEGORY_LABELS[cat]}
                                </button>
                            ))}
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                    <Inbox className="h-6 w-6 text-gray-400" />
                                </span>
                                <div>
                                    <p className="font-medium text-gray-700">
                                        {search || category !== 'all' ? 'No matching entries' : 'No activity yet'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {search || category !== 'all'
                                            ? 'Try a different search term or filter.'
                                            : 'Tracked actions will appear here as they happen.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Mobile: stacked cards */}
                                <div className="divide-y divide-gray-100 sm:hidden">
                                    {filtered.map((log) => {
                                        const cat      = categorize(log.action);
                                        const userName = log.user?.name ?? 'System';
                                        const isNew    = newIds.has(log.id);
                                        return (
                                            <div
                                                key={log.id}
                                                className={
                                                    'space-y-2 px-4 py-4 transition-colors duration-[1500ms] ' +
                                                    (isNew ? 'bg-emerald-50' : '')
                                                }
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <Badge className={CATEGORY_STYLES[cat]}>
                                                        {formatAction(log.action)}
                                                    </Badge>
                                                    <span
                                                        className="text-xs text-gray-500"
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
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Desktop: table */}
                                <div className="hidden sm:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Time</TableHead>
                                                <TableHead>User</TableHead>
                                                <TableHead>Action</TableHead>
                                                <TableHead>Model</TableHead>
                                                <TableHead>IP Address</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filtered.map((log) => {
                                                const cat      = categorize(log.action);
                                                const userName = log.user?.name ?? 'System';
                                                const isNew    = newIds.has(log.id);
                                                return (
                                                    <TableRow
                                                        key={log.id}
                                                        className={
                                                            'transition-colors duration-[1500ms] hover:bg-gray-50 ' +
                                                            (isNew ? 'bg-emerald-50' : '')
                                                        }
                                                    >
                                                        <TableCell
                                                            className="whitespace-nowrap text-sm text-gray-600"
                                                            title={relativeTime(log.created_at)}
                                                        >
                                                            {formatAbsoluteTime(log.created_at)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(userName)}`}
                                                                >
                                                                    {userName.charAt(0).toUpperCase()}
                                                                </span>
                                                                <span className="text-sm font-medium text-gray-800">
                                                                    {userName}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={CATEGORY_STYLES[cat]}>
                                                                {formatAction(log.action)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <ModelCell
                                                                modelType={log.model_type}
                                                                modelId={log.model_id}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs text-gray-500">
                                                            {log.ip_address ?? '—'}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}

                        {logs.links && logs.links.length > 3 && (
                            <div className="flex flex-wrap items-center justify-center gap-1 border-t border-gray-100 px-4 py-3">
                                {logs.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url ?? '#'}
                                        preserveScroll
                                        className={
                                            'min-w-9 rounded-md px-3 py-1.5 text-center text-sm ' +
                                            (link.active
                                                ? 'bg-emerald-700 text-white'
                                                : link.url
                                                    ? 'text-gray-600 hover:bg-gray-100'
                                                    : 'cursor-default text-gray-300')
                                        }
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {typeof logs.total === 'number' && (
                    <p className="text-center text-xs text-gray-400">
                        Showing {logs.from ?? 0}–{logs.to ?? 0} of {logs.total} entries
                    </p>
                )}
            </div>
        </AuthenticatedLayout>
    );
}