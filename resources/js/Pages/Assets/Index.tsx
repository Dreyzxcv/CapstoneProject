import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Asset, PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Filter, Package, Plus, Search } from 'lucide-react';

interface AssetsIndexProps {
    assets: {
        data: Asset[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { status?: string; type?: string; search?: string };
    statuses: Array<{ value: string; label: string }>;
    types: Array<{ value: string; label: string }>;
}

const selectClass =
    'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600';

export default function AssetsIndex({ assets, filters, statuses, types }: AssetsIndexProps) {
    const { auth } = usePage<PageProps>().props;
    const canCreate = auth.user?.permissions.includes('assets.create');

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
                <Card>
                    <CardContent className="pt-6">
                        <form
                            onSubmit={handleFilter}
                            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_200px_auto]"
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
                                {assets.data.map((asset) => (
                                    <Link
                                        key={asset.id}
                                        href={route('assets.show', asset.id)}
                                        className="flex items-center justify-between gap-3 px-4 py-4 active:bg-gray-50"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-gray-900">{asset.asset_code}</p>
                                            <p className="mt-0.5 text-sm capitalize text-gray-500">
                                                {asset.type} &middot; {asset.municipality_of_origin}
                                            </p>
                                        </div>
                                        <AssetStatusBadge
                                            status={asset.current_status}
                                            label={asset.current_status.replace(/_/g, ' ')}
                                        />
                                    </Link>
                                ))}
                            </div>

                            {/* Desktop: table */}
                            <div className="hidden overflow-x-auto sm:block">
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
                                            <tr key={asset.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{asset.asset_code}</td>
                                                <td className="px-4 py-3 text-sm capitalize text-gray-600">{asset.type}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{asset.municipality_of_origin}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <AssetStatusBadge
                                                        status={asset.current_status}
                                                        label={asset.current_status.replace(/_/g, ' ')}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Link href={route('assets.show', asset.id)} className="text-sm font-medium text-emerald-700 hover:underline">
                                                        View
                                                    </Link>
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
        </AuthenticatedLayout>
    );
}