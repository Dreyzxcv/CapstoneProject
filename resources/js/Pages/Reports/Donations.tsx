import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { Gift } from 'lucide-react';
import { documentUrl } from '@/lib/utils';

interface DonationRow {
    id: number;
    requester_name: string;
    organization_type: string | null;
    organization_type_other: string | null;
    agency_name: string | null;
    municipality: string | null;
    barangay: string | null;
    street: string | null;
    deed_of_donation_path: string | null;
    release_photo_path: string | null;
    waybill_pdf_path: string | null;
    release_order_pdf_path: string | null;
    released_at: string | null;
    donee_position: string | null;
    purpose_statement: string | null;
    confiscation_order_reference: string | null;
    donor_representative_name: string | null;
    donor_representative_title: string | null;
    witness_1_name: string | null;
    witness_1_title: string | null;
    witness_2_name: string | null;
    witness_2_title: string | null;
    disposal: {
        id: number;
        quantity: number;
        volume_bd_ft: string | null;
        processed_at: string;
        processed_by?: { name: string };
        asset: { id: number; asset_code: string; species: string | null; type: string } | null;
        disposal_jev: { jev_number: string; uploaded_at: string | null; pdf_path: string | null } | null;
    } | null;
}

interface PaginatedDonations {
    data: DonationRow[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
    total: number;
    from: number | null;
    to: number | null;
}

interface DonationsProps {
    donations: PaginatedDonations;
    filters: { status: string; search: string };
}

const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'awaiting_jev_out', label: 'Awaiting JEV Out' },
    { value: 'awaiting_upload', label: 'Awaiting MES Upload' },
    { value: 'awaiting_release', label: 'Awaiting Release' },
    { value: 'released', label: 'Released' },
];

function orgLabel(row: DonationRow): string {
    if (row.organization_type === 'other' && row.organization_type_other) {
        return row.organization_type_other;
    }
    return row.organization_type ?? '—';
}

function StatusPill({ row }: { row: DonationRow }) {
    if (row.released_at) {
        return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Released</span>;
    }
    if (row.disposal?.disposal_jev?.uploaded_at) {
        return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">Awaiting Release</span>;
    }
    if (row.disposal?.disposal_jev) {
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Awaiting MES Upload</span>;
    }
    return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">Awaiting JEV Out</span>;
}

