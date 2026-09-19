import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Asset, AssetPiece, Jev, PageProps } from '@/types';
import { FormEventHandler } from 'react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import { Badge } from '@/Components/ui/badge';

interface Props extends PageProps {
    asset: Asset & {
        incident?: {
            incident_number: string;
        };
        pieces?: AssetPiece[];
    };
    jev: Jev | null;
    can: { issue_jev: boolean };
}

function PiecesTable({ asset }: { asset: Props['asset'] }) {
    const pieces = asset.pieces ?? [];
    if (pieces.length === 0) return null;

    const type = asset.type;
    const isLog = type === 'log';
    const isVehicle = type === 'vehicle';
    const isEquipment = type === 'equipment';

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
                Asset Pieces
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                            <th className="pb-2 pr-4">#</th>
                            {isLog && (
                                <>
                                    <th className="pb-2 pr-4">Species</th>
                                    <th className="pb-2 pr-4">L × W × H (cm)</th>
                                    <th className="pb-2 pr-4">Vol (bd ft)</th>
                                    <th className="pb-2 pr-4">Vol (cu m)</th>
                                </>
                            )}
                            {isVehicle && (
                                <>
                                    <th className="pb-2 pr-4">Vehicle Type</th>
                                    <th className="pb-2 pr-4">Plate No.</th>
                                    <th className="pb-2 pr-4">Serial No.</th>
                                </>
                            )}
                            {isEquipment && (
                                <>
                                    <th className="pb-2 pr-4">Equipment Type</th>
                                    <th className="pb-2 pr-4">Serial No.</th>
                                </>
                            )}
                            {!isLog && !isVehicle && !isEquipment && (
                                <th className="pb-2 pr-4">Species / Description</th>
                            )}
                            <th className="pb-2 pr-4">Est. Value (₱)</th>
                            <th className="pb-2">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {pieces.map((piece) => (
                            <tr key={piece.id} className="text-gray-700">
                                <td className="py-2 pr-4 text-gray-400">{piece.piece_number}</td>
                                {isLog && (
                                    <>
                                        <td className="py-2 pr-4">{piece.species ?? '—'}</td>
                                        <td className="py-2 pr-4">
                                            {[piece.length, piece.width, piece.height]
                                                .map(v => v ?? '—')
                                                .join(' × ')}
                                        </td>
                                        <td className="py-2 pr-4">{piece.volume_bd_ft ?? '—'}</td>
                                        <td className="py-2 pr-4">{piece.volume_cu_m ?? '—'}</td>
                                    </>
                                )}
                                {isVehicle && (
                                    <>
                                        <td className="py-2 pr-4">{piece.vehicle_type ?? '—'}</td>
                                        <td className="py-2 pr-4">{piece.plate_number ?? '—'}</td>
                                        <td className="py-2 pr-4">{piece.serial_number ?? '—'}</td>
                                    </>
                                )}
                                {isEquipment && (
                                    <>
                                        <td className="py-2 pr-4">{piece.equipment_type ?? '—'}</td>
                                        <td className="py-2 pr-4">{piece.serial_number ?? '—'}</td>
                                    </>
                                )}
                                {!isLog && !isVehicle && !isEquipment && (
                                    <td className="py-2 pr-4">{piece.species ?? piece.description ?? '—'}</td>
                                )}
                                <td className="py-2 pr-4">
                                    {piece.estimated_value
                                        ? `₱ ${Number(piece.estimated_value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                        : '—'}
                                </td>
                                <td className="py-2">
                                    {piece.disposed_at
                                        ? <Badge variant="outline" className="text-xs text-red-500 border-red-200">Disposed</Badge>
                                        : <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">Active</Badge>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ jev }: { jev: Jev | null }) {
    if (!jev) {
        return <Badge variant="outline" className="text-gray-500">Not Yet Issued</Badge>;
    }
    return <Badge className="bg-green-600 text-white">Issued</Badge>;
}

export default function JevShow({ asset, jev, can }: Props) {
    const form = useForm({
        jev_number:  '',
        jev_date:    '',
        particulars: '',
        amount:      '',
    });

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        form.post(route('assets.jev.store', asset.id), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-3">
                    <Link
                        href={route('assets.show', asset.id)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        ← {asset.asset_code}
                    </Link>
                    <span className="text-gray-400">/</span>
                    <h2 className="text-xl font-semibold text-gray-800">
                        Journal Entry Voucher (IN)
                    </h2>
                    <StatusBadge jev={jev} />
                </div>
            }
        >
            <Head title={`JEV — ${asset.asset_code}`} />

            <div className="py-8">
                <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">

                    {/* Asset context */}
                    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Asset</p>
                        <p className="mt-1 text-lg font-semibold text-gray-800">{asset.asset_code}</p>
                        {asset.aap_number && (
                            <p className="text-sm text-gray-500">AAP No. {asset.aap_number}</p>
                        )}
                        {asset.incident && (
                            <p className="text-sm text-gray-500">Incident: {asset.incident.incident_number}</p>
                        )}
                    </div>

                    <PiecesTable asset={asset} />

                    {/* Issue form -- only shown if no JEV yet and user can issue */}
                    {!jev && can.issue_jev && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 text-base font-semibold text-gray-700">Issue JEV</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <InputLabel htmlFor="jev_number" value="JEV Number" />
                                        <input
                                            id="jev_number"
                                            type="text"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                            value={form.data.jev_number}
                                            onChange={(e) => form.setData('jev_number', e.target.value)}
                                            placeholder="e.g. JEV-2026-00001"
                                        />
                                        <InputError message={form.errors.jev_number} className="mt-1" />
                                    </div>

                                    <div>
                                        <InputLabel htmlFor="jev_date" value="JEV Date" />
                                        <input
                                            id="jev_date"
                                            type="date"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                            value={form.data.jev_date}
                                            onChange={(e) => form.setData('jev_date', e.target.value)}
                                        />
                                        <InputError message={form.errors.jev_date} className="mt-1" />
                                    </div>
                                </div>

                                <div>
                                    <InputLabel htmlFor="particulars" value="Particulars" />
                                    <textarea
                                        id="particulars"
                                        rows={3}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        value={form.data.particulars}
                                        onChange={(e) => form.setData('particulars', e.target.value)}
                                    />
                                    <InputError message={form.errors.particulars} className="mt-1" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="amount" value="Amount (₱)" />
                                    <input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        value={form.data.amount}
                                        onChange={(e) => form.setData('amount', e.target.value)}
                                    />
                                    <InputError message={form.errors.amount} className="mt-1" />
                                </div>

                                <div className="flex justify-end">
                                    <PrimaryButton disabled={form.processing || !form.data.jev_number.trim() || !form.data.jev_date.trim()}>
                                        {form.processing ? 'Issuing…' : 'Issue JEV'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Read-only view once issued */}
                    {jev && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 text-base font-semibold text-gray-700">JEV Details</h3>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div>
                                    <dt className="text-gray-400 font-medium">JEV Number</dt>
                                    <dd className="text-gray-800">{jev.jev_number ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-400 font-medium">JEV Date</dt>
                                    <dd className="text-gray-800">
                                        {jev.jev_date
                                            ? new Date(jev.jev_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                                            : '—'}
                                    </dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-gray-400 font-medium">Particulars</dt>
                                    <dd className="text-gray-800 whitespace-pre-wrap">{jev.particulars ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-400 font-medium">Amount</dt>
                                    <dd className="text-gray-800">
                                        {jev.amount
                                            ? `₱ ${Number(jev.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                            : '—'}
                                    </dd>
                                </div>
                            </dl>

                            {/* Timestamps */}
                            <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
                                Issued on {jev.created_at
                                    ? new Date(jev.created_at).toLocaleDateString('en-PH')
                                    : '—'}
                            </div>

                            <div className="mt-3">
                                <Link
                                    href={route('assets.show', asset.id)}
                                    className="text-sm font-medium text-emerald-600 hover:underline"
                                >
                                    View Asset →
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* No JEV + no permission */}
                    {!jev && !can.issue_jev && (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-5 text-sm text-gray-500">
                            No JEV has been issued for this asset yet.
                        </div>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}