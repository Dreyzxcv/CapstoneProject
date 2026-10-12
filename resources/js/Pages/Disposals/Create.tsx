import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Asset } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, ReactNode, useEffect, useRef, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, ScanLine, Plus } from 'lucide-react';
import AssetScanModal, { ScannedAsset } from '@/Components/shared/AssetScanModal';
import PiecePickerModal, { AssetPieceData } from '@/Components/shared/PiecePickerModal';

// ── Types ────────────────────────────────────────────────────────────────────

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
    pieces: AssetPieceData[];
}

interface DisposalsCreateProps {
    asset: Asset;
    disposalTypes: Option[];
    municipalities: Option[];
    barangaysByMunicipality: Record<string, string[]>;
    availableAssets: DonatableAsset[];
}

interface DonationLine {
    asset_id: string;
    quantity: string;
    piece_ids?: number[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const selectClass =
    'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

const ORG_TYPES = [
    { value: 'academe', label: 'Academe' },
    { value: 'national_agency', label: 'National Agency' },
    { value: 'lgu', label: 'LGU' },
    { value: 'other', label: 'Other' },
];

// Donation flow: 5 steps
const DONATION_STEPS = [
    { id: 1, label: 'Assets', description: "What's being donated" },
    { id: 2, label: 'Recipient', description: 'Who receives it' },
    { id: 3, label: 'Delivery', description: 'Donee address' },
    { id: 4, label: 'Signatories', description: 'Deed signers' },
    { id: 5, label: 'Review', description: 'Confirm donation' },
];


// Non-donation flow: 2 steps
const OTHER_STEPS = [
    { id: 1, label: 'Details', description: 'Disposal details' },
    { id: 2, label: 'Review', description: 'Confirm disposal' },
];

const HIGHLIGHT_CSS = `
@keyframes nfPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.45); }
    50%      { box-shadow: 0 0 0 6px rgba(5, 150, 105, 0); }
}
.nf-highlight {
    border-color: #059669 !important;
    animation: nfPulse 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
    .nf-highlight { animation: none; box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.35); }
}
`;

function stepForErrorKey(key: string, isDonation: boolean): number {
    if (!isDonation) return 1;
    if (key.startsWith('lines')) return 1;
    if (['organization_type', 'organization_type_other', 'agency_name', 'requester_name', 'donee_position', 'purpose_statement', 'confiscation_order_reference'].includes(key)) return 2;
    if (['municipality', 'barangay', 'street'].includes(key)) return 3;
    return 4;
}

// ── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: typeof DONATION_STEPS }) {
    return (
        <div className="w-full">
            {/* Mobile */}
            <div className="mb-3 flex items-center justify-between px-1 sm:hidden">
                <span className="text-sm font-semibold text-emerald-700">
                    Step {current} of {steps.length}
                </span>
                <span className="text-sm text-gray-500">{steps[current - 1]?.label}</span>
            </div>
            <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 sm:hidden">
                <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${((current - 1) / (steps.length - 1)) * 100}%` }}
                />
            </div>

            {/* Desktop */}
            <nav className="mb-8 hidden items-center sm:flex" aria-label="Form steps">
                {steps.map((step, idx) => {
                    const done = current > step.id;
                    const active = current === step.id;
                    const upcoming = current < step.id;

                    return (
                        <div key={step.id} className="flex flex-1 items-center last:flex-none">
                            <div className="flex w-24 flex-col items-center gap-1">
                                <div
                                    className={[
                                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                                        done ? 'border-emerald-600 bg-emerald-600 text-white' : '',
                                        active ? 'border-emerald-600 bg-white text-emerald-700' : '',
                                        upcoming ? 'border-gray-300 bg-white text-gray-400' : '',
                                    ].join(' ')}
                                >
                                    {done ? <Check className="h-4 w-4" /> : step.id}
                                </div>
                                <div className="text-center leading-tight">
                                    <p className={`text-xs font-semibold ${active ? 'text-emerald-700' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                                        {step.label}
                                    </p>
                                    <p className={`text-[11px] ${active ? 'text-gray-500' : 'text-gray-300'}`}>
                                        {step.description}
                                    </p>
                                </div>
                            </div>

                            {idx < steps.length - 1 && (
                                <div className={`mx-1 mb-8 h-0.5 flex-1 rounded-full transition-colors ${done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                            )}
                        </div>
                    );
                })}
            </nav>
        </div>
    );
}

// ── Navigation bar ───────────────────────────────────────────────────────────

function StepNav({
    step,
    totalSteps,
    onBack,
    onNext,
    nextDisabled = false,
    processing = false,
    highlightNext = false,
    cancelHref,
}: {
    step: number;
    totalSteps: number;
    onBack: () => void;
    onNext: () => void;
    nextDisabled?: boolean;
    processing?: boolean;
    highlightNext?: boolean;
    cancelHref: string;
}) {
    const highlightClass = highlightNext && !nextDisabled ? 'nf-highlight' : undefined;
    const isLast = step === totalSteps;

    return (
        <div className="flex items-center justify-between pb-8 pt-2">
            <div>
                {step > 1 && (
                    <Button type="button" variant="outline" onClick={onBack}>
                        <ChevronLeft className="mr-1.5 h-4 w-4" />
                        Back
                    </Button>
                )}
            </div>
            <div className="flex gap-3">
                <Link href={cancelHref}>
                    <Button type="button" variant="ghost" className="text-gray-500">
                        Cancel
                    </Button>
                </Link>
                <Button
                    type="button"
                    onClick={onNext}
                    disabled={nextDisabled || (isLast && processing)}
                    className={highlightClass}
                >
                    {isLast ? (processing ? 'Saving…' : 'Confirm Disposal') : 'Continue'}
                    {!isLast && <ChevronRight className="ml-1.5 h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}

// ── Review helpers ───────────────────────────────────────────────────────────

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 rounded-t-lg">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h3>
                <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                >
                    <Pencil className="h-3 w-3" />
                    Edit
                </button>
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function ReviewField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div className={`min-w-0 ${className}`}>
            <dt className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
            <dd className="break-words text-sm text-gray-900">{children || '—'}</dd>
        </div>
    );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DisposalsCreate({
    asset,
    disposalTypes,
    municipalities,
    barangaysByMunicipality,
    availableAssets,
}: DisposalsCreateProps) {
    const assetQuantity = asset.remaining_quantity ?? asset.quantity ?? 1;

    const [step, setStep] = useState(1);
    const [scanning, setScanning] = useState(false);
    const [piecePickerLine, setPiecePickerLine] = useState<number | null>(null);
    const [extraAssets, setExtraAssets] = useState<DonatableAsset[]>([]);
    const topRef = useRef<HTMLDivElement>(null);
    const firstRender = useRef(true);

    const { data, setData, post, processing, errors } = useForm({
        disposal_type: disposalTypes[0]?.value ?? '',
        quantity: String(assetQuantity),
        lines: [
            { asset_id: String(asset.id), quantity: String(assetQuantity), piece_ids: undefined as number[] | undefined },
        ] as DonationLine[],
        requester_name: '',
        donee_position: '',
        purpose_statement: '',
        confiscation_order_reference: '',
        organization_type: '',
        organization_type_other: '',
        agency_name: '',
        municipality: municipalities[0]?.value ?? '',
        barangay: '',
        street: '',
        appeal_filed: false as boolean,
        notes: '',
        donor_representative_name: '',
        donor_representative_title: '',
        witness_1_name: '',
        witness_1_title: '',
        witness_2_name: '',
        witness_2_title: '',
        // Decay fields
        cause_of_decay: '',
        cause_of_decay_other: '',
        inspection_date: '',
        inspecting_officer: '',
        decay_photo: null as File | null,
    });

    const isDonation = data.disposal_type === 'donation';
    const isVehicleDecision = data.disposal_type === 'released' || data.disposal_type === 'forfeited';
    const isDecayed = data.disposal_type === 'decayed';
    const appealDeadlinePassed = asset.appeal_deadline ? new Date(asset.appeal_deadline) <= new Date() : null;

    const STEPS = isDonation ? DONATION_STEPS : OTHER_STEPS;

    // Build full asset list (pre-seeded with this asset + passed-in availableAssets + QR-scanned extras)
    const allDonatableAssets: DonatableAsset[] = useMemo(
        () => [
            {
                id: asset.id,
                asset_code: asset.asset_code,
                species: asset.species,
                description: asset.description,
                quantity: asset.quantity ?? 1,
                remaining_quantity: assetQuantity,
                pieces: (asset as any).pieces ?? [],
            },
            ...availableAssets,
            ...extraAssets.filter(
                (ea) => ea.id !== asset.id && !availableAssets.some((a) => a.id === ea.id),
            ),
        ],
        [asset, assetQuantity, availableAssets, extraAssets],
    );

    const assetsById = useMemo(
        () => new Map(allDonatableAssets.map((a) => [String(a.id), a])),
        [allDonatableAssets],
    );

    // Scroll to top on step change
    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return; }
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [step]);

    // Reset step to 1 when disposal type changes
    useEffect(() => {
        setStep(1);
    }, [data.disposal_type]);

    // ── Line helpers ─────────────────────────────────────────────────────────

    function lineError(index: number, field: 'asset_id' | 'quantity'): string | undefined {
        return (errors as Record<string, string>)[`lines.${index}.${field}`];
    }

    function updateLine(index: number, field: 'asset_id' | 'quantity', value: string) {
        const next = [...data.lines];
        if (field === 'asset_id') {
            next[index] = { asset_id: value, quantity: '', piece_ids: undefined };
        } else {
            next[index] = { ...next[index], quantity: value, piece_ids: undefined };
        }
        setData('lines', next);
    }

    function addLine() {
        setData('lines', [...data.lines, { asset_id: '', quantity: '', piece_ids: undefined }]);
    }

    function removeLine(index: number) {
        // Never remove the first line (the pre-filled asset)
        if (index === 0 || data.lines.length === 1) return;
        setData('lines', data.lines.filter((_, i) => i !== index));
    }

    function availableOptionsFor(currentIndex: number): DonatableAsset[] {
        const chosenElsewhere = new Set(
            data.lines
                .filter((_, i) => i !== currentIndex)
                .map((l) => l.asset_id)
                .filter(Boolean),
        );
        return allDonatableAssets.filter((a) => !chosenElsewhere.has(String(a.id)));
    }

    function selectedPieceNumbers(line: DonationLine, selectedAsset: DonatableAsset): number[] {
        if (!line.piece_ids?.length) return [];
        return selectedAsset.pieces
            .filter((p) => line.piece_ids!.includes(p.id))
            .map((p) => p.piece_number)
            .sort((a, b) => a - b);
    }

    function handleAssetScanned(scanned: ScannedAsset) {
        setExtraAssets((prev) => (prev.some((a) => a.id === scanned.id) ? prev : [...prev, scanned as any]));

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

        setScanning(false);
    }

    // ── Recipient / address helpers ──────────────────────────────────────────

    function handleOrgTypeChange(value: string) {
        setData((prev) => ({
            ...prev,
            organization_type: value,
            organization_type_other: value === 'other' ? prev.organization_type_other : '',
        }));
    }

    function handleMunicipalityChange(value: string) {
        setData((prev) => ({ ...prev, municipality: value, barangay: '' }));
    }

    function orgLabel(): string {
        if (data.organization_type === 'other') return data.organization_type_other || 'Other';
        return ORG_TYPES.find((o) => o.value === data.organization_type)?.label ?? '';
    }

    // ── Step validation ──────────────────────────────────────────────────────

    function canProceedDonationStep1() {
        return data.lines.every((l) => !!l.asset_id && Number(l.quantity) >= 1);
    }

    function canProceedDonationStep2() {
        return !!(
            data.organization_type &&
            (data.organization_type !== 'other' || data.organization_type_other.trim()) &&
            data.agency_name.trim() &&
            data.requester_name.trim() &&
            data.donee_position.trim() &&
            data.purpose_statement.trim()
        );
    }

    function canProceedDonationStep3() {
        return !!(data.municipality && data.barangay);
    }

    function canProceedOtherStep1() {
        if (isDecayed) {
            return !!(data.cause_of_decay && data.inspection_date && data.inspecting_officer.trim());
        }
        if (isVehicleDecision) return true;
        return Number(data.quantity) >= 1;
    }

    function canProceed(): boolean {
        if (isDonation) {
            if (step === 1) return canProceedDonationStep1();
            if (step === 2) return canProceedDonationStep2();
            if (step === 3) return canProceedDonationStep3();
            return true;
        }
        // Non-donation
        if (step === 1) return canProceedOtherStep1();
        return true;
    }

    // Guided highlight: next required field key
    function getNextTarget(): string {
        if (isDonation) {
            if (step === 1) {
                for (let i = 0; i < data.lines.length; i++) {
                    const l = data.lines[i];
                    if (!l.asset_id) return `asset:${i}`;
                    if (!(Number(l.quantity) >= 1)) return `qty:${i}`;
                }
                return 'next_btn';
            }
            if (step === 2) {
                if (!data.organization_type) return 'organization_type';
                if (data.organization_type === 'other' && !data.organization_type_other.trim()) return 'organization_type_other';
                if (!data.agency_name.trim()) return 'agency_name';
                if (!data.requester_name.trim()) return 'requester_name';
                if (!data.donee_position.trim()) return 'donee_position';
                if (!data.purpose_statement.trim()) return 'purpose_statement';
                return 'next_btn';
            }
            if (step === 3) {
                if (!data.municipality) return 'municipality';
                if (!data.barangay) return 'barangay';
                return 'next_btn';
            }
        } else {
            if (step === 1) {
                if (isDecayed) {
                    if (!data.cause_of_decay) return 'cause_of_decay';
                    if (!data.inspection_date) return 'inspection_date';
                    if (!data.inspecting_officer.trim()) return 'inspecting_officer';
                }
                if (!isVehicleDecision && !isDecayed && !(Number(data.quantity) >= 1)) return 'quantity';
                return 'next_btn';
            }
        }
        return 'next_btn';
    }

    const nextTarget = getNextTarget();
    const hl = (key: string) => (nextTarget === key ? 'nf-highlight' : '');

    // ── Navigation / submit ──────────────────────────────────────────────────

    function handleNext() {
        if (!canProceed()) return;
        if (step < STEPS.length) {
            setStep(step + 1);
        } else {
            confirmAndSubmit();
        }
    }

    function confirmAndSubmit() {
        if (isDonation) {
            const lineSummaries = data.lines
                .map((line) => {
                    const a = assetsById.get(line.asset_id);
                    return a ? `${line.quantity || '?'} pc(s) of ${a.asset_code}` : null;
                })
                .filter(Boolean)
                .join(', ');
            if (!confirm(`Confirm donation of ${lineSummaries} to ${data.requester_name || 'this recipient'}? This cannot be undone.`)) return;
            post(route('disposals.donate.store'), {
                onError: (errs) => {
                    const keys = Object.keys(errs);
                    if (keys.length > 0) setStep(Math.min(...keys.map((k) => stepForErrorKey(k, true))));
                },
            });
        } else {
            const quantityValue = Number(data.quantity) || 0;
            const remainder = assetQuantity - quantityValue;
            const confirmMsg =
                remainder > 0
                    ? `Confirm disposal of ${quantityValue} of ${assetQuantity} unit(s)? The remaining ${remainder} unit(s) will be split into a new asset record and kept in storage.`
                    : 'Confirm disposal action? This cannot be undone.';
            if (!confirm(confirmMsg)) return;
            post(route('disposals.store', asset.id), {
                onError: (errs) => {
                    const keys = Object.keys(errs);
                    if (keys.length > 0) setStep(Math.min(...keys.map((k) => stepForErrorKey(k, false))));
                },
            });
        }
    }

    const pickerLine = piecePickerLine !== null ? data.lines[piecePickerLine] : null;
    const pickerAsset = pickerLine ? assetsById.get(pickerLine.asset_id) : null;

    // ── DONATION Step 1: Assets ──────────────────────────────────────────────

    function renderDonationStep1() {
        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">Assets to Donate</CardTitle>
                    <p className="text-sm text-gray-600">
                        <span className="font-medium text-gray-800">{asset.asset_code}</span> is already added.
                        You can add more assets to include in this donation.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    {data.lines.map((line, index) => {
                        const selectedAsset = assetsById.get(line.asset_id);
                        const options = availableOptionsFor(index);
                        const hasPieces = (selectedAsset?.pieces?.length ?? 0) > 0;
                        const pieceNums = selectedAsset ? selectedPieceNumbers(line, selectedAsset) : [];
                        const remainingAfter = selectedAsset
                            ? selectedAsset.remaining_quantity - Number(line.quantity)
                            : 0;
                        const isLocked = index === 0; // first line is always the pre-filled asset

                        return (
                            <div key={index} className="rounded-lg border border-gray-200 p-4">
                                <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                                    {/* Asset selector */}
                                    <div>
                                        <Label htmlFor={`asset-${index}`}>Asset</Label>
                                        {isLocked ? (
                                            <div className="mt-1 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                                <span className="font-medium">{asset.asset_code}</span>
                                                {asset.species && (
                                                    <span className="text-gray-400">— {asset.species}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <select
                                                id={`asset-${index}`}
                                                value={line.asset_id}
                                                onChange={(e) => updateLine(index, 'asset_id', e.target.value)}
                                                className={`${selectClass} ${hl(`asset:${index}`)}`}
                                                required
                                            >
                                                <option value="" disabled>Select an asset…</option>
                                                {options.map((a) => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.asset_code}
                                                        {a.species ? ` — ${a.species}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <InputError message={lineError(index, 'asset_id')} />
                                    </div>

                                    {/* Piece picker OR quantity */}
                                    <div className="min-w-[150px]">
                                        <Label>Pieces</Label>
                                        {hasPieces ? (
                                            <button
                                                type="button"
                                                onClick={() => selectedAsset && setPiecePickerLine(index)}
                                                disabled={!selectedAsset}
                                                className={`mt-1 flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 ${hl(`qty:${index}`)}`}
                                            >
                                                <span className={line.piece_ids?.length ? 'text-gray-900' : 'text-gray-400'}>
                                                    {line.piece_ids?.length
                                                        ? `${line.piece_ids.length} piece${line.piece_ids.length !== 1 ? 's' : ''} selected`
                                                        : 'Select pieces…'}
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                            </button>
                                        ) : (
                                            <Input
                                                type="number"
                                                min={1}
                                                max={selectedAsset?.remaining_quantity}
                                                value={line.quantity}
                                                onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                                disabled={!selectedAsset}
                                                placeholder={!selectedAsset ? 'Select an asset first' : ''}
                                                className={`mt-1 ${hl(`qty:${index}`)}`}
                                                required
                                            />
                                        )}
                                        <InputError message={lineError(index, 'quantity')} />
                                    </div>

                                    {/* Remove — only for added lines */}
                                    {!isLocked && data.lines.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="mb-0.5 self-end"
                                            onClick={() => removeLine(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                {/* Selected piece badges */}
                                {pieceNums.length > 0 && selectedAsset && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {pieceNums.map((n) => (
                                            <span
                                                key={n}
                                                className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"
                                            >
                                                Piece {n}/{selectedAsset.quantity}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Remainder warning */}
                                {selectedAsset && Number(line.quantity) > 0 && remainingAfter > 0 && (
                                    <p className="mt-2 text-xs text-amber-700">
                                        The remaining {remainingAfter} pc(s) of {selectedAsset.asset_code} will stay available for future disposal.
                                    </p>
                                )}
                            </div>
                        );
                    })}

                    <div className="flex flex-wrap gap-2">
                        {data.lines.length < allDonatableAssets.length && (
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
                </CardContent>
            </Card>
        );
    }

    // ── DONATION Step 2: Recipient ────────────────────────────────────────────

    function renderDonationStep2() {
        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">Recipient</CardTitle>
                    <p className="text-sm text-gray-600">Who is receiving the donation and why.</p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="organization_type">
                                Organization Type<span className="text-red-500">*</span>
                            </Label>
                            <select
                                id="organization_type"
                                value={data.organization_type}
                                onChange={(e) => handleOrgTypeChange(e.target.value)}
                                className={`${selectClass} ${hl('organization_type')}`}
                                required
                            >
                                <option value="" disabled>Select type…</option>
                                {ORG_TYPES.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <InputError message={errors.organization_type} />
                        </div>

                        {data.organization_type === 'other' && (
                            <div>
                                <Label htmlFor="organization_type_other">
                                    Specify Type<span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="organization_type_other"
                                    value={data.organization_type_other}
                                    className={`mt-1 ${hl('organization_type_other')}`}
                                    onChange={(e) => setData('organization_type_other', e.target.value)}
                                    autoFocus
                                />
                                <InputError message={errors.organization_type_other} />
                            </div>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="agency_name">
                            Donee Office / Institution Name<span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="agency_name"
                            placeholder="Agency / Institution Name"
                            value={data.agency_name}
                            className={`mt-1 ${hl('agency_name')}`}
                            onChange={(e) => setData('agency_name', e.target.value)}
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Printed in the Deed of Donation's signature block (the "DONEE OFFICE" heading).
                        </p>
                        <InputError message={errors.agency_name} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="requester_name">
                                Representative Name<span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="requester_name"
                                value={data.requester_name}
                                className={`mt-1 ${hl('requester_name')}`}
                                onChange={(e) => setData('requester_name', e.target.value)}
                                required
                            />
                            <InputError message={errors.requester_name} />
                        </div>
                        <div>
                            <Label htmlFor="donee_position">
                                Representative's Position / Title<span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="donee_position"
                                placeholder="Donee Position"
                                value={data.donee_position}
                                className={`mt-1 ${hl('donee_position')}`}
                                onChange={(e) => setData('donee_position', e.target.value)}
                                required
                            />
                            <InputError message={errors.donee_position} />
                        </div>
                    </div>
                    <p className="-mt-2 text-xs text-gray-500">
                        Printed on the Deed of Donation, e.g. "represented by [name], [position]".
                    </p>

                    <div>
                        <Label htmlFor="purpose_statement">
                            Purpose / Need Statement<span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="purpose_statement"
                            placeholder="e.g. for the improvement and renovation of the office space"
                            value={data.purpose_statement}
                            className={`mt-1 ${hl('purpose_statement')}`}
                            onChange={(e) => setData('purpose_statement', e.target.value)}
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Describes why the donee needs the lumber — appears in the Deed's WITNESSETH clause.
                        </p>
                        <InputError message={errors.purpose_statement} />
                    </div>

                    <div>
                        <Label htmlFor="confiscation_order_reference">Confiscation Order Reference (optional)</Label>
                        <Input
                            id="confiscation_order_reference"
                            value={data.confiscation_order_reference}
                            className="mt-1"
                            onChange={(e) => setData('confiscation_order_reference', e.target.value)}
                        />
                        <InputError message={errors.confiscation_order_reference} />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── DONATION Step 3: Delivery ─────────────────────────────────────────────

    function renderDonationStep3() {
        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">Delivery</CardTitle>
                    <p className="text-sm text-gray-600">Where the donated items will be delivered.</p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Donee Address</p>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="municipality">
                                    Municipality<span className="text-red-500">*</span>
                                </Label>
                                <select
                                    id="municipality"
                                    value={data.municipality}
                                    onChange={(e) => handleMunicipalityChange(e.target.value)}
                                    className={`${selectClass} ${hl('municipality')}`}
                                    required
                                >
                                    {municipalities.map((m) => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                                <InputError message={errors.municipality} />
                            </div>
                            <div>
                                <Label htmlFor="barangay">
                                    Barangay<span className="text-red-500">*</span>
                                </Label>
                                <select
                                    id="barangay"
                                    value={data.barangay}
                                    onChange={(e) => setData('barangay', e.target.value)}
                                    className={`${selectClass} ${hl('barangay')}`}
                                    required
                                >
                                    <option value="" disabled>Select barangay…</option>
                                    {(barangaysByMunicipality[data.municipality] ?? []).map((brgy) => (
                                        <option key={brgy} value={brgy}>{brgy}</option>
                                    ))}
                                </select>
                                <InputError message={errors.barangay} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <Label htmlFor="street">Street / House No.</Label>
                            <Input
                                id="street"
                                placeholder="e.g. Purok 3, Zone 2"
                                value={data.street}
                                className="mt-1"
                                onChange={(e) => setData('street', e.target.value)}
                            />
                            <InputError message={errors.street} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── DONATION Step 4: Signatories ──────────────────────────────────────────

    function renderDonationStep4() {
        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">Deed of Donation Signatories</CardTitle>
                    <p className="text-sm text-gray-600">
                        Optional. Leave any of these blank to use the office's standing default.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="donor_representative_name">OIC / PENR Officer Name</Label>
                            <Input
                                id="donor_representative_name"
                                placeholder="Donor Representative Name"
                                value={data.donor_representative_name}
                                className="mt-1"
                                onChange={(e) => setData('donor_representative_name', e.target.value)}
                            />
                            <InputError message={errors.donor_representative_name} />
                        </div>
                        <div>
                            <Label htmlFor="donor_representative_title">OIC / PENR Officer Title</Label>
                            <Input
                                id="donor_representative_title"
                                placeholder="Donor Representative Title"
                                value={data.donor_representative_title}
                                className="mt-1"
                                onChange={(e) => setData('donor_representative_title', e.target.value)}
                            />
                            <InputError message={errors.donor_representative_title} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="witness_1_name">Witness 1 Name</Label>
                            <Input
                                id="witness_1_name"
                                placeholder="Witness 1 Name"
                                value={data.witness_1_name}
                                className="mt-1"
                                onChange={(e) => setData('witness_1_name', e.target.value)}
                            />
                            <InputError message={errors.witness_1_name} />
                        </div>
                        <div>
                            <Label htmlFor="witness_1_title">Witness 1 Title</Label>
                            <Input
                                id="witness_1_title"
                                placeholder="Witness 1 Title"
                                value={data.witness_1_title}
                                className="mt-1"
                                onChange={(e) => setData('witness_1_title', e.target.value)}
                            />
                            <InputError message={errors.witness_1_title} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="witness_2_name">Witness 2 Name</Label>
                            <Input
                                id="witness_2_name"
                                placeholder="Witness 2 Name"
                                value={data.witness_2_name}
                                className="mt-1"
                                onChange={(e) => setData('witness_2_name', e.target.value)}
                            />
                            <InputError message={errors.witness_2_name} />
                        </div>
                        <div>
                            <Label htmlFor="witness_2_title">Witness 2 Title</Label>
                            <Input
                                id="witness_2_title"
                                placeholder="Witness 2 Title"
                                value={data.witness_2_title}
                                className="mt-1"
                                onChange={(e) => setData('witness_2_title', e.target.value)}
                            />
                            <InputError message={errors.witness_2_title} />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Input
                            id="notes"
                            value={data.notes}
                            className="mt-1"
                            onChange={(e) => setData('notes', e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── DONATION Step 5: Review ───────────────────────────────────────────────

    function renderDonationStep5() {
        const address = [data.street, data.barangay, data.municipality].filter(Boolean).join(', ');
        const hasSignatories = !!(
            data.donor_representative_name || data.donor_representative_title ||
            data.witness_1_name || data.witness_1_title ||
            data.witness_2_name || data.witness_2_title
        );
        const signatory = (name: string, title: string) =>
            name || title ? [name, title].filter(Boolean).join(' — ') : 'Office default';

        return (
            <div className="space-y-4">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-xl">Review &amp; Confirm</CardTitle>
                        <p className="text-sm text-gray-600">
                            Check everything below. Once confirmed, the donation cannot be undone.
                        </p>
                    </CardHeader>
                </Card>

                <ReviewCard title={`Assets (${data.lines.length})`} onEdit={() => setStep(1)}>
                    <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
                        {data.lines.map((line, i) => {
                            const a = assetsById.get(line.asset_id);
                            const nums = a ? selectedPieceNumbers(line, a) : [];
                            return (
                                <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                                    <div className="min-w-0">
                                        <span className="font-medium text-gray-900">{a?.asset_code ?? '—'}</span>
                                        {a?.species && <span className="ml-2 text-xs text-gray-500">{a.species}</span>}
                                        {nums.length > 0 && a && (
                                            <p className="mt-0.5 text-xs text-gray-500">
                                                Pieces: {nums.join(', ')} of {a.quantity}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-600">{line.quantity} pc(s)</span>
                                </li>
                            );
                        })}
                    </ul>
                </ReviewCard>

                <ReviewCard title="Recipient" onEdit={() => setStep(2)}>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <ReviewField label="Organization Type">{orgLabel()}</ReviewField>
                        <ReviewField label="Office / Institution">{data.agency_name}</ReviewField>
                        <ReviewField label="Representative">{data.requester_name}</ReviewField>
                        <ReviewField label="Position / Title">{data.donee_position}</ReviewField>
                        <ReviewField label="Purpose" className="sm:col-span-2">{data.purpose_statement}</ReviewField>
                        {data.confiscation_order_reference && (
                            <ReviewField label="Confiscation Order Ref." className="sm:col-span-2">
                                {data.confiscation_order_reference}
                            </ReviewField>
                        )}
                    </dl>
                </ReviewCard>

                <ReviewCard title="Delivery" onEdit={() => setStep(3)}>
                    <dl>
                        <ReviewField label="Donee Address">{address}</ReviewField>
                    </dl>
                </ReviewCard>

                <ReviewCard title="Signatories" onEdit={() => setStep(4)}>
                    {hasSignatories ? (
                        <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <ReviewField label="OIC / PENR Officer">
                                {signatory(data.donor_representative_name, data.donor_representative_title)}
                            </ReviewField>
                            <ReviewField label="Witness 1">
                                {signatory(data.witness_1_name, data.witness_1_title)}
                            </ReviewField>
                            <ReviewField label="Witness 2">
                                {signatory(data.witness_2_name, data.witness_2_title)}
                            </ReviewField>
                        </dl>
                    ) : (
                        <p className="text-sm text-gray-500">Using the office's standing defaults.</p>
                    )}
                    {data.notes && (
                        <p className="mt-4 text-sm text-gray-700">
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Notes: </span>
                            {data.notes}
                        </p>
                    )}
                </ReviewCard>
            </div>
        );
    }

    // ── NON-DONATION Step 1: Disposal Details ────────────────────────────────

    function renderOtherStep1() {
        const quantityValue = Number(data.quantity) || 0;
        const remainder = assetQuantity - quantityValue;

        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">Disposal Details</CardTitle>
                    <p className="text-sm text-gray-600">
                        Asset: <span className="font-medium text-gray-800">{asset.asset_code}</span> ({asset.type}) — {assetQuantity} unit(s) on hand
                    </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    {/* Disposal type selector */}
                    <div>
                        <Label htmlFor="disposal_type">Disposal Type</Label>
                        <select
                            id="disposal_type"
                            value={data.disposal_type}
                            onChange={(e) => setData('disposal_type', e.target.value)}
                            className={selectClass}
                        >
                            {disposalTypes.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                        <InputError message={errors.disposal_type} />
                    </div>

                    {/* Vehicle decision notice */}
                    {isVehicleDecision && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            {asset.appeal_deadline ? (
                                <p>
                                    15-day appeal window {appealDeadlinePassed ? 'closed' : 'closes'} on{' '}
                                    <span className="font-medium">
                                        {new Date(asset.appeal_deadline).toLocaleDateString()}
                                    </span>.
                                    Release depends on whether the owner appealed within this window; forfeiture is the
                                    default absent a timely appeal, subject to the judge or regional office decision.
                                </p>
                            ) : (
                                <p>No appeal deadline is recorded for this asset yet.</p>
                            )}
                            <label className="mt-2 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={data.appeal_filed}
                                    onChange={(e) => setData('appeal_filed', e.target.checked)}
                                />
                                <span>Owner filed an appeal within the window</span>
                            </label>
                            <InputError message={errors.appeal_filed} />
                        </div>
                    )}

                    {/* Quantity (non-vehicle, non-decayed) */}
                    {!isVehicleDecision && !isDecayed && (
                        <div>
                            <Label htmlFor="quantity">Quantity to Dispose</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min={1}
                                max={assetQuantity}
                                value={data.quantity}
                                className={`mt-1 ${hl('quantity')}`}
                                onChange={(e) => setData('quantity', e.target.value)}
                                required
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Out of {assetQuantity} unit(s) currently on hand.
                                {remainder > 0 && (
                                    <span className="text-amber-700">
                                        {' '}The remaining {remainder} unit(s) will be split off and kept in storage.
                                    </span>
                                )}
                            </p>
                            <InputError message={errors.quantity} />
                        </div>
                    )}

                    {/* Decay fields */}
                    {isDecayed && (
                        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Decay Details</p>

                            {/* Piece picker or quantity */}
                            {(() => {
                                const hasPieces = ((asset as any).pieces?.length ?? 0) > 0;
                                const selectedPieceNums = (data.lines[0]?.piece_ids ?? [])
                                    .map((id) => (asset as any).pieces?.find((p: any) => p.id === id)?.piece_number)
                                    .filter((n: number | undefined): n is number => n !== undefined)
                                    .sort((a: number, b: number) => a - b);

                                return (
                                    <div>
                                        <Label>Pieces to Dispose</Label>
                                        {hasPieces ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setPiecePickerLine(0)}
                                                    className="mt-1 flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                                                >
                                                    <span className={data.lines[0]?.piece_ids?.length ? 'text-gray-900' : 'text-gray-400'}>
                                                        {data.lines[0]?.piece_ids?.length
                                                            ? `${data.lines[0].piece_ids.length} piece${data.lines[0].piece_ids.length !== 1 ? 's' : ''} selected`
                                                            : 'Select pieces…'}
                                                    </span>
                                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                                </button>
                                                {selectedPieceNums.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {selectedPieceNums.map((n: number) => (
                                                            <span
                                                                key={n}
                                                                className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"
                                                            >
                                                                Piece {n}/{asset.quantity}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={assetQuantity}
                                                    value={data.quantity}
                                                    className={`mt-1 ${hl('quantity')}`}
                                                    onChange={(e) => setData('quantity', e.target.value)}
                                                    required
                                                />
                                                <p className="mt-1 text-xs text-gray-500">
                                                    Out of {assetQuantity} unit(s) currently on hand.
                                                </p>
                                            </>
                                        )}
                                        <InputError message={errors.quantity} />
                                    </div>
                                );
                            })()}

                            <div>
                                <Label htmlFor="cause_of_decay">
                                    Cause of Decay<span className="text-red-500">*</span>
                                </Label>
                                <select
                                    id="cause_of_decay"
                                    value={data.cause_of_decay}
                                    onChange={(e) => setData('cause_of_decay', e.target.value)}
                                    className={`${selectClass} ${hl('cause_of_decay')}`}
                                    required
                                >
                                    <option value="" disabled>Select cause…</option>
                                    <option value="Prolonged storage">Prolonged storage</option>
                                    <option value="Flood / water damage">Flood / water damage</option>
                                    <option value="Pest / termite infestation">Pest / termite infestation</option>
                                    <option value="Fungal / mold growth">Fungal / mold growth</option>
                                    <option value="Other">Other</option>
                                </select>
                                <InputError message={errors.cause_of_decay} />
                            </div>

                            {data.cause_of_decay === 'Other' && (
                                <div>
                                    <Label htmlFor="cause_of_decay_other">
                                        Specify Cause<span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="cause_of_decay_other"
                                        placeholder="Describe the cause of decay"
                                        value={data.cause_of_decay_other}
                                        className="mt-1"
                                        onChange={(e) => setData('cause_of_decay_other', e.target.value)}
                                        required
                                    />
                                    <InputError message={errors.cause_of_decay_other} />
                                </div>
                            )}

                            <div>
                                <Label htmlFor="inspection_date">
                                    Inspection Date<span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="inspection_date"
                                    type="date"
                                    value={data.inspection_date}
                                    className={`mt-1 ${hl('inspection_date')}`}
                                    onChange={(e) => setData('inspection_date', e.target.value)}
                                    required
                                />
                                <InputError message={errors.inspection_date} />
                            </div>

                            <div>
                                <Label htmlFor="inspecting_officer">
                                    Inspecting Officer<span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="inspecting_officer"
                                    placeholder="Full name of the inspecting officer"
                                    value={data.inspecting_officer}
                                    className={`mt-1 ${hl('inspecting_officer')}`}
                                    onChange={(e) => setData('inspecting_officer', e.target.value)}
                                    required
                                />
                                <InputError message={errors.inspecting_officer} />
                            </div>

                            <div>
                                <Label htmlFor="decay_photo">
                                    Photo Evidence{' '}
                                    <span className="font-normal text-gray-400">(optional)</span>
                                </Label>
                                <input
                                    id="decay_photo"
                                    type="file"
                                    accept="image/*"
                                    className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
                                    onChange={(e) => setData('decay_photo', e.target.files?.[0] ?? null)}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Max 8 MB. Will be embedded in the generated Decay Report PDF.
                                </p>
                                <InputError message={errors.decay_photo} />
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Input
                            id="notes"
                            value={data.notes}
                            className="mt-1"
                            onChange={(e) => setData('notes', e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── NON-DONATION Step 2: Review ──────────────────────────────────────────

    function renderOtherStep2() {
        const quantityValue = Number(data.quantity) || 0;
        const remainder = assetQuantity - quantityValue;
        const disposalLabel = disposalTypes.find((t) => t.value === data.disposal_type)?.label ?? data.disposal_type;

        return (
            <div className="space-y-4">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-xl">Review &amp; Confirm</CardTitle>
                        <p className="text-sm text-gray-600">
                            Check the details below. Once confirmed, the disposal cannot be undone.
                        </p>
                    </CardHeader>
                </Card>

                <ReviewCard title="Disposal Details" onEdit={() => setStep(1)}>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <ReviewField label="Asset">
                            {asset.asset_code}
                            {asset.type && <span className="ml-1 text-gray-400">({asset.type})</span>}
                        </ReviewField>
                        <ReviewField label="Disposal Type">{disposalLabel}</ReviewField>

                        {!isVehicleDecision && !isDecayed && (
                            <>
                                <ReviewField label="Quantity to Dispose">{quantityValue} pc(s)</ReviewField>
                                {remainder > 0 && (
                                    <ReviewField label="Remaining After">
                                        <span className="text-amber-700">{remainder} pc(s) — will be kept in storage</span>
                                    </ReviewField>
                                )}
                            </>
                        )}

                        {isVehicleDecision && (
                            <ReviewField label="Appeal Filed" className="sm:col-span-2">
                                {data.appeal_filed ? 'Yes — owner filed an appeal' : 'No appeal filed'}
                            </ReviewField>
                        )}

                        {isDecayed && (
                            <>
                                <ReviewField label="Cause of Decay">
                                    {data.cause_of_decay === 'Other' ? data.cause_of_decay_other : data.cause_of_decay}
                                </ReviewField>
                                <ReviewField label="Inspection Date">
                                    {data.inspection_date ? new Date(data.inspection_date).toLocaleDateString() : '—'}
                                </ReviewField>
                                <ReviewField label="Inspecting Officer">{data.inspecting_officer}</ReviewField>
                                {data.lines[0]?.piece_ids?.length ? (
                                    <ReviewField label="Pieces Selected" className="sm:col-span-2">
                                        {data.lines[0].piece_ids.length} piece(s) selected
                                    </ReviewField>
                                ) : (
                                    <ReviewField label="Quantity">{data.quantity} pc(s)</ReviewField>
                                )}
                            </>
                        )}

                        {data.notes && (
                            <ReviewField label="Notes" className="sm:col-span-2">{data.notes}</ReviewField>
                        )}
                    </dl>
                </ReviewCard>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Process Disposal</h2>}>
            <Head title="Process Disposal" />
            <style>{HIGHLIGHT_CSS}</style>

            <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-4 px-4 sm:px-6 lg:px-8">
                <StepIndicator current={step} steps={STEPS} />

                <form
                    onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        handleNext();
                    }}
                >
                    {/* Donation flow */}
                    {isDonation && step === 1 && renderDonationStep1()}
                    {isDonation && step === 2 && renderDonationStep2()}
                    {isDonation && step === 3 && renderDonationStep3()}
                    {isDonation && step === 4 && renderDonationStep4()}
                    {isDonation && step === 5 && renderDonationStep5()}

                    {/* Non-donation flow */}
                    {!isDonation && step === 1 && renderOtherStep1()}
                    {!isDonation && step === 2 && renderOtherStep2()}

                    <div className="mt-6">
                        <StepNav
                            step={step}
                            totalSteps={STEPS.length}
                            onBack={() => setStep(step - 1)}
                            onNext={handleNext}
                            nextDisabled={!canProceed()}
                            processing={processing}
                            highlightNext={nextTarget === 'next_btn'}
                            cancelHref={route('assets.show', asset.id)}
                        />
                    </div>
                </form>
            </div>

            <AssetScanModal show={scanning} onClose={() => setScanning(false)} onFound={handleAssetScanned} />

            {piecePickerLine !== null && (
                isDecayed ? (
                    <PiecePickerModal
                        show
                        assetCode={asset.asset_code}
                        totalPieces={asset.quantity}
                        pieces={((asset as any).pieces ?? []) as AssetPieceData[]}
                        selectedIds={data.lines[0]?.piece_ids ?? []}
                        onClose={() => setPiecePickerLine(null)}
                        onConfirm={(ids) => {
                            const next = [...data.lines];
                            next[0] = { ...next[0], piece_ids: ids, quantity: String(ids.length) };
                            setData('lines', next);
                            setData('quantity', String(ids.length));
                            setPiecePickerLine(null);
                        }}
                    />
                ) : pickerAsset ? (
                    <PiecePickerModal
                        show
                        assetCode={pickerAsset.asset_code}
                        totalPieces={pickerAsset.quantity}
                        pieces={pickerAsset.pieces}
                        selectedIds={data.lines[piecePickerLine].piece_ids ?? []}
                        onClose={() => setPiecePickerLine(null)}
                        onConfirm={(ids) => {
                            const next = [...data.lines];
                            next[piecePickerLine] = { ...next[piecePickerLine], piece_ids: ids, quantity: String(ids.length) };
                            setData('lines', next);
                            setPiecePickerLine(null);
                        }}
                    />
                ) : null
            )}
        </AuthenticatedLayout>
    );
}