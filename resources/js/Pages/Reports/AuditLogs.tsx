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
import { Head, Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { History, Inbox, Search } from 'lucide-react';

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
}

type ActionCategory = 'created' | 'processed' | 'signed' | 'scanned' | 'changed' | 'other';

const CATEGORY_STYLES: Record<ActionCategory, string> = {
    created: 'bg-emerald-100 text-emerald-800',
    processed: 'bg-blue-100 text-blue-800',
    signed: 'bg-violet-100 text-violet-700',
    scanned: 'bg-amber-100 text-amber-800',
    changed: 'bg-gray-200 text-gray-700',
    other: 'bg-gray-100 text-gray-600',
};

const AVATAR_COLORS = ['bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];

function categorize(action: string): ActionCategory {
    if (/created|intake/.test(action)) return 'created';
    if (/processed|issued|uploaded|released/.test(action)) return 'processed';
    if (/signed/.test(action)) return 'signed';
    if (/scanned/.test(action)) return 'scanned';
    if (/status_changed|case_resolved|updated/.test(action)) return 'changed';
    return 'other';
}

function formatAction(action: string): string {
    const parts = action.split('.');
    const verb = parts[parts.length - 1] ?? action;
    return verb
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatModel(modelType: string | null, modelId: number | null): string {
    if (!modelType) return '—';
    const shortName = modelType.split('\\').pop() ?? modelType;
    return modelId ? `${shortName} #${modelId}` : shortName;
}

function relativeTime(dateString: string): string {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const units: Array<[string, number]> = [
        ['year', 31536000],
        ['month', 2592000],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];
    for (const [label, secondsInUnit] of units) {
        const value = Math.floor(seconds / secondsInUnit);
        if (value >= 1) return `${value} ${label}${value > 1 ? 's' : ''} ago`;
    }
    return 'just now';
}

function avatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function AuditLogs({ logs }: AuditLogsProps) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return logs.data;

        return logs.data.filter((log) => {
            const haystack = [
                log.action,
                log.user?.name ?? 'system',
                formatModel(log.model_type, log.model_id),
                log.ip_address ?? '',
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(query);
        });
    }, [logs.data, search]);

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
                    <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-base">Activity Feed</CardTitle>
                        <div className="relative w-full sm:w-72">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by user, action, model, IP..."
                                className="pl-9"
                            />
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
                                        {search ? 'No matching entries' : 'No activity yet'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {search
                                            ? 'Try a different search term.'
                                            : 'Tracked actions will appear here as they happen.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Mobile: stacked cards */}
                                <div className="divide-y divide-gray-100 sm:hidden">
                                    {filtered.map((log) => {
                                        const category = categorize(log.action);
                                        const userName = log.user?.name ?? 'System';
                                        return (
                                            <div key={log.id} className="space-y-2 px-4 py-4">
                                                <div className="flex items-center justify-between gap-2">
                                                    <Badge className={CATEGORY_STYLES[category]}>
                                                        {formatAction(log.action)}
                                                    </Badge>
                                                    <span
                                                        className="text-xs text-gray-500"
                                                        title={new Date(log.created_at).toLocaleString()}
                                                    >
                                                        {relativeTime(log.created_at)}
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
                                                    {formatModel(log.model_type, log.model_id)}
                                                    {log.ip_address && <span className="ml-2 text-gray-400">{log.ip_address}</span>}
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
                                                const category = categorize(log.action);
                                                const userName = log.user?.name ?? 'System';
                                                return (
                                                    <TableRow key={log.id}>
                                                        <TableCell
                                                            className="whitespace-nowrap text-sm text-gray-500"
                                                            title={new Date(log.created_at).toLocaleString()}
                                                        >
                                                            {relativeTime(log.created_at)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(userName)}`}
                                                                >
                                                                    {userName.charAt(0).toUpperCase()}
                                                                </span>
                                                                <span className="text-sm font-medium text-gray-800">{userName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={CATEGORY_STYLES[category]}>
                                                                {formatAction(log.action)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs text-gray-600">
                                                            {formatModel(log.model_type, log.model_id)}
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