import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { CircleCheck, Receipt, Search } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { JevInModal, JevOutModal } from '@/Components/Jev/JevDetailModal';
import { PostOptions } from '@/Components/Jev/shared';

interface PendingAsset {
    id: number;
    asset_code: string;
    aap_number: string | null;
    stcp_number: string | null;
    type: string;
    current_status: string;
}

interface DonationBatch {
    id: number;
    batch_code: string;
    recipient: string | null;
    asset_count: number;
    asset_codes: string[];
    released_at: string | null;
    disposal_id: number | null;
}

interface JevRecord {
    id: number;
    asset_code: string | null;
    asset_type: string | null;
    jev_number: string | null;
    jev_date: string | null;
    amount: string | null;
    created_at: string;
    aap_number: string | null;
    stcp_number: string | null;
    asset_id: number | null;
    recipient: string | null;
    disposal_id: number | null;
    jev_type: 'IN' | 'OUT';
}

interface Filters {
    search: string;
    type: '' | 'IN' | 'OUT';
    status: '' | 'issued' | 'pending';
    date_from: string;
    date_to: string;
    sort: string;
    direction: 'asc' | 'desc';
}

interface Props extends PageProps {
    jevs: {
        data: JevRecord[];
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
        total: number;
    };
    pendingAssets: PendingAsset[];
    disposalsAwaitingJevOut: DonationBatch[];
    stats: { pending_in: number; pending_out: number; issued_this_month: number };
    filters: Filters;
    can: { issue_jev: boolean };
}

const PAGE_SIZE = 10;
const DESC_FIRST = ['jev_date', 'amount', 'created_at'];

/**
 * Responsive strategy (the sidebar takes ~260px from `lg` up, so content is
 * actually narrower at `lg` than at `md`):
 *  - Pending sections: cards below `md`, table from `md`.
 *  - All JEVs (many columns): cards below `xl`, table from `xl`;
 *    Type and Recipient columns appear at `2xl` and are folded into the first
 *    column below that.
 */
const CARD = 'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm';
const TH = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500';
const TD = 'px-4 py-3 text-sm';

const selectClass =
    'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600';

const SORT_OPTIONS = [
    { field: 'reference', label: 'AAP/STCP No.' },
    { field: 'jev_number', label: 'JEV No.' },
    { field: 'jev_type', label: 'JEV type' },
    { field: 'asset_type', label: 'Asset type' },
    { field: 'recipient', label: 'Recipient' },
    { field: 'jev_date', label: 'Date' },
    { field: 'amount', label: 'Amount' },
    { field: 'created_at', label: 'Date created' },
];

/* ───────────── Small shared pieces ───────────── */

function StatusPill({ issued, jevType }: { issued: boolean; jevType: 'IN' | 'OUT' }) {
    return issued ? (
        <Badge variant="green" className="whitespace-nowrap">Issued</Badge>
    ) : (
        <Badge variant="amber" className="whitespace-nowrap">Awaiting JEV {jevType}</Badge>
    );
}

function JevTypeBadge({ type }: { type: 'IN' | 'OUT' }) {
    return (
        <Badge variant={type === 'IN' ? 'blue' : 'purple'} className="whitespace-nowrap">
            {type}
        </Badge>
    );
}

function ActionButton({
    onClick,
    children,
    primary = true,
    block = false,
}: {
    onClick: () => void;
    children: ReactNode;
    primary?: boolean;
    block?: boolean;
}) {
    return (
        <Button type="button" size="sm" variant={primary ? 'default' : 'outline'} className={cn(block && 'w-full')} onClick={onClick}>
            {children}
        </Button>
    );
}

function SectionHeading({
    title,
    description,
    count,
    badge,
}: {
    title: string;
    description: string;
    count: number;
    badge: string;
}) {
    return (
        <div className="mb-3">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <Badge variant={badge} className="tabular-nums">{count}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        </div>
    );
}

function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">{icon}</span>
            <div>
                <p className="font-medium text-gray-700">{title}</p>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
            {action}
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-gray-400">{label}</dt>
            <dd className="mt-0.5 truncate text-sm text-gray-700">{children}</dd>
        </div>
    );
}

const TONES = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    green: 'border-green-200 bg-green-50 text-green-800',
};

