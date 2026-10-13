import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { PageProps } from '@/types';
import { FormEventHandler, useState } from 'react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import { Badge } from '@/Components/ui/badge';

interface AssetPiece {
    id: number;
    piece_number: number;
    species: string | null;
    volume_bd_ft: number | null;
    volume_cu_m: number | null;
    estimated_value: number | null;
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

interface Props extends PageProps {
    disposal: DisposalRecord;
    can: {
        issue_jev_out: boolean;
    };
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

function StatusBadge({ disposalJev }: { disposalJev: DisposalJev | null }) {
    if (!disposalJev) {
        return <Badge variant="outline" className="text-gray-500">Not Yet Issued</Badge>;
    }
    return <Badge className="bg-green-600 text-white">Issued</Badge>;
}

function SiblingRow({ sibling }: { sibling: SiblingDisposal }) {
    const [expanded, setExpanded] = useState(false);
    const hasPieces = (sibling.asset?.pieces?.length ?? 0) > 0;

    return (
        <>
            <tr className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{sibling.asset?.asset_code ?? '—'}</td>
                <td className="px-3 py-2 text-gray-500">{sibling.asset?.aap_number ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{sibling.quantity}</td>
                <td className="px-3 py-2">
                    {hasPieces ? (
                        <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            className="text-xs text-emerald-600 hover:underline"
                        >
                            {sibling.asset!.pieces.length} piece{sibling.asset!.pieces.length !== 1 ? 's' : ''} {expanded ? '▲' : '▼'}
                        </button>
                    ) : (
                        <span className="text-xs text-gray-400">—</span>
                    )}
                </td>
                <td className="px-3 py-2 text-gray-500">
                    {new Date(sibling.processed_at).toLocaleDateString('en-PH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                    })}
                </td>
            </tr>
            {expanded && hasPieces && (
                <tr>
                    <td colSpan={5} className="bg-gray-50 px-3 py-2">
                        <table className="min-w-full text-xs divide-y divide-gray-100">
                            <thead>
                                <tr className="text-gray-400">
                                    <th className="py-1 pr-4 text-left font-semibold">Piece #</th>
                                    <th className="py-1 pr-4 text-left font-semibold">Species</th>
                                    <th className="py-1 pr-4 text-left font-semibold">Vol (bd ft)</th>
                                    <th className="py-1 text-left font-semibold">Est. Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sibling.asset!.pieces.map((piece) => (
                                    <tr key={piece.id}>
                                        <td className="py-1 pr-4 text-gray-700">#{piece.piece_number}</td>
                                        <td className="py-1 pr-4 text-gray-600 capitalize">{piece.species ?? '—'}</td>
                                        <td className="py-1 pr-4 text-gray-600">{piece.volume_bd_ft?.toFixed(2) ?? '—'}</td>
                                        <td className="py-1 text-gray-600">
                                            {piece.estimated_value
                                                ? `₱ ${piece.estimated_value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </td>
                </tr>
            )}
        </>
    );
}

export default function ShowDisposalJev({ disposal, siblings, can }: Props) {
    const form = useForm({ jev_number: '' });

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        form.post(route('disposals.jev-out.store', disposal.id), {
            preserveScroll: true,
        });
    };

    const { asset, donation, disposal_jev } = disposal;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-3">
                    <Link
                        href={route('jev.index')}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        ← JEV
                    </Link>
                    <span className="text-gray-400">/</span>
                    <h2 className="text-xl font-semibold text-gray-800">
                        Journal Entry Voucher (OUT)
                    </h2>
                    <StatusBadge disposalJev={disposal_jev} />
                </div>
            }
        >
            <Head title="JEV Out" />

            <div className="py-8">
                <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">

                    {/* Disposal context */}
                    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Donation ID</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">
                                    {donation ? `DON-${String(donation.id).padStart(4, '0')}` : '—'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Assets</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{siblings.length}</p>
                            </div>
                        </div>

                        {/* Compact assets table */}
                        <div className="overflow-hidden rounded-md border border-gray-100">
                            <table className="min-w-full text-sm divide-y divide-gray-100">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Asset</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">AAP No.</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Qty</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Pieces</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Processed</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {siblings.map((s) => (
                                        <SiblingRow key={s.id} sibling={s} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recipient */}
                    {donation && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                                Recipient
                            </p>
                            <p className="font-semibold text-gray-800">{donation.requester_name}</p>
                            {donation.agency_name && (
                                <p className="text-sm text-gray-600">{donation.agency_name}</p>
                            )}
                            <p className="text-sm text-gray-500">
                                {[donation.street, donation.barangay, donation.municipality]
                                    .filter(Boolean)
                                    .join(', ') || 'No address on file'}
                            </p>
                        </div>
                    )}

                    {/* Issue form — only when no jev yet and user can issue */}
                    {!disposal_jev && can.issue_jev_out && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 text-base font-semibold text-gray-700">
                                Issue JEV Out
                            </h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <InputLabel htmlFor="jev_number" value="JEV Out Number" />
                                    <input
                                        id="jev_number"
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        value={form.data.jev_number}
                                        onChange={(e) => form.setData('jev_number', e.target.value)}
                                        placeholder="e.g. JEV-2026-09-0004"
                                    />
                                    <InputError message={form.errors.jev_number} className="mt-1" />
                                </div>

                                <div className="flex justify-end">
                                    <PrimaryButton
                                        disabled={form.processing || !form.data.jev_number.trim()}
                                    >
                                        {form.processing ? 'Issuing…' : 'Issue JEV Out'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Read-only once issued */}
                    {disposal_jev && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 text-base font-semibold text-gray-700">
                                JEV Out Details
                            </h3>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div>
                                    <dt className="text-gray-400 font-medium">JEV Out Number</dt>
                                    <dd className="font-mono text-gray-800">{disposal_jev.jev_number}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-400 font-medium">Issued On</dt>
                                    <dd className="text-gray-800">
                                        {new Date(disposal_jev.created_at).toLocaleDateString('en-PH', {
                                            year: 'numeric', month: 'short', day: 'numeric',
                                        })}
                                    </dd>
                                </div>
                            </dl>
                            <div className="mt-4 border-t border-gray-100 pt-3">
                                <Link
                                    href={route('assets.show', asset?.id ?? 0)}
                                    className="text-sm font-medium text-emerald-600 hover:underline"
                                >
                                    View Asset →
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* No permission, no jev */}
                    {!disposal_jev && !can.issue_jev_out && (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-5 text-sm text-gray-500">
                            No JEV Out has been issued for this donation yet.
                        </div>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}