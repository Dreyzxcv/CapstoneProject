import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { Badge } from '@/Components/ui/badge';
import { useEffect, useRef, useState } from 'react';

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

/* ───────────── Small shared pieces ───────────── */

function StatusPill({ issued, jevType }: { issued: boolean; jevType: 'IN' | 'OUT' }) {
    if (issued) return <Badge className="bg-green-600 text-white">Issued</Badge>;
    return (
        <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700">
            Awaiting JEV {jevType}
        </Badge>
    );
}

function JevTypeBadge({ type }: { type: 'IN' | 'OUT' }) {
    return type === 'IN' ? (
        <Badge className="border-sky-200 bg-sky-100 text-sky-700">IN</Badge>
    ) : (
        <Badge className="border-violet-200 bg-violet-100 text-violet-700">OUT</Badge>
    );
}

function ActionButton({ href, children, primary = true }: { href: string; children: React.ReactNode; primary?: boolean }) {
    return (
        <Link
            href={href}
            className={
                primary
                    ? 'inline-flex items-center whitespace-nowrap rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1'
                    : 'inline-flex items-center whitespace-nowrap rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50'
            }
        >
            {children}
        </Link>
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
    const body = (
        <>
            <p className="text-sm font-medium">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs opacity-75">{hint}</p>
        </>
    );
    const cls = `block rounded-lg border p-4 ${TONES[tone]}`;
    return href && value > 0 ? (
        <a href={href} className={`${cls} transition hover:shadow-md`}>
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
    tone = 'gray',
}: {
    current: number;
    last: number;
    from: number;
    to: number;
    total: number;
    onPage: (page: number) => void;
    tone?: 'gray' | 'amber';
}) {
    if (total === 0) return null;
    const wrap = tone === 'amber' ? 'border-amber-100 bg-amber-50/40' : 'border-gray-200 bg-gray-50/50';
    const btn = 'rounded border border-gray-200 bg-white px-3 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';
    return (
        <div className={`flex flex-col gap-2 border-t px-4 py-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between ${wrap}`}>
            <span>
                Showing {from}–{to} of {total}
            </span>
            {last > 1 && (
                <div className="flex flex-wrap items-center gap-1">
                    <button className={btn} onClick={() => onPage(current - 1)} disabled={current === 1}>
                        Previous
                    </button>
                    {pageItems(current, last).map((item, idx) =>
                        item === '…' ? (
                            <span key={`e-${idx}`} className="px-1 text-gray-400">…</span>
                        ) : (
                            <button
                                key={item}
                                onClick={() => onPage(item)}
                                aria-current={item === current ? 'page' : undefined}
                                className={`rounded border px-3 py-1 text-xs font-medium ${
                                    item === current
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                {item}
                            </button>
                        ),
                    )}
                    <button className={btn} onClick={() => onPage(current + 1)} disabled={current === last}>
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}

const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const inputCls =
    'w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500';

/* ───────────── Page ───────────── */

export default function JevIndex({ jevs, pendingAssets, disposalsAwaitingJevOut, stats, filters, can }: Props) {
    const { url } = usePage();
    const basePath = url.split('?')[0];

    const [pendingPage, setPendingPage] = useState(1);
    const [search, setSearch] = useState(filters.search);

    const pendingTotalPages = Math.ceil(pendingAssets.length / PAGE_SIZE);
    const pendingSlice = pendingAssets.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE);

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
            const descFirst = ['jev_date', 'amount', 'created_at'].includes(field);
            visit({ sort: field, direction: descFirst ? 'desc' : 'asc' });
        }
    };

    const SortHeader = ({ label, field, className = '' }: { label: string; field: string; className?: string }) => {
        const active = filters.sort === field;
        return (
            <th
                scope="col"
                aria-sort={active ? (filters.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}
            >
                <button
                    type="button"
                    onClick={() => toggleSort(field)}
                    className={`inline-flex items-center gap-1 uppercase hover:text-gray-800 ${active ? 'text-gray-900' : ''}`}
                >
                    {label}
                    <span aria-hidden className={active ? 'text-emerald-600' : 'text-gray-300'}>
                        {active ? (filters.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                </button>
            </th>
        );
    };

    const recordAction = (r: JevRecord) => {
        const href =
            r.jev_type === 'IN'
                ? r.asset_id
                    ? route('assets.jev.show', { asset: r.asset_id, type: r.asset_type })
                    : null
                : r.disposal_id
                  ? route('disposals.jev-out.show', r.disposal_id)
                  : null;
        if (!href) return <span className="text-gray-300">—</span>;
        const pending = !r.jev_number;
        return pending && can.issue_jev ? (
            <ActionButton href={href}>Issue JEV {r.jev_type}</ActionButton>
        ) : (
            <ActionButton href={href} primary={false}>
                View
            </ActionButton>
        );
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-gray-800">Journal Entry Vouchers</h2>}
        >
            <Head title="JEV" />

            <div className="py-8">
                <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
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

                    {/* ── Pending JEV IN ── */}
                    {pendingAssets.length > 0 && (
                        <section id="jev-in-pending" className="scroll-mt-6">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    JEV IN — assets cleared for custodian
                                </h3>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                    {pendingAssets.length}
                                </span>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-amber-200 bg-white shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                                        <thead className="bg-amber-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset Code</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">AAP/STCP No.</th>
                                                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Type</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Next action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {pendingSlice.map((asset) => (
                                                <tr key={asset.id} className="hover:bg-amber-50/40">
                                                    <td className="px-4 py-3 font-medium text-gray-800">{asset.asset_code}</td>
                                                    <td className="px-4 py-3 text-gray-500">{asset.aap_number ?? asset.stcp_number ?? '—'}</td>
                                                    <td className="hidden px-4 py-3 capitalize text-gray-600 sm:table-cell">{asset.type}</td>
                                                    <td className="px-4 py-3">
                                                        <StatusPill issued={false} jevType="IN" />
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <ActionButton
                                                            href={route('assets.jev.show', asset.id)}
                                                            primary={can.issue_jev}
                                                        >
                                                            {can.issue_jev ? 'Issue JEV IN' : 'View'}
                                                        </ActionButton>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {pendingTotalPages > 1 && (
                                    <Pagination
                                        tone="amber"
                                        current={pendingPage}
                                        last={pendingTotalPages}
                                        from={(pendingPage - 1) * PAGE_SIZE + 1}
                                        to={Math.min(pendingPage * PAGE_SIZE, pendingAssets.length)}
                                        total={pendingAssets.length}
                                        onPage={(p) => setPendingPage(Math.min(Math.max(1, p), pendingTotalPages))}
                                    />
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── Pending JEV OUT, by donation batch ── */}
                    {disposalsAwaitingJevOut.length > 0 && (
                        <section id="jev-out-pending" className="scroll-mt-6">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    JEV OUT — donation batches
                                </h3>
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                                    {disposalsAwaitingJevOut.length}
                                </span>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {disposalsAwaitingJevOut.map((batch) => (
                                    <div
                                        key={batch.id}
                                        className="flex flex-col justify-between rounded-lg border border-violet-200 bg-white p-4 shadow-sm"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-semibold text-gray-800">{batch.batch_code}</p>
                                                <StatusPill issued={false} jevType="OUT" />
                                            </div>
                                            <p className="mt-2 text-sm text-gray-700">
                                                <span className="text-gray-500">Recipient: </span>
                                                {batch.recipient ?? '—'}
                                            </p>
                                            <p className="mt-1 text-sm text-gray-700">
                                                <span className="text-gray-500">Assets: </span>
                                                {batch.asset_count}
                                            </p>
                                            {batch.asset_codes.length > 0 && (
                                                <p className="mt-1 truncate text-xs text-gray-400">
                                                    {batch.asset_codes.join(', ')}
                                                    {batch.asset_count > batch.asset_codes.length &&
                                                        ` +${batch.asset_count - batch.asset_codes.length} more`}
                                                </p>
                                            )}
                                        </div>
                                        <div className="mt-4">
                                            {batch.disposal_id ? (
                                                <ActionButton
                                                    href={route('disposals.jev-out.show', batch.disposal_id)}
                                                    primary={can.issue_jev}
                                                >
                                                    {can.issue_jev
                                                        ? `Issue JEV OUT for ${batch.asset_count} ${batch.asset_count === 1 ? 'asset' : 'assets'}`
                                                        : 'View batch'}
                                                </ActionButton>
                                            ) : (
                                                <span className="text-xs text-gray-400">No disposals in batch</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── All JEVs ── */}
                    <section id="all-jevs" className="scroll-mt-6">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">All JEVs</h3>

                        {/* Filters */}
                        <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-12">
                            <div className="sm:col-span-2 lg:col-span-4">
                                <label htmlFor="jev-search" className="mb-1 block text-xs font-medium text-gray-500">Search</label>
                                <input
                                    id="jev-search"
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Asset code, AAP/STCP, recipient, JEV no."
                                    className={inputCls}
                                />
                            </div>
                            <div className="lg:col-span-2">
                                <label htmlFor="jev-type" className="mb-1 block text-xs font-medium text-gray-500">JEV type</label>
                                <select
                                    id="jev-type"
                                    value={filters.type}
                                    onChange={(e) => visit({ type: e.target.value as Filters['type'] })}
                                    className={inputCls}
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
                                    className={inputCls}
                                >
                                    <option value="">All statuses</option>
                                    <option value="issued">Issued</option>
                                    <option value="pending">Awaiting issuance</option>
                                </select>
                            </div>
                            <div className="lg:col-span-2">
                                <label htmlFor="jev-from" className="mb-1 block text-xs font-medium text-gray-500">From</label>
                                <input
                                    id="jev-from"
                                    type="date"
                                    value={filters.date_from}
                                    max={filters.date_to || undefined}
                                    onChange={(e) => visit({ date_from: e.target.value })}
                                    className={inputCls}
                                />
                            </div>
                            <div className="lg:col-span-2">
                                <label htmlFor="jev-to" className="mb-1 block text-xs font-medium text-gray-500">To</label>
                                <input
                                    id="jev-to"
                                    type="date"
                                    value={filters.date_to}
                                    min={filters.date_from || undefined}
                                    onChange={(e) => visit({ date_to: e.target.value })}
                                    className={inputCls}
                                />
                            </div>
                            {hasFilters && (
                                <div className="sm:col-span-2 lg:col-span-12">
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="text-xs font-medium text-emerald-700 hover:underline"
                                    >
                                        Clear all filters
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <SortHeader label="AAP/STCP No." field="reference" />
                                            <SortHeader label="Type" field="asset_type" className="hidden md:table-cell" />
                                            <SortHeader label="JEV No." field="jev_number" />
                                            <SortHeader label="JEV" field="jev_type" />
                                            <SortHeader label="Recipient" field="recipient" className="hidden lg:table-cell" />
                                            <SortHeader label="Date" field="jev_date" className="hidden sm:table-cell" />
                                            <SortHeader label="Amount" field="amount" className="hidden md:table-cell" />
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                            <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {jevs.data.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="px-4 py-12 text-center">
                                                    {hasFilters ? (
                                                        <>
                                                            <p className="font-medium text-gray-700">No JEVs match your filters</p>
                                                            <p className="mt-1 text-sm text-gray-400">
                                                                Try a different search term or widen the date range.
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={clearFilters}
                                                                className="mt-3 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                            >
                                                                Clear filters
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="font-medium text-gray-700">No JEVs yet</p>
                                                            <p className="mt-1 text-sm text-gray-400">
                                                                Issued JEVs will show up here.
                                                            </p>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                        {jevs.data.map((r) => (
                                            <tr key={`${r.jev_type}-${r.id}`} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-800">{r.aap_number ?? r.stcp_number ?? '—'}</div>
                                                    {r.asset_code && <div className="text-xs text-gray-400">{r.asset_code}</div>}
                                                </td>
                                                <td className="hidden px-4 py-3 capitalize text-gray-600 md:table-cell">{r.asset_type ?? '—'}</td>
                                                <td className="px-4 py-3 text-gray-700">{r.jev_number ?? '—'}</td>
                                                <td className="px-4 py-3"><JevTypeBadge type={r.jev_type} /></td>
                                                <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">{r.recipient ?? '—'}</td>
                                                <td className="hidden whitespace-nowrap px-4 py-3 text-gray-500 sm:table-cell">{formatDate(r.jev_date)}</td>
                                                <td className="hidden whitespace-nowrap px-4 py-3 text-gray-700 md:table-cell">
                                                    {r.amount
                                                        ? `₱ ${Number(r.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusPill issued={!!r.jev_number} jevType={r.jev_type} />
                                                </td>
                                                <td className="px-4 py-3 text-right">{recordAction(r)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
            </div>
        </AuthenticatedLayout>
    );
}