import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Asset, PageProps } from '@/types';
import { Head, Link, router, usePoll, usePage } from '@inertiajs/react';
import { ArrowLeft, Car, ChevronRight, TreePine, Wrench } from 'lucide-react';

interface DisposalsIndexProps {
    assets: {
        data: Asset[];
    };
    mode: 'log' | 'vehicle' | 'equipment' | null;
    modeCounts: {
        log: number;
        vehicle: number;
        equipment: number;
    };
    can: {
        process: boolean;
    };
}

const MODES: Array<{
    key: 'log' | 'vehicle' | 'equipment';
    label: string;
    description: string;
    icon: typeof TreePine;
    color: string;
    iconBg: string;
}> = [
    {
        key: 'log',
        label: 'Logs',
        description: 'Lumber for donation, decay reporting, or fabrication',
        icon: TreePine,
        color: 'text-emerald-700',
        iconBg: 'bg-emerald-50',
    },
    {
        key: 'vehicle',
        label: 'Conveyance',
        description: 'Vehicles pending release or forfeiture',
        icon: Car,
        color: 'text-blue-700',
        iconBg: 'bg-blue-50',
    },
    {
        key: 'equipment',
        label: 'Tools & Equipment',
        description: 'Chainsaws and equipment to be damaged or disabled',
        icon: Wrench,
        color: 'text-amber-700',
        iconBg: 'bg-amber-50',
    },
];

export default function DisposalsIndex({ assets, mode, modeCounts, can }: DisposalsIndexProps) {
    usePoll(8000, { only: ['assets', 'modeCounts'] });
    const { notifications } = usePage<PageProps & { notifications: { unreadAssetIds: number[] } }>().props;
    const unreadAssetIds = new Set(notifications?.unreadAssetIds ?? []);

    function selectMode(key: string) {
        router.get(route('disposals.index'), { mode: key }, { preserveState: true });
    }

    function clearMode() {
        router.get(route('disposals.index'), {}, { preserveState: true });
    }

    const activeMode = MODES.find((m) => m.key === mode);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {mode && (
                            <button
                                type="button"
                                onClick={clearMode}
                                className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-emerald-700"
                                aria-label="Back to disposal categories"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                        )}
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">
                                {activeMode ? `${activeMode.label} — Pending Disposal` : 'Assets For Disposal'}
                            </h2>
                            {activeMode && (
                                <p className="mt-0.5 text-sm text-gray-500">{activeMode.description}</p>
                            )}
                        </div>
                    </div>
                    {can.process && (
                        <Link href={route('disposals.donate.create')}>
                            <Button variant="outline">Donate Assets</Button>
                        </Link>
                    )}
                </div>
            }
        >
            <Head title="Disposals" />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {!mode ? (
                    /* ── Category picker ── */
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                            Choose a category to see the assets awaiting disposal in that group.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {MODES.map((m) => {
                                const Icon = m.icon;
                                const count = modeCounts[m.key];
                                return (
                                    <button
                                        key={m.key}
                                        type="button"
                                        onClick={() => selectMode(m.key)}
                                        className="group flex flex-col items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                                    >
                                        <div className="flex w-full items-start justify-between">
                                            <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${m.iconBg} ${m.color}`}>
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <ChevronRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                                        </div>
                                        <div>
                                            <span className="block text-base font-semibold text-gray-900">{m.label}</span>
                                            <span className="mt-0.5 block text-xs text-gray-500">{m.description}</span>
                                        </div>
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                count > 0
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-gray-100 text-gray-500'
                                            }`}
                                        >
                                            {count} pending
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* ── Asset list ── */
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        {/* Table header row count */}
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                            <p className="text-sm text-gray-500">
                                {assets.data.length === 0
                                    ? `No ${activeMode?.label.toLowerCase()} pending disposal.`
                                    : `${assets.data.length} asset${assets.data.length === 1 ? '' : 's'} pending disposal`}
                            </p>
                            {unreadAssetIds.size > 0 && (
                                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                    {unreadAssetIds.size} new
                                </span>
                            )}
                        </div>

                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        AAP No.
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Type
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Status
                                    </th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {assets.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-400">
                                            No {activeMode?.label.toLowerCase()} assets are pending disposal.
                                        </td>
                                    </tr>
                                ) : (
                                    assets.data.map((asset) => {
                                        const isNew = unreadAssetIds.has(asset.id);
                                        return (
                                            <tr
                                                key={asset.id}
                                                className={`transition-colors ${isNew ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-gray-50/60'}`}
                                            >
                                                {/* AAP No. */}
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm font-medium text-gray-900">
                                                            {asset.aap_number ?? (
                                                                <span className="font-sans font-normal text-gray-400">No AAP</span>
                                                            )}
                                                        </span>
                                                        {isNew && (
                                                            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                                                New
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Asset code as subtle sub-label */}
                                                    <p className="mt-0.5 font-mono text-[11px] text-gray-400">
                                                        {asset.asset_code}
                                                    </p>
                                                </td>

                                                {/* Type */}
                                                <td className="px-5 py-3.5">
                                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
                                                        {mode === 'log' && <TreePine className="h-3 w-3 text-emerald-600" />}
                                                        {mode === 'vehicle' && <Car className="h-3 w-3 text-blue-600" />}
                                                        {mode === 'equipment' && <Wrench className="h-3 w-3 text-amber-600" />}
                                                        {asset.type}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="px-5 py-3.5">
                                                    <AssetStatusBadge
                                                        status={asset.current_status}
                                                        label={asset.current_status.replace(/_/g, ' ')}
                                                        disposedQuantity={asset.disposed_quantity}
                                                        quantity={asset.quantity}
                                                    />
                                                </td>

                                                {/* Action */}
                                                <td className="px-5 py-3.5 text-right">
                                                    {can.process ? (
                                                        <Link href={route('disposals.create', asset.id)}>
                                                            <Button size="sm">Process</Button>
                                                        </Link>
                                                    ) : (
                                                        <Link
                                                            href={route('assets.show', asset.id)}
                                                            className="text-sm font-medium text-emerald-700 hover:underline"
                                                        >
                                                            View
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}