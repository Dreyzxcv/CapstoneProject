import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Asset, AssetPiece, Jev, PageProps } from '@/types';
import { FormEventHandler, ReactNode, useState } from 'react';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import { Badge } from '@/Components/ui/badge';

interface Props extends PageProps {
    asset: Asset & { pieces?: AssetPiece[] };
    jev: Jev | null;
    can: { issue_jev: boolean };
}

/* ───────────── Helpers ───────────── */

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const peso = (v: number | string | null | undefined) =>
    v === null || v === undefined || v === ''
        ? '—'
        : `₱ ${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const titleCase = (s: string) => s.replace(/_/g, ' ');

/** Same labels/colors as the JEV index page. */
function StatusPill({ issued }: { issued: boolean }) {
    if (issued) return <Badge className="bg-green-600 text-white">Issued</Badge>;
    return (
        <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700">
            Awaiting JEV IN
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

function FieldLabel({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: ReactNode }) {
    return (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
            {children}
            {required && (
                <span className="ml-0.5 text-red-500" aria-hidden>
                    *
                </span>
            )}
            {required && <span className="sr-only"> (required)</span>}
        </label>
    );
}

const inputCls = (hasError: boolean) =>
    `mt-1 block w-full rounded-md text-sm shadow-sm focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400 ${
        hasError ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-emerald-500'
    }`;

/* ───────────── Asset summary ───────────── */

function AssetSummary({ asset }: { asset: Props['asset'] }) {
    const incident = asset.incident;
    const refLabel = asset.aap_number ? 'AAP No.' : asset.stcp_number ? 'STCP No.' : 'AAP/STCP No.';
    const quantity = [asset.quantity, asset.quantity_unit].filter((v) => v !== null && v !== undefined && v !== '').join(' ');

    return (
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Asset summary</h3>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <Item label="Asset code">
                    <span className="font-semibold">{asset.asset_code}</span>
                </Item>
                <Item label={refLabel}>{asset.aap_number ?? asset.stcp_number ?? '—'}</Item>
                <Item label="Type">
                    <span className="capitalize">{titleCase(asset.type)}</span>
                </Item>
                <Item label="Quantity">{quantity || '—'}</Item>
                <Item label="Municipality of origin">{asset.municipality_of_origin || '—'}</Item>
                <Item label="Location apprehended">{asset.location_apprehended || '—'}</Item>
            </dl>

            {incident && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                    <h4 className="mb-3 text-xs font-semibold text-gray-500">Incident</h4>
                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Item label="Incident code">{incident.incident_code}</Item>
                        <Item label="Date of apprehension">{fmtDate(incident.date_of_apprehension)}</Item>
                        <Item label="Apprehending party">{incident.apprehending_party || '—'}</Item>
                        <div className="sm:col-span-2 lg:col-span-3">
                            <Item label="Place of apprehension">{incident.place_of_apprehension || '—'}</Item>
                        </div>
                    </dl>
                </div>
            )}

            <div className="mt-4">
                <Link href={route('assets.show', asset.id)} className="text-sm font-medium text-emerald-600 hover:underline">
                    View asset →
                </Link>
            </div>
        </section>
    );
}

/* ───────────── Pieces ───────────── */

function PiecesTable({ asset }: { asset: Props['asset'] }) {
    const pieces = asset.pieces ?? [];
    if (pieces.length === 0) return null;

    const isLog = asset.type === 'log';
    const isVehicle = asset.type === 'vehicle';
    const isEquipment = asset.type === 'equipment';
    const disposedCount = pieces.filter((p) => p.disposed_at).length;

    const th = 'sticky top-0 z-10 whitespace-nowrap bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500';
    const td = 'whitespace-nowrap px-3 py-2';

    return (
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-700">
                    Asset pieces <span className="font-normal text-gray-400">({pieces.length})</span>
                </h3>
                <p className="text-xs text-gray-500">
                    {pieces.length - disposedCount} active · {disposedCount} disposed
                </p>
            </div>

            {/* Scrolls inside the card so long lists don't push the form away; header stays visible. */}
            <div className="max-h-96 overflow-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr>
                            <th className={th}>#</th>
                            {isLog && (
                                <>
                                    <th className={th}>Species</th>
                                    <th className={th}>L × W × H (cm)</th>
                                    <th className={`${th} text-right`}>Vol (bd ft)</th>
                                    <th className={`${th} text-right`}>Vol (cu m)</th>
                                    <th className={`${th} text-right`}>Est. value</th>
                                </>
                            )}
                            {isVehicle && (
                                <>
                                    <th className={th}>Vehicle type</th>
                                    <th className={th}>Plate no.</th>
                                </>
                            )}
                            {isEquipment && (
                                <>
                                    <th className={th}>Equipment type</th>
                                    <th className={th}>Serial no.</th>
                                </>
                            )}
                            {!isLog && !isVehicle && !isEquipment && <th className={th}>Species / description</th>}
                            <th className={th}>Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {pieces.map((piece) => (
                            <tr key={piece.id} className="text-gray-700 odd:bg-white even:bg-gray-50/50">
                                <td className={`${td} tabular-nums text-gray-400`}>{piece.piece_number}</td>
                                {isLog && (
                                    <>
                                        <td className={td}>{piece.species ?? '—'}</td>
                                        <td className={td}>
                                            {[piece.length, piece.width, piece.height].map((v) => v ?? '—').join(' × ')}
                                        </td>
                                        <td className={`${td} text-right tabular-nums`}>{piece.volume_bd_ft ?? '—'}</td>
                                        <td className={`${td} text-right tabular-nums`}>{piece.volume_cu_m ?? '—'}</td>
                                        <td className={`${td} text-right tabular-nums`}>
                                            {piece.estimated_value ? peso(piece.estimated_value) : '—'}
                                        </td>
                                    </>
                                )}
                                {isVehicle && (
                                    <>
                                        <td className={td}>{piece.vehicle_type ?? '—'}</td>
                                        <td className={td}>{piece.plate_number ?? '—'}</td>
                                    </>
                                )}
                                {isEquipment && (
                                    <>
                                        <td className={td}>{piece.equipment_type ?? '—'}</td>
                                        <td className={td}>{piece.serial_number ?? '—'}</td>
                                    </>
                                )}
                                {!isLog && !isVehicle && !isEquipment && (
                                    <td className="px-3 py-2">{piece.species ?? piece.description ?? '—'}</td>
                                )}
                                <td className={td}>
                                    {piece.disposed_at ? (
                                        <Badge variant="outline" className="border-red-200 text-xs text-red-500">Disposed</Badge>
                                    ) : (
                                        <Badge variant="outline" className="border-emerald-200 text-xs text-emerald-600">Active</Badge>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {isLog && (
                        <tfoot>
                            <tr className="border-t border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                                <td className="px-3 py-2" colSpan={3}>Total</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {pieces.reduce((s, p) => s + num(p.volume_bd_ft), 0).toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {pieces.reduce((s, p) => s + num(p.volume_cu_m), 0).toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {peso(pieces.reduce((s, p) => s + num(p.estimated_value), 0))}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </section>
    );
}

/* ───────────── Page ───────────── */

export default function JevShow({ asset, jev, can }: Props) {
    const form = useForm({
        jev_number: '',
        jev_date: '',
        particulars: '',
        amount: '',
    });
    const [justIssued, setJustIssued] = useState(false);

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        form.post(route('assets.jev.store', asset.id), {
            preserveScroll: true,
            onSuccess: () => setJustIssued(true),
        });
    };

    const errorCount = Object.keys(form.errors).length;
    const missingRequired = !form.data.jev_number.trim() || !form.data.jev_date.trim();

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Link href={route('jev.index')} className="text-sm text-gray-500 hover:text-gray-700">
                        ← JEV
                    </Link>
                    <span className="text-gray-400">/</span>
                    <h2 className="text-xl font-semibold text-gray-800">Journal Entry Voucher (IN)</h2>
                    <StatusPill issued={!!jev} />
                </div>
            }
        >
            <Head title={`JEV IN — ${asset.asset_code}`} />

            <div className="py-8">
                <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <AssetSummary asset={asset} />

                    {/* Awaiting issuance: form */}
                    {!jev && can.issue_jev && (
                        <section className="rounded-lg border-2 border-amber-300 bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-md bg-amber-50 px-5 py-3">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-800">Issue JEV IN</h3>
                                    <p className="text-xs text-amber-800">
                                        This asset is cleared for custodian and waiting for a JEV IN.
                                    </p>
                                </div>
                                <StatusPill issued={false} />
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4 p-5" noValidate>
                                {errorCount > 0 && (
                                    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                        {errorCount === 1 ? 'Please fix 1 problem below.' : `Please fix ${errorCount} problems below.`}
                                    </div>
                                )}

                                <p className="text-xs text-gray-500">
                                    Fields marked <span className="text-red-500">*</span> are required. Once issued, the JEV can’t be changed from this page.
                                </p>

                                <fieldset disabled={form.processing} className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <FieldLabel htmlFor="jev_number" required>JEV number</FieldLabel>
                                            <input
                                                id="jev_number"
                                                type="text"
                                                className={inputCls(!!form.errors.jev_number)}
                                                value={form.data.jev_number}
                                                onChange={(e) => form.setData('jev_number', e.target.value)}
                                                placeholder="e.g. JEV-2026-00001"
                                                aria-invalid={!!form.errors.jev_number}
                                                autoFocus
                                            />
                                            <InputError message={form.errors.jev_number} className="mt-1" />
                                        </div>

                                        <div>
                                            <FieldLabel htmlFor="jev_date" required>JEV date</FieldLabel>
                                            <input
                                                id="jev_date"
                                                type="date"
                                                className={inputCls(!!form.errors.jev_date)}
                                                value={form.data.jev_date}
                                                onChange={(e) => form.setData('jev_date', e.target.value)}
                                                aria-invalid={!!form.errors.jev_date}
                                            />
                                            <InputError message={form.errors.jev_date} className="mt-1" />
                                        </div>
                                    </div>

                                    <div>
                                        <FieldLabel htmlFor="particulars">Particulars</FieldLabel>
                                        <textarea
                                            id="particulars"
                                            rows={3}
                                            className={inputCls(!!form.errors.particulars)}
                                            value={form.data.particulars}
                                            onChange={(e) => form.setData('particulars', e.target.value)}
                                            aria-invalid={!!form.errors.particulars}
                                        />
                                        <InputError message={form.errors.particulars} className="mt-1" />
                                    </div>

                                    <div className="sm:max-w-xs">
                                        <FieldLabel htmlFor="amount">Amount (₱)</FieldLabel>
                                        <input
                                            id="amount"
                                            type="number"
                                            step="0.01"
                                            inputMode="decimal"
                                            className={inputCls(!!form.errors.amount)}
                                            value={form.data.amount}
                                            onChange={(e) => form.setData('amount', e.target.value)}
                                            aria-invalid={!!form.errors.amount}
                                        />
                                        <InputError message={form.errors.amount} className="mt-1" />
                                    </div>
                                </fieldset>

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                                    {missingRequired && !form.processing && (
                                        <span className="text-xs text-gray-400">Enter a JEV number and date to continue.</span>
                                    )}
                                    <PrimaryButton disabled={form.processing || missingRequired} className="justify-center">
                                        {form.processing ? 'Issuing…' : 'Issue JEV IN'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </section>
                    )}

                    {/* Awaiting issuance, no permission */}
                    {!jev && !can.issue_jev && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                            <p className="font-medium">Awaiting JEV IN</p>
                            <p className="mt-1 text-amber-700">No JEV has been issued for this asset yet. Accounting will issue it.</p>
                        </div>
                    )}

                    {/* Issued: read-only summary */}
                    {jev && (
                        <section className="overflow-hidden rounded-lg border-2 border-green-300 bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-green-50 px-5 py-3">
                                <div>
                                    <h3 className="text-base font-semibold text-green-900">JEV IN issued</h3>
                                    {justIssued && (
                                        <p role="status" className="text-xs text-green-700">JEV IN was issued successfully.</p>
                                    )}
                                </div>
                                <StatusPill issued />
                            </div>
                            <div className="p-5">
                                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                    <Item label="JEV number">
                                        <span className="font-mono font-semibold">{jev.jev_number ?? '—'}</span>
                                    </Item>
                                    <Item label="JEV date">{fmtDate(jev.jev_date)}</Item>
                                    <Item label="Amount">{peso(jev.amount)}</Item>
                                    <Item label="Issued on">{fmtDate(jev.created_at)}</Item>
                                    <div className="sm:col-span-2">
                                        <Item label="Particulars">
                                            <span className="whitespace-pre-wrap">{jev.particulars ?? '—'}</span>
                                        </Item>
                                    </div>
                                </dl>
                            </div>
                        </section>
                    )}

                    <PiecesTable asset={asset} />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}