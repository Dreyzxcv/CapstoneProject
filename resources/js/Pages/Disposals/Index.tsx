import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Asset, PageProps } from '@/types';
import { Head, Link, usePoll, usePage } from '@inertiajs/react';

interface DisposalsIndexProps {
    assets: {
        data: Asset[];
    };
    can: {
        process: boolean;
    };
}

export default function DisposalsIndex({ assets, can }: DisposalsIndexProps) {
    usePoll(8000, { only: ['assets'] });
    const { notifications } = usePage<PageProps & { notifications: { unreadAssetIds: number[] } }>().props;
    const unreadAssetIds = new Set(notifications?.unreadAssetIds ?? []);
    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-gray-800">Assets For Disposal</h2>
                    {can.process && (
                        <Link href={route('disposals.donate.create')}>
                            <Button variant="outline">Donate Assets</Button>
                        </Link>
                    )}
                </div>
            }>
            <Head title="Disposals" />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
                                        No assets pending disposal.
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
            </div>
        </AuthenticatedLayout>
    );
}
