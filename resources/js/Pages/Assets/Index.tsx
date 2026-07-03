import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Asset, PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';

interface AssetsIndexProps {
    assets: {
        data: Asset[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { status?: string; type?: string; search?: string };
    statuses: Array<{ value: string; label: string }>;
    types: Array<{ value: string; label: string }>;
}

export default function AssetsIndex({ assets, filters, statuses, types }: AssetsIndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreate = auth.user?.permissions.includes('assets.create');

    function handleFilter(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        router.get(route('assets.index'), Object.fromEntries(form), { preserveState: true });
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">Assets</h2>
                    {canCreate && (
                            <Button asChild>
                            <Link href={route('assets.create')}>New Intake</Link>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Assets" />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <form onSubmit={handleFilter} className="mb-6 grid gap-3 md:grid-cols-4">
                    <Input name="search" placeholder="Search..." defaultValue={filters.search} />
                    <select name="type" defaultValue={filters.type ?? ''} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                        <option value="">All types</option>
                        {types.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                    <select name="status" defaultValue={filters.status ?? ''} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                        <option value="">All statuses</option>
                        {statuses.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                    <Button type="submit" variant="secondary">Filter</Button>
                </form>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Code</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Municipality</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {assets.data.map((asset) => (
                                <tr key={asset.id}>
                                    <td className="px-4 py-3 text-sm font-medium">{asset.asset_code.slice(0, 8)}…</td>
                                    <td className="px-4 py-3 text-sm capitalize">{asset.type}</td>
                                    <td className="px-4 py-3 text-sm">{asset.municipality_of_origin}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <AssetStatusBadge status={asset.current_status} label={asset.current_status.replace(/_/g, ' ')} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link href={route('assets.show', asset.id)} className="text-sm text-emerald-700 hover:underline">
                                            View
                                        </Link>
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
