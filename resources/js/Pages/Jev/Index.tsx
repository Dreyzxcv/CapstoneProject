import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { PageProps, Jev } from '@/types';
import { Badge } from '@/Components/ui/badge';

interface PendingAsset {
    id: number;
    asset_code: string;
    aap_number: string | null;
    type: string;
    current_status: string;
}

interface DisposalAwaitingJevOut {
    id: number;
    requester_name: string;
    agency_name: string | null;
    disposals: {
        id: number;
        asset: { id: number; asset_code: string; type: string } | null;
    }[];
}
interface Props extends PageProps {
    jevs: {
        data: Jev[];
        current_page: number;
        last_page: number;
        next_page_url: string | null;
        prev_page_url: string | null;
    };
    pendingAssets: PendingAsset[];
    disposalsAwaitingJevOut: DisposalAwaitingJevOut[];
}

function StatusBadge({ jev }: { jev: Jev }) {
    if (jev.jev_number) return <Badge className="bg-green-600 text-white">Issued</Badge>;
    return <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending</Badge>;
}

export default function JevIndex({ jevs, pendingAssets, disposalsAwaitingJevOut }: Props) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-gray-800">Journal Entry Vouchers</h2>}
        >
            <Head title="JEV" />

            <div className="py-8">
                <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">

                    {/* ── Pending JEV IN section ── */}
                    {pendingAssets.length > 0 && (
                        <div>
                            <div className="mb-3 flex items-center gap-2">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    Cleared for Custodian — Awaiting JEV
                                </h3>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                    {pendingAssets.length}
                                </span>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-amber-200 bg-white shadow-sm">
                                <table className="min-w-full divide-y divide-gray-100 text-sm">
                                    <thead className="bg-amber-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset Code</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">AAP No.</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {pendingAssets.map((asset) => (
                                            <tr key={asset.id} className="hover:bg-amber-50/40">
                                                <td className="px-4 py-3 font-medium text-gray-800">{asset.asset_code}</td>
                                                <td className="px-4 py-3 text-gray-500">{asset.aap_number ?? '—'}</td>
                                                <td className="px-4 py-3 capitalize text-gray-600">{asset.type}</td>
                                                <td className="px-4 py-3">
                                                    <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                                                        Cleared for Custodian
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Link
                                                        href={route('assets.jev.show', asset.id)}
                                                        className="text-sm font-medium text-emerald-600 hover:underline"
                                                    >
                                                        Issue JEV IN →
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {disposalsAwaitingJevOut.length > 0 && (
                    <div>
                        <div className="mb-3 flex items-center gap-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                Donations — Awaiting JEV Out
                            </h3>
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                {disposalsAwaitingJevOut.length}
                            </span>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-rose-200 bg-white shadow-sm">
                            <table className="min-w-full divide-y divide-gray-100 text-sm">
                                <thead className="bg-rose-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Donation ID</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Recipient</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {disposalsAwaitingJevOut.map((donation) => (
                                        <tr key={donation.id} className="hover:bg-rose-50/40">
                                            <td className="px-4 py-3 font-medium text-gray-800">
                                                {`DON-${String(donation.id).padStart(4, '0')}`}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {donation.agency_name ?? donation.requester_name}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge className="bg-rose-100 text-rose-700 border-rose-200">
                                                    Awaiting JEV Out
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {/* Link to first disposal's JEV out page */}
                                                <Link
                                                    href={route('disposals.jev-out.show', donation.disposals[0]?.id ?? 0)}
                                                    className="text-sm font-medium text-emerald-600 hover:underline"
                                                >
                                                    Issue JEV Out →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                    {/* ── All JEVs table ── */}
                    <div>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                            All JEVs
                        </h3>
                        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset Code</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
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
                                            <td className="px-4 py-3 font-medium text-gray-800">{jev.asset_code}</td>
                                            <td className="px-4 py-3 capitalize text-gray-600">{jev.asset_type}</td>
                                            <td className="px-4 py-3 text-gray-700">{jev.jev_number ?? '—'}</td>
                                            <td className="px-4 py-3 text-gray-500">
                                                {jev.jev_date
                                                    ? new Date(jev.jev_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">
                                                {jev.amount
                                                    ? `₱ ${Number(jev.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3"><StatusBadge jev={jev} /></td>
                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    href={route('assets.jev.show', { asset: jev.asset_code, type: jev.asset_type })}
                                                    className="text-sm text-emerald-600 hover:underline"
                                                >
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

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
            </div>
        </AuthenticatedLayout>
    );
}