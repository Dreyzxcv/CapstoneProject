import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, Link, router, usePage, usePoll } from '@inertiajs/react';
import { useEffect, useRef, useState, FormEvent } from 'react';
import { Package, Plus, Search, Columns3, Check } from 'lucide-react';

interface StatusSummaryEntry { status: string; count: number }

interface AssetsIndexProps {
    assets: {
        data: GroupedAssetRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { status?: string; type?: string; search?: string };
    statuses: Array<{ value: string; label: string }>;
    types: Array<{ value: string; label: string }>;
}

interface GroupedAssetRow {
    asset_code: string;
    first_asset_id: number;
    item_count: number;
    types: string[];
    municipality_of_origin: string;
    status_summary: StatusSummaryEntry[];
    created_at: string;
}

const CARD = 'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm';
const TH = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500';
const TD = 'px-4 py-3 text-sm';
const LABEL = 'mb-1 block text-xs font-medium text-gray-500';

const selectClass =
    'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600';

type ColumnKey = 'asset_code' | 'type' | 'municipality' | 'status';

const COLUMN_DEFS: Array<{ key: ColumnKey; label: string }> = [
    { key: 'asset_code', label: 'Asset ID' },
    { key: 'type', label: 'Type' },
    { key: 'municipality', label: 'Municipality' },
    { key: 'status', label: 'Status' },
];

const VISIBLE_COLUMNS_STORAGE_KEY = 'logtrack-assets-visible-columns';

function loadVisibleColumns(): Record<ColumnKey, boolean> {
    const defaults: Record<ColumnKey, boolean> = {
        asset_code: true,
        type: true,
        municipality: true,
        status: true,
    };

    try {
        const stored = window.localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY);
        if (!stored) return defaults;
        const parsed = JSON.parse(stored);
        return { ...defaults, ...parsed };
    } catch {
        return defaults;
    }
}

