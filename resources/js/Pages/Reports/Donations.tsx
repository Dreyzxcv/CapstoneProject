import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Check, ClipboardList, FileText, Gift, Package, Pencil, User, X } from 'lucide-react';
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
    donation_number: string;
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
    can: {
        releaseDonation: boolean;
    };
}

const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'awaiting_jev_out', label: 'Awaiting JEV Out' },
    { value: 'awaiting_upload', label: 'Awaiting JEV Out Upload' },
    { value: 'awaiting_release', label: 'Awaiting Release' },
    { value: 'released', label: 'Released' },
];

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

function speciesSummary(row: DonationRow): string {
    return Array.from(new Set(row.disposals.map((d) => d.asset?.species).filter(Boolean))).join(', ');
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
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 whitespace-nowrap">Awaiting JEV Out Upload</span>;
    }
    return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 whitespace-nowrap">Awaiting JEV Out</span>;
}

// ── Detail-modal building blocks ──────────────────────────────────────────────

function Section({ icon, title, children, className = '' }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
    return (
        <section className={'rounded-lg border border-gray-200 bg-white ' + className}>
            <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 rounded-t-lg">
                <span className="text-emerald-700 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h3>
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div className={'min-w-0 ' + className}>
            <dt className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
            <dd className="break-words text-sm text-gray-900">{children}</dd>
        </div>
    );
}

function formatDate(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleDateString() : '—';
}

