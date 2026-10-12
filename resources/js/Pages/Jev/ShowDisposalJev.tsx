import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { PageProps } from '@/types';
import { FormEventHandler, Fragment, ReactNode, useState } from 'react';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import { Badge } from '@/Components/ui/badge';

interface AssetPiece {
    id: number;
    piece_number: number;
    species: string | null;
    volume_bd_ft: number | string | null;
    volume_cu_m: number | string | null;
    estimated_value: number | string | null;
}

interface DisposalJev {
    id: number;
    jev_number: string;
    created_at: string;
}

interface Donation {
    id: number;
    requester_name: string;
    agency_name: string | null;
    municipality: string | null;
    barangay: string | null;
    street: string | null;
}

interface DisposalAsset {
    id: number;
    asset_code: string;
    type: string;
    aap_number: string | null;
    pieces: AssetPiece[];
}

interface DisposalRecord {
    id: number;
    quantity: number;
    processed_at: string;
    asset: DisposalAsset | null;
    donation: Donation | null;
    disposal_jev: DisposalJev | null;
}

interface SiblingDisposal {
    id: number;
    quantity: number;
    processed_at: string;
    asset: DisposalAsset | null;
}

interface Props extends PageProps {
    disposal: DisposalRecord;
    siblings: SiblingDisposal[];
    can: { issue_jev_out: boolean };
}

/* ───────────── Helpers ───────────── */

