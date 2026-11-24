import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/lib/utils';
import { Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect } from 'react';
import {
    AwaitingNotice,
    DetailItem,
    FieldLabel,
    JevAsset,
    JevInRecord,
    JevStatusBadge,
    PostOptions,
    Section,
    fmtDate,
    inputCls,
    num,
    peso,
    titleCase,
} from './shared';

/* ───────────── General details ───────────── */

export function AssetSummarySection({ asset, showAssetLink = true }: { asset: JevAsset; showAssetLink?: boolean }) {
    const incident = asset.incident;
    const refLabel = asset.aap_number ? 'AAP No.' : asset.stcp_number ? 'STCP No.' : 'AAP/STCP No.';
    const quantity = [asset.quantity, asset.quantity_unit]
        .filter((v) => v !== null && v !== undefined && v !== '')
        .join(' ');

    return (
        <Section
            title="Asset summary"
            aside={
                showAssetLink ? (
                    <Link href={route('assets.show', asset.id)} className="text-xs font-medium text-emerald-700 hover:underline">
                        View asset
                    </Link>
                ) : undefined
            }
        >
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                <DetailItem label="Asset code">
                    <span className="font-semibold">{asset.asset_code}</span>
                </DetailItem>
                <DetailItem label={refLabel}>{asset.aap_number ?? asset.stcp_number ?? '—'}</DetailItem>
                <DetailItem label="Type">
                    <span className="capitalize">{titleCase(asset.type)}</span>
                </DetailItem>
                <DetailItem label="Quantity">{quantity || '—'}</DetailItem>
                <DetailItem label="Municipality of origin">{asset.municipality_of_origin || '—'}</DetailItem>
                <DetailItem label="Location apprehended">{asset.location_apprehended || '—'}</DetailItem>
            </dl>

            {incident && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                    <h4 className="mb-3 text-xs font-semibold text-gray-500">Incident</h4>
                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                        <DetailItem label="Incident code">{incident.incident_code || '—'}</DetailItem>
                        <DetailItem label="Date of apprehension">{fmtDate(incident.date_of_apprehension)}</DetailItem>
                        <DetailItem label="Apprehending party">{incident.apprehending_party || '—'}</DetailItem>
                        <div className="sm:col-span-2 xl:col-span-3">
                            <DetailItem label="Place of apprehension">{incident.place_of_apprehension || '—'}</DetailItem>
                        </div>
                    </dl>
                </div>
            )}
        </Section>
    );
}

/* ───────────── Pieces ───────────── */

export function AssetPiecesSection({ asset, maxHeightClass = 'max-h-96' }: { asset: JevAsset; maxHeightClass?: string }) {
    const pieces = asset.pieces ?? [];
    if (pieces.length === 0) return null;

    const isLog = asset.type === 'log';
    const isVehicle = asset.type === 'vehicle';
    const isEquipment = asset.type === 'equipment';
    const disposedCount = pieces.filter((p) => p.disposed_at).length;

    const th =
        'sticky top-0 z-10 whitespace-nowrap bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500';
    const td = 'whitespace-nowrap px-3 py-2';

    return (
        <Section
            padded={false}
            title={
                <>
                    Asset pieces <span className="font-normal text-gray-400">({pieces.length})</span>
                </>
            }
            aside={
                <p className="text-xs text-gray-500">
                    {pieces.length - disposedCount} active · {disposedCount} disposed
                </p>
            }
        >
            {/* Scrolls inside the card (both directions) so the page never scrolls sideways. */}
            <div className={cn('overflow-auto', maxHeightClass)}>
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
                                        <Badge variant="red">Disposed</Badge>
                                    ) : (
                                        <Badge variant="green">Active</Badge>
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
        </Section>
    );
}

/* ───────────── Issuance ───────────── */

