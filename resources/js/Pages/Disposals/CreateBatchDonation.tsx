import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import CoordinatesPickerModal from '@/Components/shared/CoordinatesPickerModal';
import { IncidentLocationMap } from '@/Components/shared/IncidentLocationMap';
import { AlertCircle, Check, ChevronLeft, ChevronRight, MapPin, Plus, ScanLine, Trash2 } from 'lucide-react';
import AssetScanModal, { ScannedAsset } from '@/Components/shared/AssetScanModal';
import PiecePickerModal, { AssetPieceData } from '@/Components/shared/PiecePickerModal';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface Option {
    value: string;
    label: string;
}

interface DonatableAsset {
    id: number;
    asset_code: string;
    species: string | null;
    description: string | null;
    quantity: number;
    remaining_quantity: number;
    municipality_of_origin: string;
    incident?: { place_of_apprehension: string } | null;
    pieces: AssetPieceData[];
}

interface CreateBatchDonationProps {
    assets: DonatableAsset[];
    municipalities: Option[];
    barangaysByMunicipality: Record<string, string[]>;
}

interface DonationLine {
    asset_id: string;
    quantity: string;
    piece_ids?: number[];
}

type StepId = 'assets' | 'recipient' | 'details' | 'signatories' | 'review';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const ORG_TYPES = [
    { value: 'academe', label: 'Academe' },
    { value: 'national_agency', label: 'National Agency' },
    { value: 'lgu', label: 'LGU' },
    { value: 'individual', label: 'Individual' },
    { value: 'other', label: 'Other' },
];

const STEPS: StepId[] = ['assets', 'recipient', 'details', 'signatories', 'review'];

const STEP_META: Record<StepId, { label: string; title: string; description: string }> = {
    assets: {
        label: 'Assets',
        title: 'Select Assets',
        description: 'Choose one or more assets and select which pieces go to this recipient.',
    },
    recipient: {
        label: 'Recipient',
        title: 'Recipient Details',
        description: 'Who is receiving the donation and where they are located.',
    },
    details: {
        label: 'Donation',
        title: 'Donation Details',
        description: 'Why the donee needs the lumber and any related order reference.',
    },
    signatories: {
        label: 'Signatories',
        title: 'Signatories & Documents',
        description: 'Optional. Leave any blank to use the office default for the Deed of Donation.',
    },
    review: {
        label: 'Review',
        title: 'Review & Confirm',
        description: 'Check everything below. Recording a donation cannot be undone.',
    },
};

const FIELD_STEP: Record<string, StepId> = {
    organization_type: 'recipient',
    organization_type_other: 'recipient',
    agency_name: 'recipient',
    requester_name: 'recipient',
    municipality: 'recipient',
    barangay: 'recipient',
    street: 'recipient',
    delivery_coordinates: 'recipient',
    donee_position: 'details',
    purpose_statement: 'details',
    confiscation_order_reference: 'details',
    donor_representative_name: 'signatories',
    donor_representative_title: 'signatories',
    witness_1_name: 'signatories',
    witness_1_title: 'signatories',
    witness_2_name: 'signatories',
    witness_2_title: 'signatories',
    notes: 'review',
};

const selectCls = (error?: string) =>
    `mt-1 w-full rounded-md border px-3 py-2 text-sm ${error ? 'border-red-400' : 'border-gray-300'}`;
const inputCls = (error?: string) => (error ? 'border-red-400' : undefined);

function stepForErrorKey(key: string): StepId {
    if (key.startsWith('lines')) return 'assets';
    return FIELD_STEP[key] ?? 'review';
}

/* -------------------------------------------------------------------------- */
/* Small presentational pieces                                                */
/* -------------------------------------------------------------------------- */

