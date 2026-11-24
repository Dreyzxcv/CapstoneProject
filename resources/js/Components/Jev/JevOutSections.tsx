import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import { cn, formatDonationId } from '@/lib/utils';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, Fragment, useEffect, useState } from 'react';
import {
    AwaitingNotice,
    DetailItem,
    FieldLabel,
    JevStatusBadge,
    PostOptions,
    Section,
    fixed2,
    fmtDate,
    inputCls,
    peso,
} from './shared';

/* ───────────── Types (shape of the detail payload) ───────────── */

export interface JevOutPiece {
    id: number;
    piece_number: number;
    species: string | null;
    volume_bd_ft: number | string | null;
    volume_cu_m?: number | string | null;
    estimated_value: number | string | null;
}

export interface JevOutDonation {
    id: number;
    requester_name: string;
    agency_name: string | null;
    municipality: string | null;
    barangay: string | null;
    street: string | null;
}

export interface JevOutAsset {
    id: number;
    asset_code: string;
    type: string;
    aap_number: string | null;
    pieces: JevOutPiece[];
}

export interface JevOutSibling {
    id: number;
    quantity: number;
    processed_at: string;
    asset: JevOutAsset | null;
}

export interface JevOutRecord {
    id: number;
    jev_number: string;
    created_at: string;
}

export interface JevOutDetail {
    disposal: {
        id: number;
        donation: JevOutDonation | null;
        disposal_jev: JevOutRecord | null;
    };
    siblings: JevOutSibling[];
    can: { issue_jev_out: boolean };
}

/** Display facts derived from the donation (same rules the old page used). */
export function donationFacts(donation: JevOutDonation | null) {
    return {
        donationId: donation ? formatDonationId(donation.id) : '—',
        recipient: donation ? donation.agency_name || donation.requester_name : '—',
        contact: donation && donation.agency_name ? donation.requester_name : null,
        address:
            [donation?.street, donation?.barangay, donation?.municipality].filter(Boolean).join(', ') ||
            'No address on file',
    };
}
export type DonationFacts = ReturnType<typeof donationFacts>;

/* ───────────── General details ───────────── */

export function DonationSummarySection({ facts, assetCount }: { facts: DonationFacts; assetCount: number }) {
    return (
        <Section title="Donation batch">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <DetailItem label="Donation ID">
                    <span className="text-base font-semibold">{facts.donationId}</span>
                </DetailItem>
                <DetailItem label="Assets in batch">
                    <span className="text-base font-semibold">{assetCount}</span>
                </DetailItem>
                <DetailItem label="Recipient">
                    <span className="font-semibold">{facts.recipient}</span>
                </DetailItem>
                <DetailItem label="Contact person">{facts.contact ?? '—'}</DetailItem>
                <div className="sm:col-span-2">
                    <DetailItem label="Delivery address">{facts.address}</DetailItem>
                </div>
            </dl>
        </Section>
    );
}

/* ───────────── Assets in the batch ───────────── */

export function BatchAssetsSection({ siblings }: { siblings: JevOutSibling[] }) {
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
        <Section
            padded={false}
            title={
                <>
                    Assets in this batch <span className="font-normal text-gray-400">({siblings.length})</span>
                </>
            }
            aside={
                withPieces.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => setExpanded(allOpen ? new Set() : new Set(withPieces.map((s) => s.id)))}
                        className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                        {allOpen ? 'Collapse all pieces' : 'Expand all pieces'}
                    </button>
                ) : undefined
            }
        >
            {/* Scrolls inside the card, never the page. */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className={th}>Asset</th>
                            <th scope="col" className={cn(th, 'text-right')}>Qty</th>
                            <th scope="col" className={th}>Pieces</th>
                            <th scope="col" className={cn(th, 'hidden sm:table-cell')}>Processed</th>
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
                                                    className="whitespace-nowrap rounded-md border border-gray-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
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
                                                <div className="max-h-64 overflow-auto rounded-md border border-gray-100 bg-white">
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
        </Section>
    );
}

/* ───────────── Issuance ───────────── */

