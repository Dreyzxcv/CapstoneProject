import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Asset, PageProps } from '@/types';
import { Head, Link, router, usePage, usePoll } from '@inertiajs/react';
import { useEffect, useRef, useState, FormEvent } from 'react';
import { Filter, Package, Plus, Search, Columns3, Check } from 'lucide-react';
import axios from 'axios';
import Modal from '@/Components/Modal';

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
    item_count: number;
    types: string[];
    municipality_of_origin: string;
    status_summary: StatusSummaryEntry[];
    created_at: string;
}

const selectClass =
    'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600';

type ColumnKey = 'asset_code' | 'type' | 'municipality' | 'status';

const COLUMN_DEFS: Array<{ key: ColumnKey; label: string }> = [
    { key: 'asset_code', label: 'AAP No.' },
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

    const [viewingCode, setViewingCode] = useState<string | null>(null);
    const [modalItems, setModalItems] = useState<Asset[] | null>(null);
    const [loadingModal, setLoadingModal] = useState(false);
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

    async function openViewModal(assetCode: string) {
        setViewingCode(assetCode);
        setLoadingModal(true);
        setModalItems(null);
        try {
            const { data } = await axios.get(route('assets.by-code', assetCode));
            setModalItems(data.items);
        } finally {
            setLoadingModal(false);
        }
    }

    function closeViewModal() {
        setViewingCode(null);
        setModalItems(null);
    }

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
                <Card>
                    <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-start">
                        <form
                            onSubmit={handleFilter}
                            className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_200px_auto]"
                        >
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    name="search"
                                    placeholder="Search code, species, municipality..."
                                    defaultValue={filters.search}
                                    className="pl-9"
                                />
                            </div>
                            <select name="type" defaultValue={filters.type ?? ''} className={selectClass}>
                                <option value="">All types</option>
                                {types.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            <select name="status" defaultValue={filters.status ?? ''} className={selectClass}>
                                <option value="">All statuses</option>
                                {statuses.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
                                    <Filter className="mr-1.5 h-4 w-4" />
                                    Filter
                                </Button>
                                {hasActiveFilters && (
                                    <Button type="button" variant="ghost" asChild>
                                        <Link href={route('assets.index')}>Clear</Link>
                                    </Button>
                                )}
                            </div>
                        </form>
                        <div className="relative shrink-0" ref={columnsMenuRef}>
                            <Button
                                type="button"
                                variant="outline"
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
                                                    className={
                                                        'flex h-4 w-4 items-center justify-center rounded border ' +
                                                        (checked
                                                            ? 'border-emerald-600 bg-emerald-600 text-white'
                                                            : 'border-gray-300 bg-white')
                                                    }
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
                    </CardContent>
                </Card>

                <Card className="overflow-hidden p-0">
                    {assets.data.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                <Package className="h-6 w-6 text-gray-400" />
                            </span>
                            <div>
                                <p className="font-medium text-gray-700">No assets found</p>
                                <p className="text-sm text-gray-500">
                                    {hasActiveFilters
                                        ? 'Try adjusting your search or filters.'
                                        : 'Recorded intakes will show up here.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: stacked cards */}
                            <div className="divide-y divide-gray-100 sm:hidden">
                                {assets.data.map((row) => {
                                    const subline = [
                                        visibleColumns.type ? row.types.join(', ') : null,
                                        visibleColumns.municipality
                                            ? row.municipality_of_origin
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ');

                                    return (
                                        <button
                                            key={row.asset_code}
                                            type="button"
                                            onClick={() => openViewModal(row.asset_code)}
                                            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left active:bg-gray-50"
                                        >
                                            <div className="min-w-0">
                                                {visibleColumns.asset_code && (
                                                    <p className="truncate font-medium text-gray-900">
                                                        {row.asset_code}
                                                    </p>
                                                )}

                                                {subline && (
                                                    <p className="mt-0.5 text-sm capitalize text-gray-500">
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
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Desktop: table */}
                            <div className="hidden overflow-x-auto sm:block">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {visibleColumns.asset_code && (
                                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                                                    AAP No.
                                                </th>
                                            )}

                                            {visibleColumns.type && (
                                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                                                    Type
                                                </th>
                                            )}

                                            {visibleColumns.municipality && (
                                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                                                    Municipality
                                                </th>
                                            )}

                                            {visibleColumns.status && (
                                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                                                    Status
                                                </th>
                                            )}

                                            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-200">
                                        {assets.data.map((row) => (
                                            <tr key={row.asset_code} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.asset_code}</td>
                                                <td className="px-4 py-3 text-sm capitalize text-gray-600">{row.types.join(', ')}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{row.municipality_of_origin}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="flex flex-wrap gap-1">
                                                        {row.status_summary.map((s) => (
                                                            <AssetStatusBadge
                                                                key={s.status}
                                                                status={s.status}
                                                                label={`${s.status.replace(/_/g, ' ')} (${s.count})`}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-400">{row.item_count} item{row.item_count === 1 ? '' : 's'}</p>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => openViewModal(row.asset_code)}
                                                        className="text-sm font-medium text-emerald-700 hover:underline"
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {assets.links.length > 3 && (
                        <div className="flex flex-wrap items-center justify-center gap-1 border-t border-gray-100 px-4 py-3">
                            {assets.links.map((link, index) => (
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
                </Card>
            </div>
            <Modal show={viewingCode !== null} onClose={closeViewModal} maxWidth="4xl">
                <div className="max-h-[85vh] overflow-y-auto p-6">
                    <h2 className="text-lg font-medium text-gray-900">{viewingCode}</h2>
                    <p className="mt-1 text-sm text-gray-600">All items recorded under this AAP No.</p>

                    {loadingModal ? (
                        <p className="mt-6 text-sm text-gray-500">Loading…</p>
                    ) : (
                        <div className="mt-6 space-y-4">
                            {modalItems?.map((item) => {
                                const pieces = item.pieces ?? [];
                                const isLog = item.type === 'log';
                                const totalVolumeBd = pieces.reduce((sum, p) => sum + (p.volume_bd_ft ?? 0), 0);
                                const totalVolumeCu = pieces.reduce((sum, p) => sum + (p.volume_cu_m ?? 0), 0);
                                const totalValue = pieces.reduce((sum, p) => sum + (p.estimated_value ?? 0), 0);
                                const hasPieces = pieces.length > 0;

                                return (
                                    <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                                        {/* Header */}
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold capitalize text-gray-800">
                                                {item.type}
                                                {item.type === 'log' && item.species ? ` — ${item.species}` : ''}
                                                {item.type === 'vehicle' && (item as any).vehicle_type ? ` — ${(item as any).vehicle_type}` : ''}
                                                {item.type === 'equipment' && (item as any).equipment_type ? ` — ${(item as any).equipment_type}` : ''}
                                            </p>
                                            <AssetStatusBadge
                                                status={item.current_status}
                                                label={item.current_status.replace(/_/g, ' ')}
                                                disposedQuantity={item.disposed_quantity}
                                                quantity={item.quantity}
                                            />
                                        </div>

                                        {/* Quick facts */}
                                        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                                            <div>
                                                <dt className="text-gray-500">Quantity</dt>
                                                <dd>{item.quantity} {item.quantity_unit}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-gray-500">Municipality</dt>
                                                <dd>{item.municipality_of_origin}</dd>
                                            </div>
                                        </dl>

                                        {/* Rollup totals */}
                                        {hasPieces && (
                                            <div className="mt-3 flex flex-wrap gap-4 rounded-md bg-gray-50 px-3 py-2 text-sm">
                                                {isLog && totalVolumeBd > 0 && (
                                                    <div>
                                                        <span className="text-gray-500">Volume: </span>
                                                        <span className="font-medium">{totalVolumeBd.toFixed(2)} bd.ft</span>
                                                        {totalVolumeCu > 0 && (
                                                            <span className="text-gray-400"> / {totalVolumeCu.toFixed(4)} cu.m</span>
                                                        )}
                                                    </div>
                                                )}
                                                {totalValue > 0 && (
                                                    <div>
                                                        <span className="text-gray-500">Est. Value: </span>
                                                        <span className="font-medium text-emerald-700">
                                                            ₱{totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Piece table — adaptive by type */}
                                        {hasPieces ? (
                                            <div className="mt-3 overflow-x-auto">
                                                <table className="min-w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b border-gray-100 text-left text-gray-400">
                                                            <th className="pb-1 pr-3 font-medium">#</th>
                                                            {isLog && <th className="pb-1 pr-3 font-medium">Species</th>}
                                                            {isLog && <th className="pb-1 pr-3 font-medium">Dimensions (L×W×H)</th>}
                                                            {isLog && <th className="pb-1 pr-3 font-medium">Volume</th>}
                                                            {item.type === 'vehicle' && <th className="pb-1 pr-3 font-medium">Vehicle Type</th>}
                                                            {item.type === 'vehicle' && <th className="pb-1 pr-3 font-medium">Plate / Conveyance No.</th>}
                                                            {item.type === 'equipment' && <th className="pb-1 pr-3 font-medium">Equipment Type</th>}
                                                            <th className="pb-1 font-medium">Est. Value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {pieces.map((piece, idx) => (
                                                            <tr key={piece.id} className="text-gray-700">
                                                                <td className="py-1 pr-3 text-gray-400">{idx + 1}</td>
                                                                {isLog && (
                                                                    <td className="py-1 pr-3">{piece.species ?? item.species ?? '—'}</td>
                                                                )}
                                                                {isLog && (
                                                                    <td className="py-1 pr-3">
                                                                        {[piece.length, piece.width, piece.height]
                                                                            .map((v) => (v != null ? `${v}m` : '—'))
                                                                            .join(' × ')}
                                                                    </td>
                                                                )}
                                                                {isLog && (
                                                                    <td className="py-1 pr-3">
                                                                        {piece.volume_bd_ft != null
                                                                            ? `${Number(piece.volume_bd_ft).toFixed(2)} bd.ft`
                                                                            : '—'}
                                                                    </td>
                                                                )}
                                                                {item.type === 'vehicle' && (
                                                                    <td className="py-1 pr-3 capitalize">{piece.vehicle_type ?? '—'}</td>
                                                                )}
                                                                {item.type === 'vehicle' && (
                                                                    <td className="py-1 pr-3">{piece.plate_number ?? '—'}</td>
                                                                )}
                                                                {item.type === 'equipment' && (
                                                                    <td className="py-1 pr-3 capitalize">{piece.equipment_type ?? '—'}</td>
                                                                )}
                                                                <td className="py-1">
                                                                    {piece.estimated_value != null
                                                                        ? `₱${Number(piece.estimated_value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                                                        : '—'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="mt-3 text-xs italic text-gray-400">No pieces recorded yet.</p>
                                        )}

                                        <Link
                                            href={route('assets.show', item.id)}
                                            className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:underline"
                                        >
                                            Open full record →
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                        <Button type="button" variant="outline" onClick={closeViewModal}>Close</Button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}