function Field({
    id,
    label,
    optional,
    hint,
    error,
    children,
}: {
    id?: string;
    label: string;
    optional?: boolean;
    hint?: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div>
            <Label htmlFor={id}>
                {label}
                {optional && <span className="font-normal text-gray-400"> (optional)</span>}
            </Label>
            {children}
            {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
            <InputError message={error} className="mt-1" />
        </div>
    );
}

function StepIndicator({
    steps,
    current,
    onJump,
}: {
    steps: { id: StepId; label: string }[];
    current: number;
    onJump: (index: number) => void;
}) {
    const pct = ((current + 1) / steps.length) * 100;

    return (
        <nav aria-label="Progress" className="mb-6">
            {/* Mobile: compact progress bar */}
            <div className="sm:hidden">
                <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-gray-900">{steps[current].label}</span>
                    <span className="text-xs text-gray-500">
                        Step {current + 1} of {steps.length}
                    </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
                </div>
            </div>

            {/* Desktop: full stepper */}
            <ol className="hidden items-center sm:flex">
                {steps.map((s, i) => {
                    const done = i < current;
                    const active = i === current;
                    return (
                        <li key={s.id} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
                            <button
                                type="button"
                                disabled={!done}
                                onClick={() => onJump(i)}
                                aria-current={active ? 'step' : undefined}
                                className="flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-default"
                            >
                                <span
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                                        done
                                            ? 'border-emerald-600 bg-emerald-600 text-white'
                                            : active
                                              ? 'border-emerald-600 bg-white text-emerald-700'
                                              : 'border-gray-300 bg-white text-gray-400'
                                    }`}
                                >
                                    {done ? <Check className="h-4 w-4" /> : i + 1}
                                </span>
                                <span
                                    className={`text-sm font-medium ${
                                        active ? 'text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'
                                    }`}
                                >
                                    {s.label}
                                </span>
                            </button>
                            {i < steps.length - 1 && (
                                <span className={`mx-3 h-0.5 flex-1 ${done ? 'bg-emerald-600' : 'bg-gray-200'}`} />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit?: () => void; children: ReactNode }) {
    return (
        <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
                {onEdit && (
                    <button
                        type="button"
                        onClick={onEdit}
                        className="rounded text-xs font-medium text-emerald-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                        Edit
                    </button>
                )}
            </div>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value?: ReactNode }) {
    const empty = value === undefined || value === null || value === '';
    return (
        <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-4">
            <span className="text-gray-500 sm:w-48 sm:shrink-0">{label}</span>
            <span className={`min-w-0 break-words ${empty ? 'text-gray-400' : 'text-gray-900'}`}>{empty ? '—' : value}</span>
        </div>
    );
}

function PieceBadges({ numbers, total }: { numbers: number[]; total: number }) {
    if (!numbers.length) return null;
    return (
        <div className="mt-2 flex flex-wrap gap-1">
            {numbers.map((n) => (
                <span
                    key={n}
                    className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"
                >
                    Piece {n}/{total}
                </span>
            ))}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function CreateBatchDonation({
    assets,
    municipalities,
    barangaysByMunicipality,
}: CreateBatchDonationProps) {
    const [scanning, setScanning] = useState(false);
    const [piecePickerLine, setPiecePickerLine] = useState<number | null>(null);
    const [extraAssets, setExtraAssets] = useState<DonatableAsset[]>([]);
    const [showCoordinatesPicker, setShowCoordinatesPicker] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [showErrors, setShowErrors] = useState(false);
    const [attempt, setAttempt] = useState(0);

    const topRef = useRef<HTMLDivElement>(null);
    const alertRef = useRef<HTMLDivElement>(null);
    const firstRender = useRef(true);

    const allAssets = useMemo(
        () => [...assets, ...extraAssets.filter((ea) => !assets.some((a) => a.id === ea.id))],
        [assets, extraAssets],
    );

    const assetsById = useMemo(() => new Map(allAssets.map((a) => [String(a.id), a])), [allAssets]);

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        lines: [{ asset_id: '', quantity: '', piece_ids: undefined as number[] | undefined }] as DonationLine[],
        requester_name: '',
        donee_position: '',
        purpose_statement: '',
        confiscation_order_reference: '',
        organization_type: 'individual',
        organization_type_other: '',
        agency_name: '',
        municipality: municipalities[0]?.value ?? '',
        barangay: '',
        street: '',
        delivery_coordinates: '',
        donor_representative_name: '',
        donor_representative_title: '',
        witness_1_name: '',
        witness_1_title: '',
        witness_2_name: '',
        witness_2_title: '',
        notes: '',
    });

    /* ---------------------------- derived state ---------------------------- */

    const serverErrors = errors as Record<string, string>;
    const safeIndex = Math.min(stepIndex, STEPS.length - 1);
    const currentStepId = STEPS[safeIndex];
    const isLast = currentStepId === 'review';
    const stepList = STEPS.map((id) => ({ id, label: STEP_META[id].label }));
    const meta = STEP_META[currentStepId];

    /* ------------------------------ validation ----------------------------- */

    function qtyError(value: string, limit: number, hasPieces: boolean): string | undefined {
        const n = Number(value);
        if (!value || !Number.isInteger(n) || n < 1) {
            return hasPieces ? 'Select at least one piece.' : 'Enter a whole number of at least 1.';
        }
        if (n > limit) return `Only ${limit} unit(s) available.`;
        return undefined;
    }

    function validateStep(id: StepId): Record<string, string> {
        const e: Record<string, string> = {};
        const req = (key: string, value: string, msg: string) => {
            if (!String(value ?? '').trim()) e[key] = msg;
        };
        const max = (key: string, value: string, n: number) => {
            if (!e[key] && String(value ?? '').length > n) e[key] = `Must be ${n} characters or fewer.`;
        };

        switch (id) {
            case 'assets':
                data.lines.forEach((line, i) => {
                    const a = assetsById.get(line.asset_id);
                    if (!line.asset_id || !a) {
                        e[`lines.${i}.asset_id`] = 'Select an asset.';
                        return;
                    }
                    const msg = qtyError(line.quantity, a.remaining_quantity, (a.pieces?.length ?? 0) > 0);
                    if (msg) e[`lines.${i}.quantity`] = msg;
                });
                break;

            case 'recipient':
                req('organization_type', data.organization_type, 'Select an organization type.');
                if (data.organization_type === 'other') {
                    req('organization_type_other', data.organization_type_other, 'Specify the organization type.');
                }
                req('agency_name', data.agency_name, 'Enter the donee office or institution name.');
                req('requester_name', data.requester_name, 'Enter the representative name.');
                req('municipality', data.municipality, 'Select a municipality.');
                req('barangay', data.barangay, 'Select a barangay.');
                if (!e.barangay && !(barangaysByMunicipality[data.municipality] ?? []).includes(data.barangay)) {
                    e.barangay = 'The selected barangay is not valid for the chosen municipality.';
                }
                max('organization_type_other', data.organization_type_other, 255);
                max('agency_name', data.agency_name, 255);
                max('requester_name', data.requester_name, 255);
                max('street', data.street, 255);
                max('delivery_coordinates', data.delivery_coordinates, 255);
                break;

            case 'details':
                req('donee_position', data.donee_position, "Enter the representative's position.");
                req('purpose_statement', data.purpose_statement, 'Describe why the donee needs the lumber.');
                max('donee_position', data.donee_position, 255);
                max('purpose_statement', data.purpose_statement, 2000);
                max('confiscation_order_reference', data.confiscation_order_reference, 255);
                break;

            case 'signatories':
                (
                    [
                        'donor_representative_name',
                        'donor_representative_title',
                        'witness_1_name',
                        'witness_1_title',
                        'witness_2_name',
                        'witness_2_title',
                    ] as const
                ).forEach((k) => max(k, data[k], 255));
                break;

            case 'review':
                max('notes', data.notes, 1000);
                break;
        }
        return e;
    }

    const stepErrors = validateStep(currentStepId);
    const errorCount = showErrors ? Object.keys(stepErrors).length : 0;
    const stepServerErrorCount = Object.keys(serverErrors).filter((k) => stepForErrorKey(k) === currentStepId).length;

    function fieldError(key: string): string | undefined {
        return (showErrors ? stepErrors[key] : undefined) ?? serverErrors[key];
    }

    /* ------------------------------ effects -------------------------------- */

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [stepIndex]);

    useEffect(() => {
        if (attempt > 0) alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [attempt]);

    /* ------------------------------ form helpers --------------------------- */

    function setField(key: keyof typeof data, value: any) {
        (setData as any)(key, value);
        if (serverErrors[key as string]) clearErrors(key as any);
    }

    function handleMunicipalityChange(value: string) {
        setData((prev) => ({ ...prev, municipality: value, barangay: '' }));
        clearErrors('municipality', 'barangay');
    }

    function updateLine(index: number, field: 'asset_id' | 'quantity', value: string) {
        const next = [...data.lines];
        if (field === 'asset_id') {
            next[index] = { asset_id: value, quantity: '', piece_ids: undefined };
        } else {
            next[index] = { ...next[index], quantity: value, piece_ids: undefined };
        }
        setData('lines', next);
        clearErrors(`lines.${index}.${field}` as any);
    }

    function addLine() {
        setData('lines', [...data.lines, { asset_id: '', quantity: '', piece_ids: undefined }]);
    }

    function removeLine(index: number) {
        if (data.lines.length === 1) return;
        setData('lines', data.lines.filter((_, i) => i !== index));
    }

    function availableOptionsFor(currentIndex: number): DonatableAsset[] {
        const chosenElsewhere = new Set(
            data.lines
                .filter((_, i) => i !== currentIndex)
                .map((l) => l.asset_id)
                .filter(Boolean),
        );
        return allAssets.filter((a) => !chosenElsewhere.has(String(a.id)));
    }

    function selectedPieceNumbers(line: DonationLine, selectedAsset: DonatableAsset): number[] {
        if (!line.piece_ids?.length) return [];
        return (selectedAsset.pieces ?? [])
            .filter((p) => line.piece_ids!.includes(p.id))
            .map((p) => p.piece_number)
            .sort((a, b) => a - b);
    }

    function handleAssetScanned(scanned: ScannedAsset) {
        setExtraAssets((prev) =>
            prev.some((a) => a.id === scanned.id) ? prev : [...prev, { pieces: [], ...(scanned as any) } as DonatableAsset],
        );

        setData((prevData) => {
            const pieceId = scanned.piece_id ?? null;
            const existingIndex = prevData.lines.findIndex((l) => l.asset_id === String(scanned.id));

            if (existingIndex !== -1) {
                const nextLines = [...prevData.lines];
                const existing = nextLines[existingIndex];
                const existingIds = existing.piece_ids ?? [];

                if (pieceId !== null && existingIds.includes(pieceId)) return prevData;

                const nextIds = pieceId !== null ? [...existingIds, pieceId] : existingIds;
                nextLines[existingIndex] = {
                    ...existing,
                    quantity: pieceId !== null ? String(nextIds.length) : existing.quantity,
                    piece_ids: nextIds.length ? nextIds : undefined,
                };
                return { ...prevData, lines: nextLines };
            }

            const emptyIndex = prevData.lines.findIndex((l) => !l.asset_id);
            const newLine: DonationLine = {
                asset_id: String(scanned.id),
                quantity: '1',
                piece_ids: pieceId !== null ? [pieceId] : undefined,
            };

            const nextLines = [...prevData.lines];
            if (emptyIndex !== -1) {
                nextLines[emptyIndex] = newLine;
            } else {
                nextLines.push(newLine);
            }
            return { ...prevData, lines: nextLines };
        });

        clearErrors();
        setScanning(false);
    }

    /* ------------------------------ navigation ----------------------------- */

    function goToStep(id: StepId) {
        const i = STEPS.indexOf(id);
        if (i >= 0) {
            setShowErrors(false);
            setStepIndex(i);
        }
    }

    function goNext() {
        if (Object.keys(stepErrors).length > 0) {
            setShowErrors(true);
            setAttempt((a) => a + 1);
            return;
        }
        setShowErrors(false);
        setStepIndex(Math.min(safeIndex + 1, STEPS.length - 1));
    }

    function goBack() {
        setShowErrors(false);
        setStepIndex(Math.max(safeIndex - 1, 0));
    }

    function handleServerErrors(errs: Record<string, string>) {
        const idxs = Object.keys(errs)
            .map((k) => STEPS.indexOf(stepForErrorKey(k)))
            .filter((i) => i >= 0);
        setShowErrors(false);
        setStepIndex(idxs.length ? Math.min(...idxs) : STEPS.length - 1);
        setAttempt((a) => a + 1);
    }

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        // Enter key on an earlier step moves forward instead of submitting.
        if (!isLast) {
            goNext();
            return;
        }

        // Re-check every step so nothing slips through.
        for (let i = 0; i < STEPS.length; i++) {
            if (Object.keys(validateStep(STEPS[i])).length > 0) {
                setStepIndex(i);
                setShowErrors(true);
                setAttempt((a) => a + 1);
                return;
            }
        }

        const lineSummaries = data.lines
            .map((line) => {
                const asset = assetsById.get(line.asset_id);
                return asset ? `${line.quantity || '?'} pc(s) of ${asset.asset_code}` : null;
            })
            .filter(Boolean)
            .join(', ');

        if (confirm(`Confirm donation of ${lineSummaries} to ${data.requester_name || 'this recipient'}? This cannot be undone.`)) {
            post(route('disposals.donate.store'), { onError: handleServerErrors });
        }
    };

    /* ---------------------------- step renderers --------------------------- */

    function renderAssetsStep() {
        return (
            <>
                {data.lines.map((line, index) => {
                    const selectedAsset = assetsById.get(line.asset_id);
                    const options = availableOptionsFor(index);
                    const hasPieces = (selectedAsset?.pieces?.length ?? 0) > 0;
                    const pieceNums = selectedAsset ? selectedPieceNumbers(line, selectedAsset) : [];
                    const remainingAfter = selectedAsset ? selectedAsset.remaining_quantity - Number(line.quantity) : 0;
                    const assetErrKey = `lines.${index}.asset_id`;
                    const qtyErrKey = `lines.${index}.quantity`;

                    return (
                        <div key={index} className="rounded-lg border border-gray-200 p-4">
                            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                                {/* Asset selector */}
                                <div>
                                    <Label htmlFor={`asset-${index}`}>Asset</Label>
                                    <select
                                        id={`asset-${index}`}
                                        value={line.asset_id}
                                        onChange={(e) => updateLine(index, 'asset_id', e.target.value)}
                                        className={selectCls(fieldError(assetErrKey))}
                                    >
                                        <option value="" disabled>
                                            Select an asset…
                                        </option>
                                        {options.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.asset_code}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={fieldError(assetErrKey)} className="mt-1" />
                                </div>

                                {/* Piece picker button OR quantity fallback */}
                                <div className="min-w-[150px]">
                                    <Label>Pieces</Label>
                                    {hasPieces ? (
                                        <button
                                            type="button"
                                            onClick={() => selectedAsset && setPiecePickerLine(index)}
                                            disabled={!selectedAsset}
                                            className={`mt-1 flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 ${
                                                fieldError(qtyErrKey) ? 'border-red-400' : 'border-gray-300'
                                            }`}
                                        >
                                            <span className={line.piece_ids?.length ? 'text-gray-900' : 'text-gray-400'}>
                                                {line.piece_ids?.length
                                                    ? `${line.piece_ids.length} piece${line.piece_ids.length !== 1 ? 's' : ''} selected`
                                                    : Number(line.quantity) > 0
                                                      ? `${line.quantity} piece(s)`
                                                      : 'Select pieces…'}
                                            </span>
                                            <ChevronRight className="h-4 w-4 text-gray-400" />
                                        </button>
                                    ) : (
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            max={selectedAsset?.remaining_quantity}
                                            value={line.quantity}
                                            onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                            disabled={!selectedAsset}
                                            placeholder={!selectedAsset ? 'Select an asset first' : ''}
                                            className={inputCls(fieldError(qtyErrKey))}
                                        />
                                    )}
                                    <InputError message={fieldError(qtyErrKey)} className="mt-1" />
                                </div>

                                {/* Remove */}
                                {data.lines.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-label="Remove asset"
                                        className="mb-0.5 self-end"
                                        onClick={() => removeLine(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>

                            {/* Selected piece badges */}
                            {selectedAsset && <PieceBadges numbers={pieceNums} total={selectedAsset.quantity} />}

                            {/* Remainder warning */}
                            {selectedAsset && Number(line.quantity) > 0 && remainingAfter > 0 && (
                                <p className="mt-2 text-xs text-amber-700">
                                    The remaining {remainingAfter} pc(s) of {selectedAsset.asset_code} will stay available for future
                                    disposal.
                                </p>
                            )}
                        </div>
                    );
                })}

                <div className="flex flex-wrap gap-2">
                    {data.lines.length < allAssets.length && (
                        <Button type="button" variant="outline" size="sm" onClick={addLine}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add Another Asset
                        </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setScanning(true)}>
                        <ScanLine className="mr-1.5 h-3.5 w-3.5" />
                        Scan QR Code
                    </Button>
                </div>
            </>
        );
    }

    function renderRecipientStep() {
        return (
            <>
                <Field id="organization_type" label="Organization Type" error={fieldError('organization_type')}>
                    <select
                        id="organization_type"
                        value={data.organization_type}
                        onChange={(e) => setField('organization_type', e.target.value)}
                        className={selectCls(fieldError('organization_type'))}
                    >
                        {ORG_TYPES.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </Field>

                {data.organization_type === 'other' && (
                    <Field id="organization_type_other" label="Specify Type" error={fieldError('organization_type_other')}>
                        <Input
                            id="organization_type_other"
                            value={data.organization_type_other}
                            onChange={(e) => setField('organization_type_other', e.target.value)}
                            className={inputCls(fieldError('organization_type_other'))}
                        />
                    </Field>
                )}

                <Field
                    id="agency_name"
                    label="Donee Office / Institution Name"
                    error={fieldError('agency_name')}
                    hint={'Printed in the Deed of Donation\'s signature block (the "DONEE OFFICE" heading).'}
                >
                    <Input
                        id="agency_name"
                        placeholder="Agency / Institution Name"
                        value={data.agency_name}
                        onChange={(e) => setField('agency_name', e.target.value)}
                        className={inputCls(fieldError('agency_name'))}
                    />
                </Field>

                <Field id="requester_name" label="Representative Name" error={fieldError('requester_name')}>
                    <Input
                        id="requester_name"
                        value={data.requester_name}
                        onChange={(e) => setField('requester_name', e.target.value)}
                        className={inputCls(fieldError('requester_name'))}
                    />
                </Field>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Donee Address</p>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="municipality">Municipality</Label>
                            <select
                                id="municipality"
                                value={data.municipality}
                                onChange={(e) => handleMunicipalityChange(e.target.value)}
                                className={selectCls(fieldError('municipality'))}
                            >
                                {municipalities.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                            <InputError message={fieldError('municipality')} className="mt-1" />
                        </div>
                        <div>
                            <Label htmlFor="barangay">Barangay</Label>
                            <select
                                id="barangay"
                                value={data.barangay}
                                onChange={(e) => setField('barangay', e.target.value)}
                                className={selectCls(fieldError('barangay'))}
                            >
                                <option value="" disabled>
                                    Select barangay…
                                </option>
                                {(barangaysByMunicipality[data.municipality] ?? []).map((brgy) => (
                                    <option key={brgy} value={brgy}>
                                        {brgy}
                                    </option>
                                ))}
                            </select>
                            <InputError message={fieldError('barangay')} className="mt-1" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <Label htmlFor="street">
                            Street / House No. <span className="font-normal text-gray-400">(optional)</span>
                        </Label>
                        <Input
                            id="street"
                            placeholder="e.g. Purok 3, Zone 2"
                            value={data.street}
                            onChange={(e) => setField('street', e.target.value)}
                            className={inputCls(fieldError('street'))}
                        />
                        <InputError message={fieldError('street')} className="mt-1" />
                    </div>
                </div>

                <div>
                    <Label htmlFor="delivery_coordinates">
                        Delivery Location <span className="font-normal text-gray-400">(optional)</span>
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            id="delivery_coordinates"
                            placeholder="e.g. 13.5833, 124.2333"
                            value={data.delivery_coordinates}
                            onChange={(e) => setField('delivery_coordinates', e.target.value)}
                            className={inputCls(fieldError('delivery_coordinates'))}
                        />
                        <Button type="button" variant="outline" onClick={() => setShowCoordinatesPicker(true)}>
                            <MapPin className="mr-1.5 h-4 w-4" />
                            Pick on Map
                        </Button>
                    </div>
                    <InputError message={fieldError('delivery_coordinates')} className="mt-1" />

                    {data.delivery_coordinates && (
                        <div className="mt-3">
                            <IncidentLocationMap
                                coordinates={data.delivery_coordinates}
                                placeName={data.requester_name || 'Donation delivery point'}
                            />
                        </div>
                    )}
                </div>
            </>
        );
    }

    function renderDetailsStep() {
        return (
            <>
                <Field
                    id="donee_position"
                    label="Representative's Position / Title"
                    error={fieldError('donee_position')}
                    hint={'Printed on the Deed of Donation, e.g. "represented by [name], [position]".'}
                >
                    <Input
                        id="donee_position"
                        placeholder="Donee Position"
                        value={data.donee_position}
                        onChange={(e) => setField('donee_position', e.target.value)}
                        className={inputCls(fieldError('donee_position'))}
                    />
                </Field>

                <Field
                    id="purpose_statement"
                    label="Purpose / Need Statement"
                    error={fieldError('purpose_statement')}
                    hint="Describes why the donee needs the lumber. Appears in the Deed's WITNESSETH clause."
                >
                    <Input
                        id="purpose_statement"
                        placeholder="e.g. for the improvement and renovation of the office space"
                        value={data.purpose_statement}
                        onChange={(e) => setField('purpose_statement', e.target.value)}
                        className={inputCls(fieldError('purpose_statement'))}
                    />
                </Field>

                <Field
                    id="confiscation_order_reference"
                    label="Confiscation Order Reference"
                    optional
                    error={fieldError('confiscation_order_reference')}
                >
                    <Input
                        id="confiscation_order_reference"
                        value={data.confiscation_order_reference}
                        onChange={(e) => setField('confiscation_order_reference', e.target.value)}
                        className={inputCls(fieldError('confiscation_order_reference'))}
                    />
                </Field>
            </>
        );
    }

    function renderSignatoriesStep() {
        const pair = (
            nameKey: 'donor_representative_name' | 'witness_1_name' | 'witness_2_name',
            titleKey: 'donor_representative_title' | 'witness_1_title' | 'witness_2_title',
            nameLabel: string,
            titleLabel: string,
            namePh: string,
            titlePh: string,
        ) => (
            <div className="grid gap-4 md:grid-cols-2">
                <Field id={nameKey} label={nameLabel} error={fieldError(nameKey)}>
                    <Input
                        id={nameKey}
                        placeholder={namePh}
                        value={data[nameKey]}
                        onChange={(e) => setField(nameKey, e.target.value)}
                        className={inputCls(fieldError(nameKey))}
                    />
                </Field>
                <Field id={titleKey} label={titleLabel} error={fieldError(titleKey)}>
                    <Input
                        id={titleKey}
                        placeholder={titlePh}
                        value={data[titleKey]}
                        onChange={(e) => setField(titleKey, e.target.value)}
                        className={inputCls(fieldError(titleKey))}
                    />
                </Field>
            </div>
        );

        return (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Deed of Donation Signatories</p>
                {pair(
                    'donor_representative_name',
                    'donor_representative_title',
                    'OIC / PENR Officer Name',
                    'OIC / PENR Officer Title',
                    'Donor Representative Name',
                    'Donor Representative Title',
                )}
                {pair('witness_1_name', 'witness_1_title', 'Witness 1 Name', 'Witness 1 Title', 'Witness 1 Name', 'Witness 1 Title')}
                {pair('witness_2_name', 'witness_2_title', 'Witness 2 Name', 'Witness 2 Title', 'Witness 2 Name', 'Witness 2 Title')}
            </div>
        );
    }

    function renderReviewStep() {
        const allServerMessages = Object.values(serverErrors);
        const totalPieces = data.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

        return (
            <>
                {allServerMessages.length > 0 && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <p className="font-medium">The server could not process this donation:</p>
                        <ul className="mt-1 list-disc pl-5">
                            {allServerMessages.map((m, i) => (
                                <li key={i}>{m}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <ReviewSection title="Assets" onEdit={() => goToStep('assets')}>
                    {data.lines.map((line, i) => {
                        const a = assetsById.get(line.asset_id);
                        if (!a) return null;
                        const nums = selectedPieceNumbers(line, a);
                        const left = a.remaining_quantity - Number(line.quantity);
                        return (
                            <div key={i} className="rounded-md bg-gray-50 p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium text-gray-900">{a.asset_code}</span>
                                    <span className="text-gray-700">{line.quantity} pc(s)</span>
                                </div>
                                <PieceBadges numbers={nums} total={a.quantity} />
                                {left > 0 && (
                                    <p className="mt-2 text-xs text-amber-700">
                                        The remaining {left} pc(s) will stay available for future disposal.
                                    </p>
                                )}
                            </div>
                        );
                    })}
                    <p className="pt-1 text-xs text-gray-500">
                        {data.lines.length} asset(s), {totalPieces} piece(s) in total.
                    </p>
                </ReviewSection>

                <ReviewSection title="Recipient" onEdit={() => goToStep('recipient')}>
                    <ReviewRow
                        label="Organization type"
                        value={
                            data.organization_type === 'other'
                                ? `Other: ${data.organization_type_other}`
                                : ORG_TYPES.find((o) => o.value === data.organization_type)?.label
                        }
                    />
                    <ReviewRow label="Donee office / institution" value={data.agency_name} />
                    <ReviewRow label="Representative" value={data.requester_name} />
                    <ReviewRow
                        label="Address"
                        value={[data.street, data.barangay, data.municipality].filter(Boolean).join(', ')}
                    />
                    <ReviewRow label="Delivery coordinates" value={data.delivery_coordinates} />
                </ReviewSection>

                <ReviewSection title="Donation details" onEdit={() => goToStep('details')}>
                    <ReviewRow label="Position / title" value={data.donee_position} />
                    <ReviewRow label="Purpose" value={data.purpose_statement} />
                    <ReviewRow label="Confiscation order ref." value={data.confiscation_order_reference} />
                </ReviewSection>

                <ReviewSection title="Signatories" onEdit={() => goToStep('signatories')}>
                    {(
                        [
                            ['OIC / PENR Officer', data.donor_representative_name, data.donor_representative_title],
                            ['Witness 1', data.witness_1_name, data.witness_1_title],
                            ['Witness 2', data.witness_2_name, data.witness_2_title],
                        ] as const
                    ).map(([label, name, title]) => (
                        <ReviewRow
                            key={label}
                            label={label}
                            value={name || title ? [name, title].filter(Boolean).join(', ') : 'Office default'}
                        />
                    ))}
                </ReviewSection>

                <Field id="notes" label="Notes" optional error={fieldError('notes')}>
                    <Input
                        id="notes"
                        value={data.notes}
                        onChange={(e) => setField('notes', e.target.value)}
                        className={inputCls(fieldError('notes'))}
                    />
                </Field>

                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Confirming will record this donation. This cannot be undone.
                </div>
            </>
        );
    }

    function renderStep() {
        switch (currentStepId) {
            case 'assets':
                return renderAssetsStep();
            case 'recipient':
                return renderRecipientStep();
            case 'details':
                return renderDetailsStep();
            case 'signatories':
                return renderSignatoriesStep();
            case 'review':
                return renderReviewStep();
        }
    }

    /* ------------------------------- piece picker -------------------------- */

    const pickerLine = piecePickerLine !== null ? data.lines[piecePickerLine] : null;
    const pickerAsset = pickerLine ? assetsById.get(pickerLine.asset_id) : null;

    /* --------------------------------- render ------------------------------ */

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Donate Assets</h2>}>
            <Head title="Donate Assets" />

            <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-4 px-4 sm:px-6 lg:px-8">
                {assets.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-sm text-gray-500">
                            No log assets are currently available for donation.
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <StepIndicator
                            steps={stepList}
                            current={safeIndex}
                            onJump={(i) => {
                                setShowErrors(false);
                                setStepIndex(i);
                            }}
                        />

                        <form onSubmit={submit} noValidate className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">{meta.title}</CardTitle>
                                    <p className="text-sm text-gray-600">{meta.description}</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(errorCount > 0 || stepServerErrorCount > 0) && (
                                        <div
                                            ref={alertRef}
                                            role="alert"
                                            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                                        >
                                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                            <span>
                                                {errorCount > 0
                                                    ? `Fix the ${errorCount} highlighted field${errorCount !== 1 ? 's' : ''} to continue.`
                                                    : 'Some details were rejected. Review the highlighted fields.'}
                                            </span>
                                        </div>
                                    )}

                                    {renderStep()}
                                </CardContent>
                            </Card>

                            <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex gap-3">
                                    {safeIndex > 0 && (
                                        <Button key="back" type="button" variant="outline" onClick={goBack}>
                                            <ChevronLeft className="mr-1 h-4 w-4" />
                                            Back
                                        </Button>
                                    )}
                                    <Link href={route('disposals.index')}>
                                        <Button type="button" variant="outline">
                                            Cancel
                                        </Button>
                                    </Link>
                                </div>

                                {isLast ? (
                                    <Button key="submit" type="submit" disabled={processing}>
                                        Confirm Donation
                                    </Button>
                                ) : (
                                    <Button key="next" type="button" onClick={goNext}>
                                        Next
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </form>
                    </>
                )}
            </div>

            <CoordinatesPickerModal
                show={showCoordinatesPicker}
                onClose={() => setShowCoordinatesPicker(false)}
                onSelect={(coords) => setField('delivery_coordinates', coords)}
                initialCoordinates={data.delivery_coordinates}
            />
            <AssetScanModal show={scanning} onClose={() => setScanning(false)} onFound={handleAssetScanned} />
            {piecePickerLine !== null && pickerAsset && pickerLine && (
                <PiecePickerModal
                    show
                    assetCode={pickerAsset.asset_code}
                    totalPieces={pickerAsset.quantity}
                    pieces={pickerAsset.pieces}
                    selectedIds={pickerLine.piece_ids ?? []}
                    onClose={() => setPiecePickerLine(null)}
                    onConfirm={(ids) => {
                        const idx = piecePickerLine;
                        setData((prev) => {
                            const next = [...prev.lines];
                            next[idx] = { ...next[idx], piece_ids: ids, quantity: String(ids.length) };
                            return { ...prev, lines: next };
                        });
                        clearErrors(`lines.${idx}.quantity` as any);
                        setPiecePickerLine(null);
                    }}
                />
            )}
        </AuthenticatedLayout>
    );
}