export function JevOutIssueForm({
    disposalId,
    postOptions,
    onIssued,
    onProcessingChange,
    autoFocus = false,
}: {
    disposalId: number;
    postOptions?: PostOptions;
    onIssued?: () => void;
    onProcessingChange?: (processing: boolean) => void;
    autoFocus?: boolean;
}) {
    const form = useForm({ jev_number: '' });
    const hasError = !!form.errors.jev_number;

    useEffect(() => {
        onProcessingChange?.(form.processing);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.processing]);
    useEffect(() => () => onProcessingChange?.(false),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (form.processing) return; // no duplicate submissions
        form.post(route('disposals.jev-out.store', disposalId), {
            preserveScroll: true,
            ...postOptions,
            onSuccess: () => onIssued?.(),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-4" noValidate>
            {hasError && (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Please fix 1 problem below.
                </div>
            )}
            <p className="text-xs text-gray-500">
                Fields marked <span className="text-red-500">*</span> are required. Once issued, the JEV can’t be changed.
            </p>

            <fieldset disabled={form.processing}>
                <FieldLabel htmlFor="jev_out_number" required>JEV OUT number</FieldLabel>
                <input
                    id="jev_out_number"
                    type="text"
                    className={inputCls(hasError)}
                    value={form.data.jev_number}
                    onChange={(e) => form.setData('jev_number', e.target.value)}
                    placeholder="e.g. JEV-2026-09-0004"
                    aria-invalid={hasError}
                    autoFocus={autoFocus}
                />
                <InputError message={form.errors.jev_number} className="mt-1" />
            </fieldset>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                {!form.data.jev_number.trim() && !form.processing && (
                    <span className="text-xs text-gray-400">Enter a JEV OUT number to continue.</span>
                )}
                <PrimaryButton disabled={form.processing || !form.data.jev_number.trim()} className="justify-center">
                    {form.processing ? 'Issuing…' : 'Issue JEV OUT'}
                </PrimaryButton>
            </div>
        </form>
    );
}

export function JevOutIssuedSummary({
    jev,
    facts,
    compact = false,
    justIssued = false,
}: {
    jev: JevOutRecord;
    facts: DonationFacts;
    compact?: boolean;
    justIssued?: boolean;
}) {
    return (
        <Section
            tone="issued"
            title="JEV OUT issued"
            description={justIssued ? 'JEV OUT was issued successfully.' : undefined}
            aside={<JevStatusBadge issued jevType="OUT" />}
        >
            <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', !compact && 'sm:grid-cols-2')}>
                <DetailItem label="JEV OUT number">
                    <span className="font-mono font-semibold">{jev.jev_number}</span>
                </DetailItem>
                <DetailItem label="Issued on">{fmtDate(jev.created_at)}</DetailItem>
                <DetailItem label="Donation">{facts.donationId}</DetailItem>
                <DetailItem label="Recipient">{facts.recipient}</DetailItem>
            </dl>
        </Section>
    );
}

/** Picks the right block: issued summary, issue form (authorized), or read-only notice. */
export function JevOutIssuanceSection({
    disposalId,
    jev,
    facts,
    canIssue,
    compact,
    autoFocus,
    justIssued,
    postOptions,
    onIssued,
    onProcessingChange,
}: {
    disposalId: number;
    jev: JevOutRecord | null;
    facts: DonationFacts;
    canIssue: boolean;
    compact?: boolean;
    autoFocus?: boolean;
    justIssued?: boolean;
    postOptions?: PostOptions;
    onIssued?: () => void;
    onProcessingChange?: (processing: boolean) => void;
}) {
    if (jev) return <JevOutIssuedSummary jev={jev} facts={facts} compact={compact} justIssued={justIssued} />;

    if (canIssue) {
        return (
            <Section
                tone="pending"
                title="Issue JEV OUT"
                description="This donation is waiting for a JEV OUT. Review the assets, then enter the number."
                aside={<JevStatusBadge issued={false} jevType="OUT" />}
            >
                <JevOutIssueForm
                    disposalId={disposalId}
                    autoFocus={autoFocus}
                    postOptions={postOptions}
                    onIssued={onIssued}
                    onProcessingChange={onProcessingChange}
                />
            </Section>
        );
    }

    return <AwaitingNotice jevType="OUT" what="donation" />;
}