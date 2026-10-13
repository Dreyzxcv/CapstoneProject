import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { Gift } from 'lucide-react';
import { documentUrl } from '@/lib/utils';

interface DisposalItem {
    id: number;
    quantity: number;
    volume_bd_ft: string | null;
    processed_at: string;
    processed_by?: { name: string };
    asset: { id: number; asset_code: string; aap_number: string | null; species: string | null; type: string } | null;
    disposal_jev: { jev_number: string; uploaded_at: string | null; pdf_path: string | null } | null;
}

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
    disposals: DisposalItem[];
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

// Converts snake_case or underscore strings to Title Case
function humanize(str: string | null | undefined): string {
    if (!str) return '—';
    return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function orgLabel(row: DonationRow): string {
    if (row.organization_type === 'other' && row.organization_type_other) {
        return humanize(row.organization_type_other);
    }
    return humanize(row.organization_type);
}

function StatusPill({ row }: { row: DonationRow }) {
    if (row.released_at) {
        return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 whitespace-nowrap">Released</span>;
    }
    const anyJev      = row.disposals.some((d) => d.disposal_jev);
    const anyUploaded = row.disposals.some((d) => d.disposal_jev?.uploaded_at);
    if (anyUploaded) {
        return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 whitespace-nowrap">Awaiting Release</span>;
    }
    if (anyJev) {
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 whitespace-nowrap">Awaiting MES Upload</span>;
    }
    return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 whitespace-nowrap">Awaiting JEV Out</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="py-2 border-b border-gray-100 last:border-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">{label}</dt>
            <dd className="text-sm text-gray-900 break-words">{children}</dd>
        </div>
    );
}

