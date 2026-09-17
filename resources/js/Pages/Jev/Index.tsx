import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { PageProps, Jev, Asset } from '@/types';
import { Badge } from '@/Components/ui/badge';

interface JevWithAsset extends Jev {
    asset: Asset & {
        incident?: {
            incident_number: string;
        };
    };
}

interface Props extends PageProps {
    jevs: {
        data: JevWithAsset[];
        current_page: number;
        last_page: number;
        next_page_url: string | null;
        prev_page_url: string | null;
    };
}

function StatusBadge({ jev }: { jev: Jev }) {
    if (jev.uploaded_at) {
        return <Badge className="bg-green-600 text-white">Uploaded</Badge>;
    }
    if (jev.issued_at) {
        return <Badge className="bg-blue-600 text-white">Issued</Badge>;
    }
    return <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending</Badge>;
}

export default function JevIndex({ jevs }: Props) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold text-gray-800">
                    Journal Entry Vouchers
                </h2>
            }
        >
            <Head title="JEV" />

            <div className="py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset Code</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Incident</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">JEV No.</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {jevs.data.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                            No JEVs found.
                                        </td>
                                    </tr>
                                )}
                                {jevs.data.map((jev) => (
                                    <tr key={jev.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {jev.asset?.asset_code ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {jev.asset?.incident?.incident_number ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {jev.jev_number ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {jev.jev_date ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {jev.amount
                                                ? `₱ ${Number(jev.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge jev={jev} />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={route('assets.jev.show', jev.asset_id)}
                                                className="text-sm text-emerald-600 hover:underline"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {jevs.last_page > 1 && (
                            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
                                <span>Page {jevs.current_page} of {jevs.last_page}</span>
                                <div className="flex gap-2">
                                    {jevs.prev_page_url && (
                                        <Link href={jevs.prev_page_url} className="rounded border border-gray-200 px-3 py-1 hover:bg-gray-50">
                                            Previous
                                        </Link>
                                    )}
                                    {jevs.next_page_url && (
                                        <Link href={jevs.next_page_url} className="rounded border border-gray-200 px-3 py-1 hover:bg-gray-50">
                                            Next
                                        </Link>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}