function StatCard({
    label,
    value,
    hint,
    tone,
    href,
}: {
    label: string;
    value: number;
    hint: string;
    tone: keyof typeof TONES;
    href?: string;
}) {
    const clickable = !!href && value > 0;
    const body = (
        <>
            <p className="text-sm font-medium">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
            <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs">
                <span className="opacity-75">{hint}</span>
                {clickable && <span className="font-semibold group-hover:underline">View list</span>}
            </div>
        </>
    );
    const cls = cn('flex h-full min-h-[7.5rem] flex-col rounded-xl border p-4 shadow-sm', TONES[tone]);
    return clickable ? (
        <a
            href={href}
            className={cn(
                cls,
                'group transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
            )}
        >
            {body}
        </a>
    ) : (
        <div className={cls}>{body}</div>
    );
}

function pageItems(current: number, last: number): (number | '…')[] {
    const items: (number | '…')[] = [];
    for (let p = 1; p <= last; p++) {
        if (p === 1 || p === last || Math.abs(p - current) <= 1) {
            const prev = items[items.length - 1];
            if (typeof prev === 'number' && p - prev > 1) items.push('…');
            items.push(p);
        }
    }
    return items;
}

function Pagination({
    current,
    last,
    from,
    to,
    total,
    onPage,
}: {
    current: number;
    last: number;
    from: number;
    to: number;
    total: number;
    onPage: (page: number) => void;
}) {
    if (total === 0) return null;
    const btn =
        'rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';
    return (
        <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/50 px-4 py-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
                Showing {from}–{to} of {total}
            </span>
            {last > 1 && (
                <div className="flex flex-wrap items-center gap-1">
                    <button type="button" className={btn} onClick={() => onPage(current - 1)} disabled={current === 1}>
                        Previous
                    </button>
                    {pageItems(current, last).map((item, idx) =>
                        item === '…' ? (
                            <span key={`e-${idx}`} className="px-1 text-gray-400">…</span>
                        ) : (
                            <button
                                key={item}
                                type="button"
                                onClick={() => onPage(item)}
                                aria-current={item === current ? 'page' : undefined}
                                className={`min-w-8 rounded-md border px-3 py-1.5 text-xs font-medium ${
                                    item === current
                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                {item}
                            </button>
                        ),
                    )}
                    <button type="button" className={btn} onClick={() => onPage(current + 1)} disabled={current === last}>
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}

function SortHeader({
    label,
    field,
    sort,
    direction,
    onSort,
    className = '',
}: {
    label: string;
    field: string;
    sort: string;
    direction: 'asc' | 'desc';
    onSort: (field: string) => void;
    className?: string;
}) {
    const active = sort === field;
    return (
        <th
            scope="col"
            aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={cn(TH, className)}
        >
            <button
                type="button"
                onClick={() => onSort(field)}
                className={`inline-flex items-center gap-1 uppercase hover:text-gray-800 ${active ? 'text-gray-900' : ''}`}
            >
                {label}
                <span aria-hidden className={active ? 'text-emerald-600' : 'text-gray-300'}>
                    {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
                </span>
            </button>
        </th>
    );
}

const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const formatAmount = (a: string | null) =>
    a ? `₱ ${Number(a).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';

const codesPreview = (b: DonationBatch) =>
    b.asset_codes.length > 0
        ? b.asset_codes.join(', ') +
          (b.asset_count > b.asset_codes.length ? ` +${b.asset_count - b.asset_codes.length} more` : '')
        : null;

/* ───────────── Page ───────────── */

export default function JevIndex({ jevs, pendingAssets, disposalsAwaitingJevOut, stats, filters, can }: Props) {
    const { url } = usePage();
    const basePath = url.split('?')[0];

    const [inPage, setInPage] = useState(1);
    const [outPage, setOutPage] = useState(1);
    const [search, setSearch] = useState(filters.search);

    const inPages = Math.max(1, Math.ceil(pendingAssets.length / PAGE_SIZE));
    const safeInPage = Math.min(inPage, inPages);
    const inSlice = pendingAssets.slice((safeInPage - 1) * PAGE_SIZE, safeInPage * PAGE_SIZE);

    const outPages = Math.max(1, Math.ceil(disposalsAwaitingJevOut.length / PAGE_SIZE));
    const safeOutPage = Math.min(outPage, outPages);
    const outSlice = disposalsAwaitingJevOut.slice((safeOutPage - 1) * PAGE_SIZE, safeOutPage * PAGE_SIZE);

    type Target = { kind: 'in' | 'out'; id: number };

    const [target, setTarget] = useState<Target | null>(null);
    const [open, setOpen] = useState(false);
    const [session, setSession] = useState(0);

    const openJev = (kind: Target['kind'], id: number) => {
        setTarget({ kind, id });
        setSession((s) => s + 1); // remounts content: fresh fetch, empty form
        setOpen(true);
    };
    const closeJev = () => setOpen(false);

    // After issuing, the pending lists and stats must refresh too,
    // not just `jevs`/`filters` like the filter visits do.
    const postOptions: PostOptions = {
        preserveState: true,
        preserveScroll: true,
        only: ['jevs', 'filters', 'pendingAssets', 'disposalsAwaitingJevOut', 'stats'],
    };

    /** One place that builds the query string, so filters, sorting and pages stay consistent. */
    const visit = (overrides: Partial<Filters> & { page?: number }) => {
        const next: Record<string, unknown> = { ...filters, search, ...overrides };
        const params: Record<string, string | number> = {};
        Object.entries(next).forEach(([k, v]) => {
            if (v !== '' && v !== undefined && v !== null) params[k] = v as string | number;
        });
        router.get(basePath, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['jevs', 'filters'],
        });
    };

    // Debounced search (skips first render).
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        if (search === filters.search) return;
        const t = setTimeout(() => visit({ search }), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const hasFilters = !!(filters.search || filters.type || filters.status || filters.date_from || filters.date_to);

    const clearFilters = () => {
        setSearch('');
        router.get(basePath, {}, { preserveState: true, preserveScroll: true, replace: true, only: ['jevs', 'filters'] });
    };

    const toggleSort = (field: string) => {
        if (filters.sort === field) {
            visit({ direction: filters.direction === 'asc' ? 'desc' : 'asc' });
        } else {
            visit({ sort: field, direction: DESC_FIRST.includes(field) ? 'desc' : 'asc' });
        }
    };

    const sortHeaderProps = { sort: filters.sort, direction: filters.direction, onSort: toggleSort };

    const recordAction = (r: JevRecord, block = false) => {
        const id = r.jev_type === 'IN' ? r.asset_id : r.disposal_id;
        if (!id) return <span className="text-gray-300">—</span>;
        const kind = r.jev_type === 'IN' ? 'in' : 'out';
        const pending = !r.jev_number;
        return pending && can.issue_jev ? (
            <ActionButton onClick={() => openJev(kind, id)} block={block}>Issue JEV {r.jev_type}</ActionButton>
        ) : (
            <ActionButton onClick={() => openJev(kind, id)} primary={false} block={block}>View JEV</ActionButton>
        );
    };

    const assetAction = (asset: PendingAsset, block = false) => (
        <ActionButton onClick={() => openJev('in', asset.id)} primary={can.issue_jev} block={block}>
            {can.issue_jev ? 'Issue JEV IN' : 'View JEV'}
        </ActionButton>
    );

    const batchAction = (batch: DonationBatch, block = false) =>
        batch.disposal_id ? (
            <ActionButton onClick={() => openJev('out', batch.disposal_id!)} primary={can.issue_jev} block={block}>
                {can.issue_jev ? 'Issue JEV OUT' : 'View batch'}
            </ActionButton>
        ) : (
            <span className="text-xs text-gray-400">No disposals in batch</span>
        );

    const noPending = pendingAssets.length === 0 && disposalsAwaitingJevOut.length === 0;

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Journal Entry Vouchers</h2>}>
            <Head title="JEV" />

            <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                {/* ── Summary cards ── */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="JEV IN awaiting issuance"
                        value={stats.pending_in}
                        hint={stats.pending_in ? 'Assets cleared for custodian' : 'Nothing waiting'}
                        tone="amber"
                        href="#jev-in-pending"
                    />
                    <StatCard
                        label="JEV OUT awaiting issuance"
                        value={stats.pending_out}
                        hint={stats.pending_out ? 'Donation batches' : 'Nothing waiting'}
                        tone="violet"
                        href="#jev-out-pending"
                    />
                    <StatCard
                        label="JEVs issued this month"
                        value={stats.issued_this_month}
                        hint="IN and OUT combined"
                        tone="green"
                    />
                </div>

                {/* ── Nothing pending ── */}
                {noPending && (
                    <div className={CARD}>
                        <EmptyState
                            icon={<CircleCheck className="h-6 w-6 text-gray-400" />}
                            title="No pending JEVs"
                            description="Assets cleared for custodian and donation batches awaiting issuance will appear here."
                        />
                    </div>
                )}

                {/* ── Pending JEV IN ── */}
                {pendingAssets.length > 0 && (
                    <section id="jev-in-pending" className="scroll-mt-20">
                        <SectionHeading
                            title="JEV IN"
                            description="Assets cleared for custodian"
                            count={pendingAssets.length}
                            badge="amber"
                        />
                        <div className={CARD}>
                            {/* Mobile: stacked cards */}
                            <ul className="divide-y divide-gray-100 md:hidden">
                                {inSlice.map((asset) => (
                                    <li key={asset.id} className="space-y-3 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-gray-900">{asset.asset_code}</p>
                                                <p className="mt-0.5 truncate text-sm text-gray-500">
                                                    {asset.aap_number ?? asset.stcp_number ?? '—'}
                                                </p>
                                            </div>
                                            <StatusPill issued={false} jevType="IN" />
                                        </div>
                                        <p className="text-sm capitalize text-gray-500">{asset.type}</p>
                                        {assetAction(asset, true)}
                                    </li>
                                ))}
                            </ul>

                            {/* Tablet / desktop: table */}
                            <table className="hidden w-full divide-y divide-gray-200 md:table">
                                <thead className="bg-amber-50">
                                    <tr>
                                        <th scope="col" className={TH}>Asset Code</th>
                                        <th scope="col" className={TH}>AAP/STCP No.</th>
                                        <th scope="col" className={cn(TH, 'hidden xl:table-cell')}>Type</th>
                                        <th scope="col" className={TH}>Status</th>
                                        <th scope="col" className={cn(TH, 'text-right')}>Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {inSlice.map((asset) => (
                                        <tr key={asset.id} className="hover:bg-gray-50">
                                            <td className={cn(TD, 'font-medium text-gray-900')}>{asset.asset_code}</td>
                                            <td className={cn(TD, 'text-gray-600')}>{asset.aap_number ?? asset.stcp_number ?? '—'}</td>
                                            <td className={cn(TD, 'hidden capitalize text-gray-600 xl:table-cell')}>{asset.type}</td>
                                            <td className={TD}><StatusPill issued={false} jevType="IN" /></td>
                                            <td className={cn(TD, 'text-right')}>{assetAction(asset)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {inPages > 1 && (
                                <Pagination
                                    current={safeInPage}
                                    last={inPages}
                                    from={(safeInPage - 1) * PAGE_SIZE + 1}
                                    to={Math.min(safeInPage * PAGE_SIZE, pendingAssets.length)}
                                    total={pendingAssets.length}
                                    onPage={(p) => setInPage(Math.min(Math.max(1, p), inPages))}
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* ── Pending JEV OUT ── */}
                {disposalsAwaitingJevOut.length > 0 && (
                    <section id="jev-out-pending" className="scroll-mt-20">
                        <SectionHeading
                            title="JEV OUT"
                            description="Donation batches awaiting issuance"
                            count={disposalsAwaitingJevOut.length}
                            badge="purple"
                        />
                        <div className={CARD}>
                            {/* Mobile: stacked cards */}
                            <ul className="divide-y divide-gray-100 md:hidden">
                                {outSlice.map((batch) => (
                                    <li key={batch.id} className="space-y-3 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="min-w-0 truncate font-medium text-gray-900">{batch.batch_code}</p>
                                            <StatusPill issued={false} jevType="OUT" />
                                        </div>
                                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            <Field label="Recipient">{batch.recipient ?? '—'}</Field>
                                            <Field label="Assets">{batch.asset_count}</Field>
                                        </dl>
                                        {codesPreview(batch) && (
                                            <p className="truncate text-xs text-gray-400">{codesPreview(batch)}</p>
                                        )}
                                        {batchAction(batch, true)}
                                    </li>
                                ))}
                            </ul>

                            {/* Tablet / desktop: table */}
                            <table className="hidden w-full divide-y divide-gray-200 md:table">
                                <thead className="bg-violet-50">
                                    <tr>
                                        <th scope="col" className={TH}>Batch</th>
                                        <th scope="col" className={TH}>Recipient</th>
                                        <th scope="col" className={TH}>Assets</th>
                                        <th scope="col" className={TH}>Status</th>
                                        <th scope="col" className={cn(TH, 'text-right')}>Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {outSlice.map((batch) => (
                                        <tr key={batch.id} className="hover:bg-gray-50">
                                            <td className={cn(TD, 'whitespace-nowrap font-medium text-gray-900')}>{batch.batch_code}</td>
                                            <td className={cn(TD, 'text-gray-600')}>{batch.recipient ?? '—'}</td>
                                            <td className={cn(TD, 'text-gray-600')}>
                                                <div>{batch.asset_count}</div>
                                                {codesPreview(batch) && (
                                                    <div className="mt-0.5 hidden max-w-[16rem] truncate text-xs text-gray-400 xl:block">
                                                        {codesPreview(batch)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className={TD}><StatusPill issued={false} jevType="OUT" /></td>
                                            <td className={cn(TD, 'text-right')}>{batchAction(batch)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {outPages > 1 && (
                                <Pagination
                                    current={safeOutPage}
                                    last={outPages}
                                    from={(safeOutPage - 1) * PAGE_SIZE + 1}
                                    to={Math.min(safeOutPage * PAGE_SIZE, disposalsAwaitingJevOut.length)}
                                    total={disposalsAwaitingJevOut.length}
                                    onPage={(p) => setOutPage(Math.min(Math.max(1, p), outPages))}
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* ── All JEVs ── */}
                <section id="all-jevs" className="scroll-mt-20">
                    <SectionHeading
                        title="All JEVs"
                        description="Issued and pending vouchers, IN and OUT"
                        count={jevs.total}
                        badge="gray"
                    />

                    {/* Filters */}
                    <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-12">
                        <div className="sm:col-span-2 lg:col-span-4">
                            <label htmlFor="jev-search" className="mb-1 block text-xs font-medium text-gray-500">Search</label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    id="jev-search"
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Asset code, AAP/STCP, recipient, JEV no."
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <label htmlFor="jev-type" className="mb-1 block text-xs font-medium text-gray-500">JEV type</label>
                            <select
                                id="jev-type"
                                value={filters.type}
                                onChange={(e) => visit({ type: e.target.value as Filters['type'] })}
                                className={selectClass}
                            >
                                <option value="">All types</option>
                                <option value="IN">JEV IN</option>
                                <option value="OUT">JEV OUT</option>
                            </select>
                        </div>
                        <div className="lg:col-span-2">
                            <label htmlFor="jev-status" className="mb-1 block text-xs font-medium text-gray-500">Status</label>
                            <select
                                id="jev-status"
                                value={filters.status}
                                onChange={(e) => visit({ status: e.target.value as Filters['status'] })}
                                className={selectClass}
                            >
                                <option value="">All statuses</option>
                                <option value="issued">Issued</option>
                                <option value="pending">Awaiting issuance</option>
                            </select>
                        </div>
                        <div className="lg:col-span-2">
                            <label htmlFor="jev-from" className="mb-1 block text-xs font-medium text-gray-500">From</label>
                            <Input
                                id="jev-from"
                                type="date"
                                value={filters.date_from}
                                max={filters.date_to || undefined}
                                onChange={(e) => visit({ date_from: e.target.value })}
                            />
                        </div>
                        <div className="lg:col-span-2">
                            <label htmlFor="jev-to" className="mb-1 block text-xs font-medium text-gray-500">To</label>
                            <Input
                                id="jev-to"
                                type="date"
                                value={filters.date_to}
                                min={filters.date_from || undefined}
                                onChange={(e) => visit({ date_to: e.target.value })}
                            />
                        </div>
                        {hasFilters && (
                            <div className="flex justify-end sm:col-span-2 lg:col-span-12">
                                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                                    Clear all filters
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className={CARD}>
                        {jevs.data.length === 0 ? (
                            hasFilters ? (
                                <EmptyState
                                    icon={<Search className="h-6 w-6 text-gray-400" />}
                                    title="No JEV records match your filters"
                                    description="Try a different search term or widen the date range."
                                    action={
                                        <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                                            Clear filters
                                        </Button>
                                    }
                                />
                            ) : (
                                <EmptyState
                                    icon={<Receipt className="h-6 w-6 text-gray-400" />}
                                    title="No JEV records yet"
                                    description="Issued JEVs will show up here."
                                />
                            )
                        ) : (
                            <>
                                {/* Below xl: sort control + stacked cards */}
                                <div className="xl:hidden">
                                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
                                        <label htmlFor="jev-sort" className="shrink-0 text-xs font-medium text-gray-500">
                                            Sort by
                                        </label>
                                        <select
                                            id="jev-sort"
                                            value={filters.sort}
                                            onChange={(e) =>
                                                visit({
                                                    sort: e.target.value,
                                                    direction: DESC_FIRST.includes(e.target.value) ? 'desc' : 'asc',
                                                })
                                            }
                                            className={cn(selectClass, 'min-w-0 flex-1')}
                                        >
                                            {SORT_OPTIONS.map((o) => (
                                                <option key={o.field} value={o.field}>{o.label}</option>
                                            ))}
                                        </select>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="shrink-0 px-3"
                                            onClick={() => visit({ direction: filters.direction === 'asc' ? 'desc' : 'asc' })}
                                            aria-label={`Sort direction: ${filters.direction === 'asc' ? 'ascending' : 'descending'}. Toggle.`}
                                        >
                                            <span aria-hidden>{filters.direction === 'asc' ? '▲' : '▼'}</span>
                                        </Button>
                                    </div>

                                    <ul className="divide-y divide-gray-100">
                                        {jevs.data.map((r) => (
                                            <li key={`${r.jev_type}-${r.id}`} className="space-y-3 px-4 py-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-gray-900">
                                                            {r.aap_number ?? r.stcp_number ?? '—'}
                                                        </p>
                                                        {r.asset_code && (
                                                            <p className="mt-0.5 truncate text-xs text-gray-400">
                                                                {r.asset_code}
                                                                {r.asset_type && <span className="capitalize"> · {r.asset_type}</span>}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <StatusPill issued={!!r.jev_number} jevType={r.jev_type} />
                                                </div>
                                                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                    <Field label="JEV No.">{r.jev_number ?? '—'}</Field>
                                                    <Field label="JEV type"><JevTypeBadge type={r.jev_type} /></Field>
                                                    <Field label="Recipient">{r.recipient ?? '—'}</Field>
                                                    <Field label="Date">{formatDate(r.jev_date)}</Field>
                                                    <Field label="Amount">{formatAmount(r.amount)}</Field>
                                                </dl>
                                                {recordAction(r, true)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* xl and up: table */}
                                <table className="hidden w-full divide-y divide-gray-200 xl:table">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <SortHeader label="AAP/STCP No." field="reference" {...sortHeaderProps} />
                                            <SortHeader label="JEV No." field="jev_number" {...sortHeaderProps} />
                                            <SortHeader label="Direction" field="jev_type" {...sortHeaderProps} />
                                            <SortHeader label="Date" field="jev_date" {...sortHeaderProps} />
                                            <SortHeader label="Amount" field="amount" {...sortHeaderProps} />
                                            <th scope="col" className={cn(TH, 'text-right')}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {jevs.data.map((r) => (
                                            <tr key={`${r.jev_type}-${r.id}`} className="hover:bg-gray-50">
                                                <td className={TD}>
                                                    <div className="font-medium text-gray-900">{r.aap_number ?? r.stcp_number ?? '—'}</div>
                                                    {r.asset_code && <div className="text-xs text-gray-400">{r.asset_code}</div>}
                                                    {(r.asset_type || r.recipient) && (
                                                        <div className="mt-0.5 max-w-[16rem] truncate text-xs text-gray-400">
                                                            {r.asset_type && <span className="capitalize">{r.asset_type}</span>}
                                                            {r.asset_type && r.recipient && ' · '}
                                                            {r.recipient}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={cn(TD, 'text-gray-700')}>{r.jev_number ?? '—'}</td>
                                                <td className={TD}><JevTypeBadge type={r.jev_type} /></td>
                                                <td className={cn(TD, 'whitespace-nowrap text-gray-500')}>{formatDate(r.jev_date)}</td>
                                                <td className={cn(TD, 'whitespace-nowrap text-gray-700')}>{formatAmount(r.amount)}</td>
                                                <td className={cn(TD, 'text-right')}>{recordAction(r)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}

                        <Pagination
                            current={jevs.current_page}
                            last={jevs.last_page}
                            from={jevs.from ?? 0}
                            to={jevs.to ?? 0}
                            total={jevs.total}
                            onPage={(p) => visit({ page: p } as Partial<Filters> & { page: number })}
                        />
                    </div>
                </section>
            </div>

            {target?.kind === 'in' && (
                <JevInModal show={open} assetId={target.id} session={session} onClose={closeJev} onIssued={closeJev} postOptions={postOptions} />
            )}
            {target?.kind === 'out' && (
                <JevOutModal show={open} disposalId={target.id} session={session} onClose={closeJev} onIssued={closeJev} postOptions={postOptions} />
            )}
        </AuthenticatedLayout>
    );
}