export function JevInIssueForm({
    assetId,
    compact = false,
    autoFocus = false,
    postOptions,
    onIssued,
    onProcessingChange,
}: {
    assetId: number;
    compact?: boolean;
    autoFocus?: boolean;
    postOptions?: PostOptions;
    onIssued?: () => void;
    onProcessingChange?: (processing: boolean) => void;
}) {
    const form = useForm({ jev_number: '', jev_date: '', particulars: '', amount: '' });

    // Let the parent block closing while the request is in flight.
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
        form.post(route('assets.jev.store', assetId), {
            preserveScroll: true,
            ...postOptions,
            onSuccess: () => onIssued?.(),
        });
    };

    const errorCount = Object.keys(form.errors).length;
    const missingRequired = !form.data.jev_number.trim() || !form.data.jev_date.trim();

    return (
        <form onSubmit={submit} className="space-y-4" noValidate>
            {errorCount > 0 && (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {errorCount === 1 ? 'Please fix 1 problem below.' : `Please fix ${errorCount} problems below.`}
                </div>
            )}

            <p className="text-xs text-gray-500">
                Fields marked <span className="text-red-500">*</span> are required. Once issued, the JEV can’t be changed.
            </p>

            <fieldset disabled={form.processing} className="space-y-4">
                <div className={cn('grid grid-cols-1 gap-4', !compact && 'sm:grid-cols-2')}>
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
                            autoFocus={autoFocus}
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

                <div className={compact ? undefined : 'sm:max-w-xs'}>
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
    );
}

export function JevInIssuedSummary({
    jev,
    compact = false,
    justIssued = false,
}: {
    jev: JevInRecord;
    compact?: boolean;
    justIssued?: boolean;
}) {
    return (
        <Section
            tone="issued"
            title="JEV IN issued"
            description={justIssued ? 'JEV IN was issued successfully.' : undefined}
            aside={<JevStatusBadge issued jevType="IN" />}
        >
            <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', !compact && 'sm:grid-cols-2')}>
                <DetailItem label="JEV number">
                    <span className="font-mono font-semibold">{jev.jev_number ?? '—'}</span>
                </DetailItem>
                <DetailItem label="JEV date">{fmtDate(jev.jev_date)}</DetailItem>
                <DetailItem label="Amount">{peso(jev.amount)}</DetailItem>
                <DetailItem label="Issued on">{fmtDate(jev.created_at)}</DetailItem>
                <div className={compact ? undefined : 'sm:col-span-2'}>
                    <DetailItem label="Particulars">
                        <span className="whitespace-pre-wrap">{jev.particulars ?? '—'}</span>
                    </DetailItem>
                </div>
            </dl>
        </Section>
    );
}

/** Picks the right block: issued summary, issue form (authorized), or read-only notice. */
export function JevInIssuanceSection({
    asset,
    jev,
    canIssue,
    compact,
    autoFocus,
    justIssued,
    postOptions,
    onIssued,
    onProcessingChange,
}: {
    asset: JevAsset;
    jev: JevInRecord | null;
    canIssue: boolean;
    compact?: boolean;
    autoFocus?: boolean;
    justIssued?: boolean;
    postOptions?: PostOptions;
    onIssued?: () => void;
    onProcessingChange?: (processing: boolean) => void;
}) {
    if (jev) return <JevInIssuedSummary jev={jev} compact={compact} justIssued={justIssued} />;

    if (canIssue) {
        return (
            <Section
                tone="pending"
                title="Issue JEV IN"
                description="This asset is cleared for custodian and waiting for a JEV IN."
                aside={<JevStatusBadge issued={false} jevType="IN" />}
            >
                <JevInIssueForm
                    assetId={asset.id}
                    compact={compact}
                    autoFocus={autoFocus}
                    postOptions={postOptions}
                    onIssued={onIssued}
                    onProcessingChange={onProcessingChange}
                />
            </Section>
        );
    }

    return <AwaitingNotice jevType="IN" what="asset" />;
}