const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const peso = (v: number | string | null | undefined) =>
    v === null || v === undefined || v === '' ? '—' : `₱ ${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const fixed2 = (v: number | string | null | undefined) =>
    v === null || v === undefined || v === '' ? '—' : Number(v).toFixed(2);

/** Same labels/colors as the JEV index page. */
function StatusPill({ issued }: { issued: boolean }) {
    if (issued) return <Badge className="bg-green-600 text-white">Issued</Badge>;
    return (
        <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700">
            Awaiting JEV OUT
        </Badge>
    );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium text-gray-400">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-gray-800">{children}</dd>
        </div>
    );
}

/* ───────────── Sibling assets ───────────── */

function SiblingsTable({ siblings }: { siblings: SiblingDisposal[] }) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const withPieces = siblings.filter((s) => (s.asset?.pieces?.length ?? 0) > 0);
    const allOpen = withPieces.length > 0 && withPieces.every((s) => expanded.has(s.id));
    const totalQty = siblings.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

    const toggle = (id: number) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500';

    return (
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-700">
                    Assets in this batch <span className="font-normal text-gray-400">({siblings.length})</span>
                </h3>
                {withPieces.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setExpanded(allOpen ? new Set() : new Set(withPieces.map((s) => s.id)))}
                        className="text-xs font-medium text-emerald-600 hover:underline"
                    >
                        {allOpen ? 'Collapse all pieces' : 'Expand all pieces'}
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className={th}>Asset</th>
                            <th scope="col" className={`${th} text-right`}>Qty</th>
                            <th scope="col" className={th}>Pieces</th>
                            <th scope="col" className={`${th} hidden sm:table-cell`}>Processed</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {siblings.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                                    No assets found for this donation.
                                </td>
                            </tr>
                        )}
                        {siblings.map((s) => {
                            const pieces = s.asset?.pieces ?? [];
                            const open = expanded.has(s.id);
                            return (
                                <Fragment key={s.id}>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-3 py-2">
                                            <div className="font-medium text-gray-800">{s.asset?.asset_code ?? '—'}</div>
                                            <div className="text-xs text-gray-400">
                                                {s.asset?.aap_number ? `AAP ${s.asset.aap_number}` : 'No AAP no.'}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{s.quantity}</td>
                                        <td className="px-3 py-2">
                                            {pieces.length > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(s.id)}
                                                    aria-expanded={open}
                                                    className="whitespace-nowrap rounded border border-gray-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                                                >
                                                    {pieces.length} piece{pieces.length !== 1 ? 's' : ''} {open ? '▲' : '▼'}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="hidden whitespace-nowrap px-3 py-2 text-gray-500 sm:table-cell">
                                            {fmtDate(s.processed_at)}
                                        </td>
                                    </tr>
                                    {open && pieces.length > 0 && (
                                        <tr>
                                            <td colSpan={4} className="bg-gray-50 px-3 py-3">
                                                <div className="max-h-64 overflow-auto rounded border border-gray-100 bg-white">
                                                    <table className="min-w-full text-xs">
                                                        <thead>
                                                            <tr className="text-gray-500">
                                                                <th className="sticky top-0 bg-gray-50 px-3 py-1.5 text-left font-semibold">Piece #</th>
                                                                <th className="sticky top-0 bg-gray-50 px-3 py-1.5 text-left font-semibold">Species</th>
                                                                <th className="sticky top-0 bg-gray-50 px-3 py-1.5 text-right font-semibold">Vol (bd ft)</th>
                                                                <th className="sticky top-0 bg-gray-50 px-3 py-1.5 text-right font-semibold">Est. value</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {pieces.map((p) => (
                                                                <tr key={p.id} className="text-gray-600">
                                                                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-gray-700">#{p.piece_number}</td>
                                                                    <td className="px-3 py-1.5 capitalize">{p.species ?? '—'}</td>
                                                                    <td className="px-3 py-1.5 text-right tabular-nums">{fixed2(p.volume_bd_ft)}</td>
                                                                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                                                                        {p.estimated_value ? peso(p.estimated_value) : '—'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                    {siblings.length > 0 && (
                        <tfoot>
                            <tr className="bg-gray-50 text-xs font-semibold text-gray-700">
                                <td className="px-3 py-2">Total</td>
                                <td className="px-3 py-2 text-right tabular-nums">{totalQty}</td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </section>
    );
}

/* ───────────── Page ───────────── */

export default function ShowDisposalJev({ disposal, siblings, can }: Props) {
    const form = useForm({ jev_number: '' });
    const [justIssued, setJustIssued] = useState(false);

    const { donation, disposal_jev } = disposal;
    const issued = !!disposal_jev;

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        form.post(route('disposals.jev-out.store', disposal.id), {
            preserveScroll: true,
            onSuccess: () => setJustIssued(true),
        });
    };

    const donationId = donation ? `DON-${String(donation.id).padStart(4, '0')}` : '—';
    const recipient = donation ? donation.agency_name || donation.requester_name : '—';
    const contact = donation && donation.agency_name ? donation.requester_name : null;
    const address =
        [donation?.street, donation?.barangay, donation?.municipality].filter(Boolean).join(', ') || 'No address on file';
    const hasError = !!form.errors.jev_number;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Link href={route('jev.index')} className="text-sm text-gray-500 hover:text-gray-700">
                        ← JEV
                    </Link>
                    <span className="text-gray-400">/</span>
                    <h2 className="text-xl font-semibold text-gray-800">Journal Entry Voucher (OUT)</h2>
                    <StatusPill issued={issued} />
                </div>
            }
        >
            <Head title={donation ? `JEV OUT — ${donationId}` : 'JEV OUT'} />

            <div className="py-8">
                <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
                    {/* Donation batch + recipient */}
                    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 text-sm font-semibold text-gray-700">Donation batch</h3>
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Item label="Donation ID">
                                <span className="text-base font-semibold">{donationId}</span>
                            </Item>
                            <Item label="Assets in batch">
                                <span className="text-base font-semibold">{siblings.length}</span>
                            </Item>
                            <Item label="Recipient">
                                <span className="font-semibold">{recipient}</span>
                                {contact && <span className="block text-xs text-gray-500">Contact: {contact}</span>}
                            </Item>
                            <Item label="Delivery address">{address}</Item>
                        </dl>
                    </section>

                    {/* Awaiting issuance: form */}
                    {!issued && can.issue_jev_out && (
                        <section className="rounded-lg border-2 border-amber-300 bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-md bg-amber-50 px-5 py-3">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-800">Issue JEV OUT</h3>
                                    <p className="text-xs text-amber-800">
                                        This donation is waiting for a JEV OUT. Review the assets below, then enter the number.
                                    </p>
                                </div>
                                <StatusPill issued={false} />
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4 p-5" noValidate>
                                {hasError && (
                                    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                        Please fix 1 problem below.
                                    </div>
                                )}
                                <p className="text-xs text-gray-500">
                                    Fields marked <span className="text-red-500">*</span> are required. Once issued, the JEV can’t be changed from this page.
                                </p>

                                <fieldset disabled={form.processing}>
                                    <label htmlFor="jev_number" className="block text-sm font-medium text-gray-700">
                                        JEV OUT number
                                        <span className="ml-0.5 text-red-500" aria-hidden>*</span>
                                        <span className="sr-only"> (required)</span>
                                    </label>
                                    <input
                                        id="jev_number"
                                        type="text"
                                        className={`mt-1 block w-full rounded-md text-sm shadow-sm focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                                            hasError ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-emerald-500'
                                        }`}
                                        value={form.data.jev_number}
                                        onChange={(e) => form.setData('jev_number', e.target.value)}
                                        placeholder="e.g. JEV-2026-09-0004"
                                        aria-invalid={hasError}
                                        autoFocus
                                    />
                                    <InputError message={form.errors.jev_number} className="mt-1" />
                                </fieldset>

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                                    {!form.data.jev_number.trim() && !form.processing && (
                                        <span className="text-xs text-gray-400">Enter a JEV OUT number to continue.</span>
                                    )}
                                    <PrimaryButton
                                        disabled={form.processing || !form.data.jev_number.trim()}
                                        className="justify-center"
                                    >
                                        {form.processing ? 'Issuing…' : 'Issue JEV OUT'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </section>
                    )}

                    {/* Awaiting issuance, no permission */}
                    {!issued && !can.issue_jev_out && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                            <p className="font-medium">Awaiting JEV OUT</p>
                            <p className="mt-1 text-amber-700">No JEV OUT has been issued for this donation yet. Accounting will issue it.</p>
                        </div>
                    )}

                    {/* Issued: read-only summary */}
                    {disposal_jev && (
                        <section className="overflow-hidden rounded-lg border-2 border-green-300 bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-green-50 px-5 py-3">
                                <div>
                                    <h3 className="text-base font-semibold text-green-900">JEV OUT issued</h3>
                                    {justIssued && (
                                        <p role="status" className="text-xs text-green-700">JEV OUT was issued successfully.</p>
                                    )}
                                </div>
                                <StatusPill issued />
                            </div>
                            <div className="p-5">
                                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                    <Item label="JEV OUT number">
                                        <span className="font-mono font-semibold">{disposal_jev.jev_number}</span>
                                    </Item>
                                    <Item label="Issued on">{fmtDate(disposal_jev.created_at)}</Item>
                                    <Item label="Donation">{donationId}</Item>
                                    <Item label="Recipient">{recipient}</Item>
                                </dl>
                                {disposal.asset && (
                                    <div className="mt-4 border-t border-gray-100 pt-3">
                                        <Link
                                            href={route('assets.show', disposal.asset.id)}
                                            className="text-sm font-medium text-emerald-600 hover:underline"
                                        >
                                            View asset →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    <SiblingsTable siblings={siblings} />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}