// Card layout used on mobile instead of a table row
function DonationCard({ row, onView }: { row: DonationRow; onView: () => void }) {
    const assetCodes = row.disposals.map((d) => d.asset?.aap_number ?? d.asset?.asset_code).filter(Boolean);
    const processedAt = row.disposals[0]?.processed_at
        ? new Date(row.disposals[0].processed_at).toLocaleDateString()
        : null;

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-2">
            {/* Top row: assets + status */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    {assetCodes.length > 0 ? (
                        assetCodes.map((code, i) => (
                            <p key={i} className="text-sm font-semibold text-gray-900 leading-snug">{code}</p>
                        ))
                    ) : (
                        <p className="text-sm text-gray-400">No assets</p>
                    )}
                    {row.disposals[0]?.asset?.species && (
                        <p className="text-xs text-gray-500">{row.disposals[0].asset.species}</p>
                    )}
                </div>
                <StatusPill row={row} />
            </div>

            {/* Details */}
            <div className="text-sm text-gray-700 space-y-0.5">
                <p><span className="text-gray-400 text-xs">Requester: </span>{row.requester_name}</p>
                <p><span className="text-gray-400 text-xs">Org: </span>{orgLabel(row)}{row.agency_name ? ` · ${row.agency_name}` : ''}</p>
                {(row.barangay || row.municipality) && (
                    <p><span className="text-gray-400 text-xs">Location: </span>
                        {[row.barangay, row.municipality].filter(Boolean).join(', ')}
                    </p>
                )}
                {processedAt && (
                    <p><span className="text-gray-400 text-xs">Processed: </span>{processedAt}</p>
                )}
            </div>

            <div className="pt-1 text-right">
                <button
                    type="button"
                    onClick={onView}
                    className="text-sm font-medium text-emerald-700 hover:underline"
                >
                    View Details
                </button>
            </div>
        </div>
    );
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
                {/* Search + filter bar */}
                <Card>
                    <CardContent className="pt-4 space-y-3">
                        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search asset code, requester, or agency…"
                                className="h-9 flex-1 min-w-0 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                            <Button type="submit" size="sm" variant="outline" className="shrink-0">Search</Button>
                        </form>

                        <div className="flex flex-wrap gap-1.5">
                            {STATUS_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => applyFilters({ status: opt.value })}
                                    className={
                                        'rounded-full px-3 py-1 text-xs font-semibold transition whitespace-nowrap ' +
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

                {/* Mobile: card list */}
                <div className="sm:hidden space-y-3">
                    {donations.data.length === 0 ? (
                        <div className="rounded-lg border border-gray-200 bg-white py-10 flex flex-col items-center gap-2 text-sm text-gray-500">
                            <Gift className="h-8 w-8 text-gray-300" />
                            No donations match these filters.
                        </div>
                    ) : (
                        donations.data.map((row) => (
                            <DonationCard key={row.id} row={row} onView={() => setViewingDonation(row)} />
                        ))
                    )}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
                    <table className="min-w-[900px] w-full divide-y divide-gray-200">
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
                                        {row.disposals.length > 0 ? (
                                            <div className="space-y-0.5">
                                                {row.disposals.map((d) => (
                                                    <div key={d.id}>
                                                        <span className="font-medium text-gray-900">
                                                            {d.asset?.aap_number ?? d.asset?.asset_code ?? '—'}
                                                        </span>
                                                        {d.asset?.species && (
                                                            <span className="ml-1 text-xs text-gray-500">{d.asset.species}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{row.requester_name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {orgLabel(row)}
                                        {row.agency_name && <p className="text-xs text-gray-500">{row.agency_name}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {[row.barangay, row.municipality].filter(Boolean).join(', ') || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {row.disposals[0]?.processed_at
                                            ? new Date(row.disposals[0].processed_at).toLocaleDateString()
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

                {/* Pagination */}
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

            {/* Donation detail modal */}
            <Modal show={viewingDonation !== null} onClose={() => setViewingDonation(null)} maxWidth="lg">
                {viewingDonation && (
                    <div className="flex flex-col max-h-[85vh]">

                        {/* Sticky header */}
                        <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-base font-semibold text-gray-900">Donation Details</h2>
                                    <p className="mt-0.5 text-xs text-gray-500 break-words">
                                        {viewingDonation.disposals.map((d) => d.asset?.aap_number ?? d.asset?.asset_code).filter(Boolean).join(', ')}
                                        {viewingDonation.disposals[0]?.processed_at &&
                                            ` · ${new Date(viewingDonation.disposals[0].processed_at).toLocaleDateString()}`}
                                    </p>
                                </div>
                                <div className="shrink-0">
                                    <StatusPill row={viewingDonation} />
                                </div>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">

                            {/* Requester info */}
                            <section>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Requester</p>
                                <dl>
                                    <Field label="Name">{viewingDonation.requester_name}</Field>
                                    <Field label="Organization">{orgLabel(viewingDonation)}</Field>
                                    {viewingDonation.agency_name && (
                                        <Field label="Agency">{viewingDonation.agency_name}</Field>
                                    )}
                                    {viewingDonation.donee_position && (
                                        <Field label="Donee Position">{viewingDonation.donee_position}</Field>
                                    )}
                                    <Field label="Delivery Address">
                                        {[viewingDonation.street, viewingDonation.barangay, viewingDonation.municipality]
                                            .filter(Boolean)
                                            .join(', ') || 'No address on file'}
                                    </Field>
                                    {viewingDonation.purpose_statement && (
                                        <Field label="Purpose">{viewingDonation.purpose_statement}</Field>
                                    )}
                                    {viewingDonation.confiscation_order_reference && (
                                        <Field label="Confiscation Order Ref.">{viewingDonation.confiscation_order_reference}</Field>
                                    )}
                                </dl>
                            </section>

                            {/* Assets donated */}
                            {viewingDonation.disposals.length > 0 && (
                                <section className="border-t border-gray-100 pt-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Assets Donated</p>
                                    <div className="space-y-1">
                                        {viewingDonation.disposals.map((d) => (
                                            <div key={d.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm gap-2">
                                                <span className="font-medium text-gray-900 shrink-0">{d.asset?.aap_number ?? d.asset?.asset_code ?? '—'}</span>
                                                <span className="text-gray-500 text-xs text-right">
                                                    {d.quantity} unit{d.quantity === 1 ? '' : 's'}
                                                    {d.volume_bd_ft && ` · ${Number(d.volume_bd_ft).toFixed(2)} bd.ft`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Signatories */}
                            {(viewingDonation.donor_representative_name || viewingDonation.witness_1_name || viewingDonation.witness_2_name) && (
                                <section className="border-t border-gray-100 pt-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Signatories</p>
                                    <dl>
                                        {viewingDonation.donor_representative_name && (
                                            <Field label="Donor Representative">
                                                {viewingDonation.donor_representative_name}
                                                {viewingDonation.donor_representative_title && (
                                                    <span className="text-gray-500"> — {viewingDonation.donor_representative_title}</span>
                                                )}
                                            </Field>
                                        )}
                                        {viewingDonation.witness_1_name && (
                                            <Field label="Witness 1">
                                                {viewingDonation.witness_1_name}
                                                {viewingDonation.witness_1_title && (
                                                    <span className="text-gray-500"> — {viewingDonation.witness_1_title}</span>
                                                )}
                                            </Field>
                                        )}
                                        {viewingDonation.witness_2_name && (
                                            <Field label="Witness 2">
                                                {viewingDonation.witness_2_name}
                                                {viewingDonation.witness_2_title && (
                                                    <span className="text-gray-500"> — {viewingDonation.witness_2_title}</span>
                                                )}
                                            </Field>
                                        )}
                                    </dl>
                                </section>
                            )}

                            {/* Status */}
                            <section className="border-t border-gray-100 pt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Status</p>
                                <p className="text-sm text-gray-700">
                                    {viewingDonation.released_at
                                        ? `Released ${new Date(viewingDonation.released_at).toLocaleString()}`
                                        : viewingDonation.disposals.some((d) => d.disposal_jev?.uploaded_at)
                                            ? 'JEV Out uploaded — awaiting physical release.'
                                            : viewingDonation.disposals.some((d) => d.disposal_jev)
                                                ? 'JEV Out issued — awaiting MES upload confirmation.'
                                                : 'Awaiting JEV Out from Accounting.'}
                                </p>
                            </section>

                            {/* Documents */}
                            {[
                                { path: viewingDonation.deed_of_donation_path,  label: 'Deed of Donation' },
                                { path: viewingDonation.waybill_pdf_path,        label: 'Waybill' },
                                { path: viewingDonation.release_order_pdf_path,  label: 'Release Order' },
                                { path: viewingDonation.release_photo_path,      label: 'Release Photo' },
                                { path: viewingDonation.disposals.find((d) => d.disposal_jev?.pdf_path)?.disposal_jev?.pdf_path ?? null, label: 'JEV Out' },
                            ].filter((doc) => documentUrl(doc.path)).length > 0 && (
                                <section className="border-t border-gray-100 pt-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Documents</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { path: viewingDonation.deed_of_donation_path,  label: 'Deed of Donation' },
                                            { path: viewingDonation.waybill_pdf_path,        label: 'Waybill' },
                                            { path: viewingDonation.release_order_pdf_path,  label: 'Release Order' },
                                            { path: viewingDonation.release_photo_path,      label: 'Release Photo' },
                                            { path: viewingDonation.disposals.find((d) => d.disposal_jev?.pdf_path)?.disposal_jev?.pdf_path ?? null, label: 'JEV Out' },
                                        ].filter((doc) => documentUrl(doc.path)).map((doc) => (
                                            <a
                                                key={doc.label}
                                                href={documentUrl(doc.path) ?? '#'}
                                                className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                                            >
                                                {doc.label}
                                            </a>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Sticky footer */}
                        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex justify-end">
                            <Button type="button" variant="outline" onClick={() => setViewingDonation(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </AuthenticatedLayout>
    );
}