export default function Donations({ donations, filters }: DonationsProps) {
    const [search, setSearch] = useState(filters.search);
    const [viewingDonation, setViewingDonation] = useState<DonationRow | null>(null);

    function applyFilters(next: Partial<{ status: string; search: string }>) {
        router.get(
            route('reports.donations'),
            { status: filters.status, search, ...next },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    function handleSearchSubmit(e: FormEvent) {
        e.preventDefault();
        applyFilters({ search });
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-gray-800">Donations Report</h2>
                    <a href={route('reports.index')} className="text-sm text-emerald-700 hover:underline">
                        Back to Reports
                    </a>
                </div>
            }
        >
            <Head title="Donations Report" />

            <div className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6 lg:px-8">
                <Card>
                    <CardContent className="flex flex-wrap items-center gap-3 pt-4">
                        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search asset code, requester, or agency…"
                                className="h-9 w-64 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                            <Button type="submit" size="sm" variant="outline">Search</Button>
                        </form>

                        <div className="flex flex-wrap gap-1.5">
                            {STATUS_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => applyFilters({ status: opt.value })}
                                    className={
                                        'rounded-full px-3 py-1 text-xs font-semibold transition ' +
                                        (filters.status === opt.value
                                            ? 'bg-emerald-700 text-white'
                                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
                                    }
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Asset</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Requester</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Organization</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Municipality</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Processed</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {donations.data.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Gift className="h-8 w-8 text-gray-300" />
                                            No donations match these filters.
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {donations.data.map((row) => (
                                <tr key={row.id}>
                                    <td className="px-4 py-3 text-sm">
                                        {row.disposal?.asset ? (
                                            <span className="font-medium text-gray-900">
                                                {row.disposal.asset.asset_code.slice(0, 8)}…
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                        {row.disposal?.asset?.species && (
                                            <p className="text-xs text-gray-500">{row.disposal.asset.species}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{row.requester_name}</td>
                                    <td className="px-4 py-3 text-sm capitalize text-gray-600">
                                        {orgLabel(row)}
                                        {row.agency_name && <p className="text-xs text-gray-500">{row.agency_name}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {[row.barangay, row.municipality].filter(Boolean).join(', ') || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {row.disposal?.processed_at
                                            ? new Date(row.disposal.processed_at).toLocaleDateString()
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <StatusPill row={row} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => setViewingDonation(row)}
                                            className="text-sm text-emerald-700 hover:underline"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {donations.total > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                        <p>
                            Showing {donations.from}–{donations.to} of {donations.total} donation
                            {donations.total === 1 ? '' : 's'}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {donations.links.map((link, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    disabled={!link.url}
                                    onClick={() => link.url && router.visit(link.url, { preserveState: true, preserveScroll: true })}
                                    className={
                                        'rounded-md border px-2.5 py-1 text-xs ' +
                                        (link.active
                                            ? 'border-emerald-700 bg-emerald-700 text-white'
                                            : link.url
                                              ? 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                              : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300')
                                    }
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Donation detail modal — donation content only, no asset navigation */}
            <Modal show={viewingDonation !== null} onClose={() => setViewingDonation(null)} maxWidth="lg">
                {viewingDonation && (
                    <div className="p-6">
                        <h2 className="text-lg font-medium text-gray-900">Donation Details</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            {viewingDonation.disposal?.asset?.asset_code.slice(0, 8)}…
                            {viewingDonation.disposal?.processed_at &&
                                ` — processed ${new Date(viewingDonation.disposal.processed_at).toLocaleString()}`}
                        </p>

                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-gray-500">Requester</dt>
                                <dd className="text-gray-900">{viewingDonation.requester_name}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Organization</dt>
                                <dd className="text-gray-900 capitalize">{orgLabel(viewingDonation)}</dd>
                            </div>
                            {viewingDonation.agency_name && (
                                <div>
                                    <dt className="text-gray-500">Agency</dt>
                                    <dd className="text-gray-900">{viewingDonation.agency_name}</dd>
                                </div>
                            )}
                            {viewingDonation.donee_position && (
                                <div>
                                    <dt className="text-gray-500">Donee Position</dt>
                                    <dd className="text-gray-900">{viewingDonation.donee_position}</dd>
                                </div>
                            )}
                            <div className="sm:col-span-2">
                                <dt className="text-gray-500">Delivery Address</dt>
                                <dd className="text-gray-900">
                                    {[viewingDonation.street, viewingDonation.barangay, viewingDonation.municipality]
                                        .filter(Boolean)
                                        .join(', ') || 'No address on file'}
                                </dd>
                            </div>
                            {viewingDonation.purpose_statement && (
                                <div className="sm:col-span-2">
                                    <dt className="text-gray-500">Purpose</dt>
                                    <dd className="text-gray-900">{viewingDonation.purpose_statement}</dd>
                                </div>
                            )}
                            {viewingDonation.confiscation_order_reference && (
                                <div>
                                    <dt className="text-gray-500">Confiscation Order Ref.</dt>
                                    <dd className="text-gray-900">{viewingDonation.confiscation_order_reference}</dd>
                                </div>
                            )}
                            {viewingDonation.disposal?.quantity && (
                                <div>
                                    <dt className="text-gray-500">Quantity Donated</dt>
                                    <dd className="text-gray-900">{viewingDonation.disposal.quantity} unit(s)</dd>
                                </div>
                            )}
                        </dl>

                        {(viewingDonation.donor_representative_name || viewingDonation.witness_1_name || viewingDonation.witness_2_name) && (
                            <div className="mt-4 border-t border-gray-100 pt-4">
                                <p className="text-sm font-semibold text-gray-700">Signatories</p>
                                <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                                    {viewingDonation.donor_representative_name && (
                                        <div>
                                            <dt className="text-gray-500">Donor Representative</dt>
                                            <dd className="text-gray-900">
                                                {viewingDonation.donor_representative_name}
                                                {viewingDonation.donor_representative_title && (
                                                    <span className="text-gray-500"> — {viewingDonation.donor_representative_title}</span>
                                                )}
                                            </dd>
                                        </div>
                                    )}
                                    {viewingDonation.witness_1_name && (
                                        <div>
                                            <dt className="text-gray-500">Witness 1</dt>
                                            <dd className="text-gray-900">
                                                {viewingDonation.witness_1_name}
                                                {viewingDonation.witness_1_title && (
                                                    <span className="text-gray-500"> — {viewingDonation.witness_1_title}</span>
                                                )}
                                            </dd>
                                        </div>
                                    )}
                                    {viewingDonation.witness_2_name && (
                                        <div>
                                            <dt className="text-gray-500">Witness 2</dt>
                                            <dd className="text-gray-900">
                                                {viewingDonation.witness_2_name}
                                                {viewingDonation.witness_2_title && (
                                                    <span className="text-gray-500"> — {viewingDonation.witness_2_title}</span>
                                                )}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                        )}

                        <div className="mt-4 border-t border-gray-100 pt-4">
                            <p className="text-sm font-semibold text-gray-700">Status</p>
                            <p className="mt-1 text-sm text-gray-600">
                                {viewingDonation.released_at
                                    ? `Released ${new Date(viewingDonation.released_at).toLocaleString()}`
                                    : viewingDonation.disposal?.disposal_jev?.uploaded_at
                                      ? 'JEV Out uploaded — awaiting physical release.'
                                      : viewingDonation.disposal?.disposal_jev
                                        ? 'JEV Out issued — awaiting MES upload confirmation.'
                                        : 'Awaiting JEV Out from Accounting.'}
                            </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                            {documentUrl(viewingDonation.deed_of_donation_path) && (
                                <a href={documentUrl(viewingDonation.deed_of_donation_path) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                    Download Deed of Donation
                                </a>
                            )}
                            {documentUrl(viewingDonation.waybill_pdf_path) && (
                                <a href={documentUrl(viewingDonation.waybill_pdf_path) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                    Download Waybill
                                </a>
                            )}
                            {documentUrl(viewingDonation.release_order_pdf_path) && (
                                <a href={documentUrl(viewingDonation.release_order_pdf_path) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                    Download Release Order
                                </a>
                            )}
                            {documentUrl(viewingDonation.release_photo_path) && (
                                <a href={documentUrl(viewingDonation.release_photo_path) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                    View Release Photo
                                </a>
                            )}
                            {documentUrl(viewingDonation.disposal?.disposal_jev?.pdf_path ?? null) && (
                                <a href={documentUrl(viewingDonation.disposal?.disposal_jev?.pdf_path ?? null) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                    Download JEV Out
                                </a>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                            <Button type="button" variant="outline" onClick={() => setViewingDonation(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </AuthenticatedLayout>
    );
}