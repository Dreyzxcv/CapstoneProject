import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Head, router, useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import { FormEvent, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { documentUrl, donationDocumentUrl, formatDonationId } from '@/lib/utils';

interface DisposalItem {
    id: number;
    quantity: number;
    volume_bd_ft: string | null;
    processed_at: string;
    processed_by?: { name: string };
    asset: { id: number; asset_code: string; aap_number: string | null; species: string | null; type: string } | null;
    disposal_jev: { jev_number: string; uploaded_at: string | null; pdf_path: string | null } | null;
    details: { delivery_coordinates?: string } | null;
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
    can: { releaseDonation: boolean };
}

const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'awaiting_jev_out', label: 'Awaiting JEV Out' },
    { value: 'awaiting_upload', label: 'Awaiting MES Upload' },
    { value: 'awaiting_release', label: 'Awaiting Release' },
    { value: 'released', label: 'Released' },
];

// Modal section: top divider and spacing, except when it's the first in its column
const MODAL_SECTION = 'border-t border-gray-100 pt-3 first:border-t-0 first:pt-0';

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
            {/* Top row: donation ID + status */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">Donation ID: {formatDonationId(row.id)}</p>
                    {assetCodes.length > 0 ? (
                        <p className="text-xs text-gray-500 break-words">Assets: {assetCodes.join(', ')}</p>
                    ) : (
                        <p className="text-xs text-gray-400">No assets</p>
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

function donationDocuments(d: DonationRow) {
    return [
        { label: 'Deed of Donation', url: donationDocumentUrl(d.id, 'deed-of-donation', d.deed_of_donation_path) },
        { label: 'Waybill',          url: donationDocumentUrl(d.id, 'waybill', d.waybill_pdf_path) },
        { label: 'Release Order',    url: donationDocumentUrl(d.id, 'release-order', d.release_order_pdf_path) },
        { label: 'Release Photo',    url: donationDocumentUrl(d.id, 'release-photo', d.release_photo_path) },
        // JEV Out belongs to a disposal, so it keeps the existing route
        { label: 'JEV Out',          url: documentUrl(d.disposals.find((x) => x.disposal_jev?.pdf_path)?.disposal_jev?.pdf_path ?? null) },
    ].filter((doc) => doc.url);
}

function DonationReleaseSection({ donation, canRelease }: { donation: DonationRow; canRelease: boolean }) {
    const form = useForm<{ photo: File | null }>({ photo: null });

    // Any disposal of this donation resolves to the same donation on the server.
    const releaseDisposal = donation.disposals[0];
    const readyForRelease = donation.disposals.some((d) => d.disposal_jev?.uploaded_at);
    const photoUrl = donationDocumentUrl(donation.id, 'release-photo', donation.release_photo_path);

    function submit(e: FormEvent) {
        e.preventDefault();
        if (!releaseDisposal) return;
        if (!confirm('Mark this donation as released to the requester?')) return;
        form.post(route('disposals.release-donation', releaseDisposal.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    }

    return (
        <section className={MODAL_SECTION}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {donation.released_at ? 'Donation Released' : 'Donation Release'}
            </p>

            {donation.released_at ? (
                <div className="space-y-3">

                    {photoUrl ? (
                        <a
                            href={photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open release photo"
                            className="block overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                        >
                            <img
                                src={photoUrl}
                                alt="Release photo"
                                loading="lazy"
                                className="max-h-72 w-full object-contain"
                            />
                        </a>
                    ) : (
                        <p className="text-xs text-gray-400">No release photo on file.</p>
                    )}
                </div>
            ) : !readyForRelease ? (
                <p className="text-sm text-gray-500">Release becomes available once the JEV Out has been uploaded.</p>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                        Deed of Donation is on file for <span className="font-medium">{donation.requester_name}</span>. Mark
                        as released once the item has been handed over.
                    </p>

                    {canRelease && (
                        <form onSubmit={submit} className="space-y-3">
                            <label className="flex cursor-pointer items-center justify-center gap-2 break-all rounded-lg border-2 border-dashed border-gray-300 p-3 text-center text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
                                {form.data.photo ? form.data.photo.name : 'Attach release photo (opens camera on mobile)'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => form.setData('photo', e.target.files?.[0] ?? null)}
                                    required
                                />
                            </label>
                            <InputError message={form.errors.photo} />
                            <Button type="submit" disabled={form.processing}>
                                {form.processing ? 'Releasing…' : 'Mark Donation Released'}
                            </Button>
                        </form>
                    )}
                </div>
            )}
        </section>
    );
}

export default function Donations({ donations, filters, can }: DonationsProps) {
    const [search, setSearch] = useState(filters.search);
    const [viewingId, setViewingId] = useState<number | null>(null);
    const viewingDonation = donations.data.find((d) => d.id === viewingId) ?? null;
    const viewingDocs = viewingDonation ? donationDocuments(viewingDonation) : [];

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
                                placeholder="Search donation ID, asset code, requester, or agency…"
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
                            <DonationCard key={formatDonationId(row.id)} row={row} onView={() => setViewingId(row.id)} />
                        ))
                    )}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
                    <table className="min-w-[1000px] w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Donation ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Assets</th>
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
                                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Gift className="h-8 w-8 text-gray-300" />
                                            No donations match these filters.
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {donations.data.map((row) => (
                                <tr key={row.id}>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{formatDonationId(row.id)}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {row.disposals.length > 0 ? (
                                            <div className="space-y-0.5">
                                                {row.disposals.map((d) => (
                                                    <div key={d.id}>
                                                        <span className="font-medium text-gray-900 shrink-0">
                                                            <span className="text-xs font-normal text-gray-400">Asset No.: </span>
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
                                            onClick={() => setViewingId(row.id)}
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
            <Modal show={viewingDonation !== null} onClose={() => setViewingId(null)} maxWidth="6xl">
                {viewingDonation && (
                    <div className="flex max-h-[calc(100dvh-5rem)] flex-col">

                        {/* Sticky header (stays visible while the body scrolls) */}
                        <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-base font-semibold text-gray-900">Donation Details</h2>
                                    <p className="mt-0.5 break-words text-xs text-gray-500">
                                        Donation ID: {formatDonationId(viewingDonation.id)}
                                        {viewingDonation.disposals[0]?.processed_at &&
                                            ` · ${new Date(viewingDonation.disposals[0].processed_at).toLocaleDateString()}`}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <StatusPill row={viewingDonation} />
                                    <button
                                        type="button"
                                        onClick={() => setViewingId(null)}
                                        aria-label="Close"
                                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable body: one column on small screens, two from lg */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6">
                            <div className="grid gap-6 lg:grid-cols-2">

                                {/* Left column: who it's for */}
                                <div className="min-w-0 space-y-4">
                                    <section className={MODAL_SECTION}>
                                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Requester</p>
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

                                    {(viewingDonation.donor_representative_name || viewingDonation.witness_1_name || viewingDonation.witness_2_name) && (
                                        <section className={MODAL_SECTION}>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Signatories</p>
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
                                </div>

                                {/* Right column: what was donated and where it stands */}
                                <div className="min-w-0 space-y-4">
                                    {viewingDonation.disposals.length > 0 && (
                                        <section className={MODAL_SECTION}>
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Assets Donated</p>
                                            <div className="space-y-1">
                                                {viewingDonation.disposals.map((d) => (
                                                    <div key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
                                                        <span className="min-w-0 break-words font-medium text-gray-900">
                                                            <span className="text-xs font-normal text-gray-400">Asset No.: </span>
                                                            {d.asset?.aap_number ?? d.asset?.asset_code ?? '—'}
                                                        </span>
                                                        <span className="shrink-0 text-right text-xs text-gray-500">
                                                            {d.quantity} unit{d.quantity === 1 ? '' : 's'}
                                                            {d.volume_bd_ft && ` · ${Number(d.volume_bd_ft).toFixed(2)} bd.ft`}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    <section className={MODAL_SECTION}>
                                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</p>
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

                                    <DonationReleaseSection key={viewingDonation.id} donation={viewingDonation} canRelease={can.releaseDonation} />

                                    {viewingDocs.length > 0 && (
                                        <section className={MODAL_SECTION}>
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Documents</p>
                                            <div className="flex flex-wrap gap-2">
                                                {viewingDocs.map((doc) => (
                                                    <a
                                                        key={doc.label}
                                                        href={doc.url ?? '#'}
                                                        className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                                                    >
                                                        {doc.label}
                                                    </a>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sticky footer */}
                        <div className="flex shrink-0 justify-end border-t border-gray-100 px-4 py-3 sm:px-6">
                            <Button type="button" variant="outline" onClick={() => setViewingId(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </AuthenticatedLayout>
    );
}