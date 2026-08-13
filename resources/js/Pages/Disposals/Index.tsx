import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Asset, PageProps } from '@/types';
import { Head, Link, router, usePoll, usePage } from '@inertiajs/react';
import { ArrowLeft, Car, TreePine, Wrench } from 'lucide-react';

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
}> = [
    { key: 'log', label: 'Logs', description: 'Lumber for donation, decay reporting, or fabrication', icon: TreePine },
    { key: 'vehicle', label: 'Conveyance', description: 'Vehicles pending release or forfeiture', icon: Car },
    { key: 'equipment', label: 'Tools', description: 'Chainsaws and equipment to be damaged/disabled', icon: Wrench },
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
                        <h2 className="text-xl font-semibold text-gray-800">
                            {activeMode ? `Disposals — ${activeMode.label}` : 'Assets For Disposal'}
                        </h2>
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
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
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
                                        className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                                    >
                                        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <span>
                                            <span className="block text-base font-semibold text-gray-900">{m.label}</span>
                                            <span className="mt-0.5 block text-xs text-gray-500">{m.description}</span>
                                        </span>
                                        <span className="mt-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                                            {count} pending
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Asset</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {assets.data.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                                            No {activeMode?.label.toLowerCase()} pending disposal.
                                        </td>
                                    </tr>
                                )}
                                {assets.data.map((asset) => (
                                    <tr key={asset.id} className={unreadAssetIds.has(asset.id) ? 'bg-amber-50/70' : ''}>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="flex items-center gap-2">
                                                {asset.asset_code.slice(0, 8)}…
                                                {unreadAssetIds.has(asset.id) && (
                                                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                                        New
                                                    </span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm capitalize text-gray-600">
                                            {asset.type}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <AssetStatusBadge
                                                status={asset.current_status}
                                                label={asset.current_status.replace(/_/g, ' ')}
                                                disposedQuantity={asset.disposed_quantity}
                                                quantity={asset.quantity}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {can.process ? (
                                                <Link href={route('disposals.create', asset.id)}>
                                                    <Button size="sm">Process</Button>
                                                </Link>
                                            ) : (
                                                <Link href={route('assets.show', asset.id)} className="text-sm text-emerald-700 hover:underline">
                                                    View
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}