function ProgressSteps({ steps }: { steps: Array<{ label: string; done: boolean }> }) {
    return (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {steps.map((step, i) => (
                <li
                    key={step.label}
                    className={
                        'flex items-center gap-3 rounded-md border px-3 py-2.5 ' +
                        (step.done ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50')
                    }
                >
                    <span
                        className={
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ' +
                            (step.done ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500')
                        }
                    >
                        {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={'text-sm font-medium ' + (step.done ? 'text-emerald-800' : 'text-gray-500')}>{step.label}</span>
                </li>
            ))}
        </ol>
    );
}

function DonationCard({ row, onView }: { row: DonationRow; onView: () => void }) {
    const processedAt = row.disposals[0]?.processed_at
        ? new Date(row.disposals[0].processed_at).toLocaleDateString()
        : null;

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-2">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{row.donation_number}</p>
                    {speciesSummary(row) && <p className="text-xs text-gray-500">{speciesSummary(row)}</p>}
                </div>
                <StatusPill row={row} />
            </div>

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

// ── Release sub-form (rendered inside the detail modal) ───────────────────────

function ReleaseForm({ disposal, onSuccess }: { disposal: DisposalItem; onSuccess: () => void }) {
    const form = useForm<{ photo: File | null }>({ photo: null });

    function submit(e: FormEvent) {
        e.preventDefault();
        if (!confirm('Mark this donation as released to the requester?')) return;
        form.post(route('disposals.release-donation', disposal.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess,
        });
    }

    return (
        <form onSubmit={submit} className="space-y-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
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
            <Button type="submit" disabled={form.processing} className="w-full sm:w-auto">
                {form.processing ? 'Saving…' : 'Mark Donation Released'}
            </Button>
        </form>
    );
}

export default function Donations({ donations, filters, can }: DonationsProps) {
    const [search, setSearch] = useState(filters.search);
    const [viewingId, setViewingId] = useState<number | null>(null);

    // Derive the open donation from the current page props so the modal always
    // reflects fresh data (e.g. right after a release) without manual syncing.
    const viewingDonation = viewingId !== null ? donations.data.find((d) => d.id === viewingId) ?? null : null;

    // While the detail modal is open, freeze everything behind it. Locking <body>
    // alone isn't enough when the app layout scrolls inside its own container,
    // so we also swallow wheel/touch scrolling that starts outside the modal body.
    const modalOpen = viewingDonation !== null;
    useEffect(() => {
        if (!modalOpen) return;

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const blockOutsideScroll = (e: Event) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest('[data-modal-scroll]')) return;
            e.preventDefault();
        };

        document.addEventListener('wheel', blockOutsideScroll, { passive: false });
        document.addEventListener('touchmove', blockOutsideScroll, { passive: false });

        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('wheel', blockOutsideScroll);
            document.removeEventListener('touchmove', blockOutsideScroll);
        };
    }, [modalOpen]);

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

    function handleReleaseSuccess() {
        router.reload({ only: ['donations'] });
    }

    // Determine whether the currently-viewed donation is ready to release.
    // Mirrors the logic in Show.tsx: JEV Out must be uploaded, not yet released.
    function donationReadyForRelease(row: DonationRow): boolean {
        return (
            !row.released_at &&
            row.disposals.some((d) => d.disposal_jev?.uploaded_at)
        );
    }

    // Find the first disposal on this donation that has an uploaded JEV Out —
    // that is the one the release endpoint expects.
    function releasableDisposal(row: DonationRow): DisposalItem | undefined {
        return row.disposals.find((d) => d.disposal_jev?.uploaded_at);
    }

    const documents = viewingDonation
        ? [
              { path: viewingDonation.deed_of_donation_path, label: 'Deed of Donation' },
              { path: viewingDonation.waybill_pdf_path, label: 'Waybill' },
              { path: viewingDonation.release_order_pdf_path, label: 'Release Order' },
              { path: viewingDonation.release_photo_path, label: 'Release Photo' },
              {
                  path: viewingDonation.disposals.find((d) => d.disposal_jev?.pdf_path)?.disposal_jev?.pdf_path ?? null,
                  label: 'JEV Out',
              },
          ].filter((doc) => documentUrl(doc.path))
        : [];

    const signatories = viewingDonation
        ? [
              { role: 'Donor Representative', name: viewingDonation.donor_representative_name, title: viewingDonation.donor_representative_title },
              { role: 'Witness 1', name: viewingDonation.witness_1_name, title: viewingDonation.witness_1_title },
              { role: 'Witness 2', name: viewingDonation.witness_2_name, title: viewingDonation.witness_2_title },
          ].filter((s) => s.name)
        : [];

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
                                placeholder="Search donation no., asset code, requester, or agency…"
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
                            <DonationCard key={row.id} row={row} onView={() => setViewingId(row.id)} />
                        ))
                    )}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
                    <table className="min-w-[900px] w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Donation No.</th>
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
                                        <span className="font-medium text-gray-900">{row.donation_number}</span>
                                        {speciesSummary(row) && <p className="text-xs text-gray-500">{speciesSummary(row)}</p>}
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

            {/* Donation detail modal — uses the existing 6xl width option, so the shared Modal is untouched */}
            <Modal show={viewingDonation !== null} onClose={() => setViewingId(null)} maxWidth="6xl">
                {viewingDonation && (
                    <div className="flex max-h-[calc(100dvh-3rem)] flex-col">
                        {/* Fixed header */}
                        <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-semibold text-gray-900">Donation Details</h2>
                                    <p className="mt-0.5 break-words text-sm text-gray-500">
                                        <span className="font-medium text-gray-700">{viewingDonation.donation_number}</span>
                                        {viewingDonation.disposals[0]?.processed_at &&
                                            ` · Processed ${formatDate(viewingDonation.disposals[0].processed_at)}`}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    <StatusPill row={viewingDonation} />
                                    <button
                                        type="button"
                                        onClick={() => setViewingId(null)}
                                        aria-label="Close"
                                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div data-modal-scroll className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-gray-50 px-5 py-5 sm:px-6">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {/* Requester */}
                                <Section icon={<User />} title="Requester">
                                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                        <Field label="Name">{viewingDonation.requester_name}</Field>
                                        <Field label="Organization">{orgLabel(viewingDonation)}</Field>
                                        {viewingDonation.agency_name && (
                                            <Field label="Agency">{viewingDonation.agency_name}</Field>
                                        )}
                                        {viewingDonation.donee_position && (
                                            <Field label="Donee Position">{viewingDonation.donee_position}</Field>
                                        )}
                                        <Field label="Delivery Address" className="sm:col-span-2">
                                            {[viewingDonation.street, viewingDonation.barangay, viewingDonation.municipality]
                                                .filter(Boolean)
                                                .join(', ') || 'No address on file'}
                                        </Field>
                                    </dl>
                                </Section>

                                {/* Donation details */}
                                <Section icon={<ClipboardList />} title="Donation Details">
                                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                        <Field label="Processed">{formatDate(viewingDonation.disposals[0]?.processed_at)}</Field>
                                        <Field label="Released">
                                            {viewingDonation.released_at
                                                ? new Date(viewingDonation.released_at).toLocaleString()
                                                : 'Not yet released'}
                                        </Field>
                                        {viewingDonation.confiscation_order_reference && (
                                            <Field label="Confiscation Order Ref." className="sm:col-span-2">
                                                {viewingDonation.confiscation_order_reference}
                                            </Field>
                                        )}
                                        <Field label="Purpose" className="sm:col-span-2">
                                            {viewingDonation.purpose_statement || '—'}
                                        </Field>
                                    </dl>
                                </Section>
                            </div>

                            {/* Assets donated */}
                            {viewingDonation.disposals.length > 0 && (
                                <Section icon={<Package />} title={`Assets Donated (${viewingDonation.disposals.length})`}>
                                    <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
                                        {viewingDonation.disposals.map((d) => (
                                            <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                                                <div className="min-w-0">
                                                    <span className="font-medium text-gray-900">{d.asset?.aap_number ?? d.asset?.asset_code ?? '—'}</span>
                                                    {d.asset?.species && <span className="ml-2 text-xs text-gray-500">{d.asset.species}</span>}
                                                </div>
                                                <span className="text-xs text-gray-600">
                                                    {d.quantity} unit{d.quantity === 1 ? '' : 's'}
                                                    {d.volume_bd_ft && ` · ${Number(d.volume_bd_ft).toFixed(2)} bd.ft`}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </Section>
                            )}

                            {/* Signatories */}
                            {signatories.length > 0 && (
                                <Section icon={<Pencil />} title="Signatories">
                                    <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        {signatories.map((s) => (
                                            <Field key={s.role} label={s.role}>
                                                <span className="font-medium">{s.name}</span>
                                                {s.title && <span className="block text-xs text-gray-500">{s.title}</span>}
                                            </Field>
                                        ))}
                                    </dl>
                                </Section>
                            )}

                            {/* Release status + action */}
                            <Section icon={<Check />} title="Release Status">
                                <div className="space-y-4">
                                    <ProgressSteps
                                        steps={[
                                            { label: 'JEV Out issued', done: viewingDonation.disposals.some((d) => d.disposal_jev) },
                                            { label: 'JEV Out uploaded', done: viewingDonation.disposals.some((d) => d.disposal_jev?.uploaded_at) },
                                            { label: 'Released', done: !!viewingDonation.released_at },
                                        ]}
                                    />
                                    <p className="text-sm text-gray-700">
                                        {viewingDonation.released_at
                                            ? `Released ${new Date(viewingDonation.released_at).toLocaleString()}`
                                            : viewingDonation.disposals.some((d) => d.disposal_jev?.uploaded_at)
                                                ? 'JEV Out uploaded — awaiting physical release.'
                                                : viewingDonation.disposals.some((d) => d.disposal_jev)
                                                    ? 'JEV Out issued — awaiting upload by Accounting.'
                                                    : 'Awaiting JEV Out from Accounting.'}
                                    </p>

                                    {/* Release action — shown only when JEV Out uploaded and not yet released */}
                                    {can.releaseDonation && donationReadyForRelease(viewingDonation) && (
                                        <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4">
                                            <p className="mb-1 text-sm font-semibold text-gray-900">Release Donation</p>
                                            <p className="mb-3 text-sm text-gray-600">
                                                Deed of Donation is on file for{' '}
                                                <span className="font-medium">{viewingDonation.requester_name}</span>.
                                                Attach a release photo and confirm once the item has been handed over.
                                            </p>
                                            {(() => {
                                                const disposal = releasableDisposal(viewingDonation);
                                                if (!disposal) return null;
                                                return <ReleaseForm disposal={disposal} onSuccess={handleReleaseSuccess} />;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </Section>

                            {/* Documents */}
                            <Section icon={<FileText />} title="Documents">
                                {documents.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {documents.map((doc) => (
                                            <a
                                                key={doc.label}
                                                href={documentUrl(doc.path) ?? '#'}
                                                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                                            >
                                                <FileText className="h-3.5 w-3.5" />
                                                {doc.label}
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No documents on file yet.</p>
                                )}
                            </Section>
                        </div>

                        {/* Fixed footer */}
                        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-white px-5 py-3 sm:px-6">
                            <Button type="button" variant="outline" onClick={() => setViewingId(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </AuthenticatedLayout>
    );
}