export default function AssetsIndex({ assets, filters, statuses, types }: AssetsIndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreate = auth.user?.permissions.includes('assets.create');

    const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(loadVisibleColumns);
    const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
    const columnsMenuRef = useRef<HTMLDivElement | null>(null);
    const { notifications } = usePage<PageProps & { notifications: { unreadAssetIds: number[] } }>().props;
    const unreadAssetIds = new Set(notifications?.unreadAssetIds ?? []);
    usePoll(8000, { only: ['assets'] });

    useEffect(() => {
        window.localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        if (!columnsMenuOpen) return;
        function handleClickOutside(e: MouseEvent) {
            if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
                setColumnsMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [columnsMenuOpen]);

    const visibleCount = COLUMN_DEFS.filter((c) => visibleColumns[c.key]).length;

    function toggleColumn(key: ColumnKey) {
        setVisibleColumns((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            // Keep at least one column visible so the table never goes empty.
            const anyVisible = COLUMN_DEFS.some((c) => next[c.key]);
            return anyVisible ? next : prev;
        });
    }

    function handleFilter(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        router.get(route('assets.index'), Object.fromEntries(form), { preserveState: true });
    }

    const hasActiveFilters = Boolean(filters.search || filters.type || filters.status);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-gray-800">Assets</h2>
                    {canCreate && (
                        <Button asChild>
                            <Link href={route('incidents.create')}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                New Intake
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Assets" />

            <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                {/* ── Filters ── */}
                <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end">
                    <form
                        onSubmit={handleFilter}
                        className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end"
                    >
                        <div className="sm:col-span-2 lg:col-span-5">
                            <label htmlFor="asset-search" className={LABEL}>Search</label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    id="asset-search"
                                    name="search"
                                    type="search"
                                    placeholder="Asset code, AAP no., species, municipality..."
                                    defaultValue={filters.search}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <label htmlFor="asset-type" className={LABEL}>Type</label>
                            <select id="asset-type" name="type" defaultValue={filters.type ?? ''} className={selectClass}>
                                <option value="">All types</option>
                                {types.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="lg:col-span-3">
                            <label htmlFor="asset-status" className={LABEL}>Status</label>
                            <select id="asset-status" name="status" defaultValue={filters.status ?? ''} className={selectClass}>
                                <option value="">All statuses</option>
                                {statuses.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
                            <Button type="submit" variant="secondary" className="h-10 flex-1">
                                Filter
                            </Button>
                            {hasActiveFilters && (
                                <Button type="button" variant="ghost" className="h-10" asChild>
                                    <Link href={route('assets.index')}>Clear</Link>
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className="relative shrink-0" ref={columnsMenuRef}>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-full lg:w-auto"
                            onClick={() => setColumnsMenuOpen((prev) => !prev)}
                        >
                            <Columns3 className="mr-1.5 h-4 w-4" />
                            Columns ({visibleCount}/{COLUMN_DEFS.length})
                        </Button>

                        {columnsMenuOpen && (
                            <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                                <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                    Visible Columns
                                </p>
                                {COLUMN_DEFS.map((col) => {
                                    const checked = visibleColumns[col.key];
                                    return (
                                        <button
                                            key={col.key}
                                            type="button"
                                            onClick={() => toggleColumn(col.key)}
                                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            <span>{col.label}</span>
                                            <span
                                                className={cn(
                                                    'flex h-4 w-4 items-center justify-center rounded border',
                                                    checked
                                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                                        : 'border-gray-300 bg-white',
                                                )}
                                            >
                                                {checked && <Check className="h-3 w-3" />}
                                            </span>
                                        </button>
                                    );
                                })}
                                <p className="mt-1 px-2 text-[11px] text-gray-400">
                                    "Actions" always shown.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Table ── */}
                <div className={CARD}>
                    {assets.data.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                <Package className="h-6 w-6 text-gray-400" />
                            </span>
                            <div>
                                <p className="font-medium text-gray-700">No assets found</p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {hasActiveFilters
                                        ? 'Try adjusting your search or filters.'
                                        : 'Recorded intakes will show up here.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: stacked cards */}
                            <ul className="divide-y divide-gray-100 md:hidden">
                                {assets.data.map((row) => {
                                    const subline = [
                                        visibleColumns.type ? row.types.join(', ') : null,
                                        visibleColumns.municipality ? row.municipality_of_origin : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ');

                                    return (
                                        <li key={row.asset_code}>
                                            <Link
                                                href={route('assets.show', row.first_asset_id)}
                                                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-gray-50 active:bg-gray-50"
                                            >
                                                <div className="min-w-0">
                                                    {visibleColumns.asset_code && (
                                                        <p className="truncate font-medium text-gray-900">
                                                            {row.asset_code}
                                                        </p>
                                                    )}

                                                    {subline && (
                                                        <p className="mt-0.5 truncate text-sm capitalize text-gray-500">
                                                            {subline}
                                                        </p>
                                                    )}

                                                    <p className="mt-1 text-xs text-gray-400">
                                                        {row.item_count} item(s)
                                                    </p>
                                                </div>

                                                {visibleColumns.status && (
                                                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                                        {row.status_summary.map((s) => (
                                                            <AssetStatusBadge
                                                                key={s.status}
                                                                status={s.status}
                                                                label={`${s.status.replace(/_/g, ' ')} (${s.count})`}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>

                            {/* Tablet / desktop: table */}
                            <table className="hidden w-full divide-y divide-gray-200 md:table">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {visibleColumns.asset_code && (
                                            <th scope="col" className={TH}>Asset ID</th>
                                        )}
                                        {visibleColumns.type && (
                                            <th scope="col" className={TH}>Type</th>
                                        )}
                                        {visibleColumns.municipality && (
                                            <th scope="col" className={TH}>Municipality</th>
                                        )}
                                        {visibleColumns.status && (
                                            <th scope="col" className={TH}>Status</th>
                                        )}
                                        <th scope="col" className={cn(TH, 'text-right')}>Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {assets.data.map((row) => (
                                        <tr key={row.asset_code} className="hover:bg-gray-50">
                                            {visibleColumns.asset_code && (
                                                <td className={cn(TD, 'font-medium text-gray-900')}>{row.asset_code}</td>
                                            )}
                                            {visibleColumns.type && (
                                                <td className={cn(TD, 'capitalize text-gray-600')}>{row.types.join(', ')}</td>
                                            )}
                                            {visibleColumns.municipality && (
                                                <td className={cn(TD, 'text-gray-600')}>{row.municipality_of_origin}</td>
                                            )}
                                            {visibleColumns.status && (
                                                <td className={TD}>
                                                    <div className="flex flex-wrap gap-1">
                                                        {row.status_summary.map((s) => (
                                                            <AssetStatusBadge
                                                                key={s.status}
                                                                status={s.status}
                                                                label={`${s.status.replace(/_/g, ' ')} (${s.count})`}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-400">
                                                        {row.item_count} item{row.item_count === 1 ? '' : 's'}
                                                    </p>
                                                </td>
                                            )}
                                            <td className={cn(TD, 'text-right')}>
                                                <Button asChild size="sm" variant="outline">
                                                    <Link href={route('assets.show', row.first_asset_id)}>View</Link>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {assets.links.length > 3 && (
                        <div className="flex flex-wrap items-center justify-center gap-1 border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                            {assets.links.map((link, index) => (
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
            </div>
        </AuthenticatedLayout>
    );
}