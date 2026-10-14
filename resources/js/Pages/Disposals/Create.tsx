import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Asset } from '@/types';
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
    aap_number?: string | null;
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

type StepId = 'type' | 'asset' | 'recipient' | 'delivery' | 'signatories' | 'decay' | 'fabrication' | 'appeal' | 'review';
type Group = 'donation' | 'decayed' | 'fabrication' | 'vehicle' | 'standard';

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

const DECAY_CAUSES = [
    'Prolonged storage',
    'Flood / water damage',
    'Pest / termite infestation',
    'Fungal / mold growth',
    'Other',
];

const TYPE_HINTS: Record<string, string> = {
    donation: 'Give the logs to an office or institution. Produces a Deed of Donation.',
    decayed: 'The logs have deteriorated. Produces a Decay Report.',
    fabricated: 'The lumber was made into finished items. Records what was made and generates the ICS and PAR.',
    released: 'Release the vehicle to its owner.',
    forfeited: 'Forfeit the vehicle to the government.',
};

const STEP_FLOWS: Record<Group, StepId[]> = {
    donation: ['type', 'asset', 'recipient', 'delivery', 'signatories', 'review'],
    decayed: ['type', 'asset', 'decay', 'review'],
    fabrication: ['type', 'asset', 'fabrication', 'review'],
    vehicle: ['type', 'asset', 'appeal', 'review'],
    standard: ['type', 'asset', 'review'],
};

const FIELD_STEP: Record<string, StepId> = {
    disposal_type: 'type',
    quantity: 'asset',
    organization_type: 'recipient',
    organization_type_other: 'recipient',
    agency_name: 'recipient',
    requester_name: 'recipient',
    donee_position: 'recipient',
    purpose_statement: 'recipient',
    confiscation_order_reference: 'recipient',
    municipality: 'delivery',
    barangay: 'delivery',
    street: 'delivery',
    delivery_coordinates: 'delivery',
    donor_representative_name: 'signatories',
    donor_representative_title: 'signatories',
    witness_1_name: 'signatories',
    witness_1_title: 'signatories',
    witness_2_name: 'signatories',
    witness_2_title: 'signatories',
    cause_of_decay: 'decay',
    cause_of_decay_other: 'decay',
    inspection_date: 'decay',
    inspecting_officer: 'decay',
    decay_photo: 'decay',
    fabricated_item: 'fabrication',
    fabricated_item_count: 'fabrication',
    fabrication_date: 'fabrication',
    fabrication_location: 'fabrication',
    fabricator_name: 'fabrication',
    lumber_used_bd_ft: 'fabrication',
    usable_remainder_bd_ft: 'fabrication',
    scrap_bd_ft: 'fabrication',
    fabrication_attachments: 'fabrication',
    appeal_filed: 'appeal',
    notes: 'review',
};

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_FAB_FILES = 5;
const FAB_FILE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'];

const selectCls = (error?: string) =>
    `mt-1 w-full rounded-md border px-3 py-2 text-sm ${error ? 'border-red-400' : 'border-gray-300'}`;
const inputCls = (error?: string) => (error ? 'border-red-400' : undefined);

/** Show the AAP number; fall back to the asset code (e.g. scanned assets). */
function aapOf(a: { aap_number?: string | null; asset_code: string }): string {
    return a.aap_number || a.asset_code;
}

function groupFor(type: string): Group {
    if (type === 'donation') return 'donation';
    if (type === 'decayed') return 'decayed';
    if (type === 'fabricated') return 'fabrication';
    if (type === 'released' || type === 'forfeited') return 'vehicle';
    return 'standard';
}

function stepForErrorKey(key: string): StepId {
    if (key.startsWith('lines')) return 'asset';
    if (key.startsWith('fabrication_attachments')) return 'fabrication';
    return FIELD_STEP[key] ?? 'review';
}

function stepMeta(id: StepId, group: Group): { label: string; title: string; description: string } {
    switch (id) {
        case 'type':
            return {
                label: 'Type',
                title: 'Choose Disposal Type',
                description: 'Pick how this asset will be disposed. The next steps only ask for what that type needs.',
            };
        case 'asset':
            if (group === 'donation')
                return {
                    label: 'Assets',
                    title: 'Assets to Donate',
                    description: 'Confirm the asset and choose how many pieces go to this recipient. You can add more log assets.',
                };
            if (group === 'decayed')
                return {
                    label: 'Asset',
                    title: 'Confirm Asset',
                    description: 'Confirm the asset and which pieces have decayed.',
                };
            if (group === 'fabrication')
                return {
                    label: 'Asset',
                    title: 'Confirm Asset',
                    description: 'Confirm the asset and which pieces were used for fabrication.',
                };
            if (group === 'vehicle')
                return { label: 'Asset', title: 'Confirm Asset', description: 'Confirm the asset you are processing.' };
            return {
                label: 'Asset',
                title: 'Confirm Asset & Quantity',
                description: 'Confirm the asset and enter how many units to dispose.',
            };
        case 'recipient':
            return { label: 'Recipient', title: 'Recipient', description: 'Who is receiving the donation and why.' };
        case 'delivery':
            return { label: 'Delivery', title: 'Delivery Details', description: 'Where the donee is located and where the logs will go.' };
        case 'signatories':
            return {
                label: 'Signatories',
                title: 'Deed of Donation Signatories',
                description: 'Optional. Leave any blank to use the office default for this document.',
            };
        case 'decay':
            return { label: 'Decay', title: 'Decay Details', description: 'Inspection findings for the Decay Report.' };
        case 'fabrication':
            return {
                label: 'Fabrication',
                title: 'Fabrication Details',
                description: 'Record what the lumber was made into, where, and by whom.',
            };
        case 'appeal':
            return { label: 'Appeal', title: 'Appeal Status', description: 'Record whether the owner appealed within the window.' };
        case 'review':
            return { label: 'Review', title: 'Review & Confirm', description: 'Check everything below. Processing cannot be undone.' };
    }
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

export default function DisposalsCreate({
    asset,
    disposalTypes,
    municipalities,
    barangaysByMunicipality,
    availableAssets,
}: DisposalsCreateProps) {
    const assetQuantity = asset.remaining_quantity ?? asset.quantity ?? 1;

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

    const allDonatableAssets: DonatableAsset[] = useMemo(
        () => [
            {
                id: asset.id,
                asset_code: asset.asset_code,
                aap_number: (asset as any).aap_number ?? null,
                species: asset.species,
                description: asset.description,
                quantity: asset.quantity ?? 1,
                remaining_quantity: assetQuantity,
                pieces: (asset as any).pieces ?? [],
            },
            ...availableAssets,
            ...extraAssets.filter((ea) => ea.id !== asset.id && !availableAssets.some((a) => a.id === ea.id)),
        ],
        [asset, assetQuantity, availableAssets, extraAssets],
    );

    const assetsById = useMemo(() => new Map(allDonatableAssets.map((a) => [String(a.id), a])), [allDonatableAssets]);

    const defaultLine = (): DonationLine => ({
        asset_id: String(asset.id),
        quantity: String(assetQuantity),
        piece_ids: undefined,
    });

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        disposal_type: '',
        quantity: String(assetQuantity),
        lines: [defaultLine()] as DonationLine[],
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
        appeal_filed: false as boolean,
        notes: '',
        donor_representative_name: '',
        donor_representative_title: '',
        witness_1_name: '',
        witness_1_title: '',
        witness_2_name: '',
        witness_2_title: '',

        // Decay-related fields
        cause_of_decay: '',
        cause_of_decay_other: '',
        inspection_date: '',
        inspecting_officer: '',
        decay_photo: null as File | null,

        // Fabrication-related fields
        fabricated_item: '',
        fabricated_item_count: '',
        fabrication_date: '',
        fabrication_location: '',
        fabricator_name: '',
        lumber_used_bd_ft: '',
        usable_remainder_bd_ft: '',
        scrap_bd_ft: '',
        fabrication_attachments: [] as File[],
    });

    /* ---------------------------- derived state ---------------------------- */

    const serverErrors = errors as Record<string, string>;
    const group = groupFor(data.disposal_type);
    const isDonation = group === 'donation';
    const isDecayed = group === 'decayed';
    const isFabrication = group === 'fabrication';
    const isVehicleDecision = group === 'vehicle';
    const steps: StepId[] = data.disposal_type ? STEP_FLOWS[group] : ['type'];
    const safeIndex = Math.min(stepIndex, steps.length - 1);
    const currentStepId = steps[safeIndex];
    const isLast = currentStepId === 'review';
    const stepList = steps.map((id) => ({ id, label: stepMeta(id, group).label }));
    const meta = stepMeta(currentStepId, group);

    const typeLabel = disposalTypes.find((t) => t.value === data.disposal_type)?.label ?? '';
    const mainAsset = assetsById.get(String(asset.id));
    const mainHasPieces = (mainAsset?.pieces?.length ?? 0) > 0;
    const quantityValue = Number(data.quantity) || 0;
    const remainder = assetQuantity - quantityValue;
    const appealDeadlinePassed = asset.appeal_deadline ? new Date(asset.appeal_deadline) <= new Date() : null;

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
            case 'type':
                if (!data.disposal_type) e.disposal_type = 'Choose a disposal type to continue.';
                break;

            case 'asset':
                if (isDonation) {
                    data.lines.forEach((line, i) => {
                        const a = assetsById.get(line.asset_id);
                        if (!line.asset_id || !a) {
                            e[`lines.${i}.asset_id`] = 'Select an AAP No.';
                            return;
                        }
                        const msg = qtyError(line.quantity, a.remaining_quantity, a.pieces.length > 0);
                        if (msg) e[`lines.${i}.quantity`] = msg;
                    });
                } else if (!isVehicleDecision) {
                    const msg = qtyError(data.quantity, assetQuantity, mainHasPieces);
                    if (msg) e.quantity = msg;
                }
                break;

            case 'recipient':
                req('organization_type', data.organization_type, 'Select an organization type.');
                if (data.organization_type === 'other') {
                    req('organization_type_other', data.organization_type_other, 'Specify the organization type.');
                }
                req('agency_name', data.agency_name, 'Enter the donee office or institution name.');
                req('requester_name', data.requester_name, 'Enter the representative name.');
                req('donee_position', data.donee_position, "Enter the representative's position.");
                req('purpose_statement', data.purpose_statement, 'Describe why the donee needs the logs.');
                max('organization_type_other', data.organization_type_other, 255);
                max('agency_name', data.agency_name, 255);
                max('requester_name', data.requester_name, 255);
                max('donee_position', data.donee_position, 255);
                max('purpose_statement', data.purpose_statement, 2000);
                max('confiscation_order_reference', data.confiscation_order_reference, 255);
                break;

            case 'delivery':
                req('municipality', data.municipality, 'Select a municipality.');
                req('barangay', data.barangay, 'Select a barangay.');
                if (!e.barangay && !(barangaysByMunicipality[data.municipality] ?? []).includes(data.barangay)) {
                    e.barangay = 'The selected barangay is not valid for the chosen municipality.';
                }
                max('street', data.street, 255);
                max('delivery_coordinates', data.delivery_coordinates, 255);
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

            case 'decay':
                req('cause_of_decay', data.cause_of_decay, 'Select the cause of decay.');
                if (data.cause_of_decay === 'Other') {
                    req('cause_of_decay_other', data.cause_of_decay_other, 'Describe the cause of decay.');
                    max('cause_of_decay_other', data.cause_of_decay_other, 255);
                }
                req('inspection_date', data.inspection_date, 'Enter the inspection date.');
                req('inspecting_officer', data.inspecting_officer, 'Enter the inspecting officer.');
                max('inspecting_officer', data.inspecting_officer, 255);
                if (data.decay_photo) {
                    if (!data.decay_photo.type.startsWith('image/')) e.decay_photo = 'The file must be an image.';
                    else if (data.decay_photo.size > MAX_PHOTO_BYTES) e.decay_photo = 'The photo must be 8 MB or smaller.';
                }
                break;

            case 'fabrication': {
                req('fabricated_item', data.fabricated_item, 'Enter what was fabricated (e.g. table, chair, cabinet).');
                max('fabricated_item', data.fabricated_item, 255);

                const count = Number(data.fabricated_item_count);
                if (!String(data.fabricated_item_count).trim()) e.fabricated_item_count = 'Enter the number of finished items.';
                else if (!Number.isInteger(count) || count < 1) e.fabricated_item_count = 'Enter a whole number of at least 1.';

                if (!data.fabrication_date) e.fabrication_date = 'Enter the fabrication / completion date.';
                else if (data.fabrication_date > new Date().toISOString().slice(0, 10))
                    e.fabrication_date = 'The date cannot be in the future.';

                req('fabrication_location', data.fabrication_location, 'Enter the workshop or location.');
                max('fabrication_location', data.fabrication_location, 255);
                req('fabricator_name', data.fabricator_name, 'Enter the responsible officer or fabricator.');
                max('fabricator_name', data.fabricator_name, 255);

                const used = Number(data.lumber_used_bd_ft);
                if (!String(data.lumber_used_bd_ft).trim()) e.lumber_used_bd_ft = 'Enter the amount of lumber used.';
                else if (!Number.isFinite(used) || used <= 0) e.lumber_used_bd_ft = 'Must be greater than 0.';

                (
                    [
                        ['usable_remainder_bd_ft', data.usable_remainder_bd_ft],
                        ['scrap_bd_ft', data.scrap_bd_ft],
                    ] as const
                ).forEach(([k, v]) => {
                    if (String(v).trim() && (!Number.isFinite(Number(v)) || Number(v) < 0)) e[k] = 'Must be 0 or more.';
                });

                if (data.fabrication_attachments.length > MAX_FAB_FILES) {
                    e.fabrication_attachments = `Attach at most ${MAX_FAB_FILES} files.`;
                } else {
                    const bad = data.fabrication_attachments.find((f) => {
                        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
                        return !FAB_FILE_EXT.includes(ext) || f.size > MAX_PHOTO_BYTES;
                    });
                    if (bad) {
                        const ext = bad.name.split('.').pop()?.toLowerCase() ?? '';
                        e.fabrication_attachments = !FAB_FILE_EXT.includes(ext)
                            ? `"${bad.name}" is not an allowed type (images, PDF, Word).`
                            : `"${bad.name}" is larger than 8 MB.`;
                    }
                }
                break;
            }

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

    function handleTypeChange(value: string) {
        if (value === data.disposal_type) return;
        // Each type uses the asset differently, so start from the default line.
        setData((prev) => ({
            ...prev,
            disposal_type: value,
            quantity: String(assetQuantity),
            lines: [defaultLine()],
        }));
        clearErrors();
        setShowErrors(false);
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

    function setSingleQuantity(value: string) {
        setData((prev) => ({
            ...prev,
            quantity: value,
            lines: prev.lines.map((l, i) => (i === 0 ? { ...l, quantity: value, piece_ids: undefined } : l)),
        }));
        clearErrors('quantity');
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
        return allDonatableAssets.filter((a) => !chosenElsewhere.has(String(a.id)));
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
            const alreadyIndex = prevData.lines.findIndex((l) => l.asset_id === String(scanned.id));
            if (alreadyIndex !== -1) return prevData;

            const isPieceScan = scanned.piece_id != null;
            const emptyIndex = prevData.lines.findIndex((l) => !l.asset_id);
            const newLine: DonationLine = {
                asset_id: String(scanned.id),
                quantity: isPieceScan ? '1' : String(scanned.remaining_quantity),
                piece_ids: isPieceScan ? [scanned.piece_id as number] : undefined,
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

    /* ------------------------------ navigation ----------------------------- */

    function goToStep(id: StepId) {
        const i = steps.indexOf(id);
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
        setStepIndex(Math.min(safeIndex + 1, steps.length - 1));
    }

    function goBack() {
        setShowErrors(false);
        setStepIndex(Math.max(safeIndex - 1, 0));
    }

    function handleServerErrors(errs: Record<string, string>) {
        const idxs = Object.keys(errs)
            .map((k) => steps.indexOf(stepForErrorKey(k)))
            .filter((i) => i >= 0);
        setShowErrors(false);
        setStepIndex(idxs.length ? Math.min(...idxs) : steps.length - 1);
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
        for (let i = 0; i < steps.length; i++) {
            if (Object.keys(validateStep(steps[i])).length > 0) {
                setStepIndex(i);
                setShowErrors(true);
                setAttempt((a) => a + 1);
                return;
            }
        }

        if (isDonation) {
            const lineSummaries = data.lines
                .map((line) => {
                    const donatable = assetsById.get(line.asset_id);
                    return donatable ? `${line.quantity || '?'} pc(s) of ${aapOf(donatable)}` : null;
                })
                .filter(Boolean)
                .join(', ');

            if (
                confirm(
                    `Confirm donation of ${lineSummaries} to ${data.requester_name || 'this recipient'}? This cannot be undone.`,
                )
            ) {
                post(route('disposals.donate.store'), { onError: handleServerErrors });
            }
            return;
        }

        const confirmMsg =
            remainder > 0
                ? `Confirm disposal of ${quantityValue} of ${assetQuantity} unit(s)? The remaining ${remainder} unit(s) will be split into a new asset record and kept in storage.`
                : 'Confirm disposal action? This cannot be undone.';
        if (confirm(confirmMsg)) {
            post(route('disposals.store', asset.id), { onError: handleServerErrors });
        }
    };

    /* ---------------------------- step renderers --------------------------- */

    function renderTypeStep() {
        if (disposalTypes.length === 0) {
            return <p className="text-sm text-gray-500">No disposal types are available for this asset.</p>;
        }
        return (
            <>
                <div role="radiogroup" aria-label="Disposal type" className="grid gap-3 sm:grid-cols-2">
                    {disposalTypes.map((t) => {
                        const selected = data.disposal_type === t.value;
                        const hint = TYPE_HINTS[t.value];
                        return (
                            <button
                                key={t.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => handleTypeChange(t.value)}
                                className={`flex items-start gap-3 rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                                    selected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                            >
                                <span
                                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                        selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300'
                                    }`}
                                >
                                    {selected && <Check className="h-3 w-3" />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-gray-900">{t.label}</span>
                                    {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <InputError message={fieldError('disposal_type')} className="mt-2" />
            </>
        );
    }

    function renderPiecesField(index: number, errKey: string) {
        const line = data.lines[index];
        const selectedAsset = assetsById.get(line.asset_id);
        const hasPieces = (selectedAsset?.pieces?.length ?? 0) > 0;
        const qtyValue = isDonation ? line.quantity : data.quantity;
        const qty = Number(qtyValue) || 0;
        const onQty = (v: string) => (isDonation ? updateLine(index, 'quantity', v) : setSingleQuantity(v));

        let label = 'Select pieces…';
        if (line.piece_ids?.length) {
            label = `${line.piece_ids.length} piece${line.piece_ids.length !== 1 ? 's' : ''} selected`;
        } else if (qty > 0 && selectedAsset) {
            label = qty === selectedAsset.remaining_quantity ? `All remaining (${qty})` : `${qty} piece(s)`;
        }
        const hasValue = Boolean(line.piece_ids?.length) || qty > 0;

        return (
            <div className="min-w-[150px]">
                <Label>{isDecayed || isFabrication ? 'Pieces to Dispose' : 'Pieces'}</Label>
                {hasPieces ? (
                    <button
                        type="button"
                        onClick={() => selectedAsset && setPiecePickerLine(index)}
                        disabled={!selectedAsset}
                        className={`mt-1 flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 ${
                            fieldError(errKey) ? 'border-red-400' : 'border-gray-300'
                        }`}
                    >
                        <span className={hasValue ? 'text-gray-900' : 'text-gray-400'}>{label}</span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                ) : (
                    <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={selectedAsset?.remaining_quantity}
                        value={qtyValue}
                        onChange={(e) => onQty(e.target.value)}
                        disabled={!selectedAsset}
                        placeholder={!selectedAsset ? 'Select an AAP No. first' : ''}
                        className={inputCls(fieldError(errKey))}
                    />
                )}
                <InputError message={fieldError(errKey)} className="mt-1" />
            </div>
        );
    }

    function renderAssetSummary() {
        const facts: { label: string; value: string }[] = [
            { label: 'Type', value: String(asset.type ?? '') },
            { label: 'Species', value: asset.species ?? '' },
            { label: 'On hand', value: `${assetQuantity} unit(s)` },
        ];

        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">AAP No.</p>
                        <p className="mt-1 break-words text-base font-semibold text-gray-900">{aapOf(asset as any)}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        {assetQuantity} unit(s) on hand
                    </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-200 pt-4 text-sm sm:grid-cols-3">
                    {facts.map((f) => (
                        <div key={f.label} className="min-w-0">
                            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{f.label}</dt>
                            <dd className={`mt-0.5 break-words capitalize ${f.value ? 'text-gray-900' : 'text-gray-400'}`}>
                                {f.value || '—'}
                            </dd>
                        </div>
                    ))}
                    <div className="col-span-2 min-w-0 sm:col-span-3">
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Description</dt>
                        <dd
                            className={`mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere] ${
                                asset.description ? 'text-gray-900' : 'text-gray-400'
                            }`}
                        >
                            {asset.description || '—'}
                        </dd>
                    </div>
                </dl>
            </div>
        );
    }

    function renderAssetStep() {
        if (isDonation) {
            return (
                <>
                    <p className="text-xs text-gray-500">
                        AAP {aapOf(asset as any)} is already added below. Add more log assets to this donation if needed.
                    </p>

                    {data.lines.map((line, index) => {
                        const selectedAsset = assetsById.get(line.asset_id);
                        const options = availableOptionsFor(index);
                        const pieceNums = selectedAsset ? selectedPieceNumbers(line, selectedAsset) : [];
                        const remainingAfter = selectedAsset ? selectedAsset.remaining_quantity - Number(line.quantity) : 0;

                        return (
                            <div key={index} className="rounded-lg border border-gray-200 p-4">
                                <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                                    <div>
                                        <Label htmlFor={`line-asset-${index}`}>AAP No.</Label>
                                        <select
                                            id={`line-asset-${index}`}
                                            value={line.asset_id}
                                            onChange={(e) => updateLine(index, 'asset_id', e.target.value)}
                                            className={selectCls(fieldError(`lines.${index}.asset_id`))}
                                        >
                                            <option value="" disabled>
                                                Select an AAP No.…
                                            </option>
                                            {options.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {aapOf(a)}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError message={fieldError(`lines.${index}.asset_id`)} className="mt-1" />
                                    </div>

                                    {renderPiecesField(index, `lines.${index}.quantity`)}

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

                                {selectedAsset && <PieceBadges numbers={pieceNums} total={selectedAsset.quantity} />}

                                {selectedAsset && Number(line.quantity) > 0 && remainingAfter > 0 && (
                                    <p className="mt-2 text-xs text-amber-700">
                                        The remaining {remainingAfter} pc(s) of {aapOf(selectedAsset)} will stay available for
                                        future disposal.
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
                </>
            );
        }

        if (isDecayed || isFabrication) {
            const line = data.lines[0];
            const pieceNums = mainAsset && line ? selectedPieceNumbers(line, mainAsset) : [];
            return (
                <>
                    {renderAssetSummary()}
                    <div>
                        {renderPiecesField(0, 'quantity')}
                        {mainHasPieces && <PieceBadges numbers={pieceNums} total={asset.quantity} />}
                        {!mainHasPieces && (
                            <p className="mt-1 text-xs text-gray-500">Out of {assetQuantity} unit(s) currently on hand.</p>
                        )}
                    </div>
                </>
            );
        }

        if (isVehicleDecision) {
            return (
                <>
                    {renderAssetSummary()}
                    <p className="text-sm text-gray-600">The whole asset record will be processed.</p>
                </>
            );
        }

        return (
            <>
                {renderAssetSummary()}
                <Field
                    id="quantity"
                    label="Quantity to Dispose"
                    error={fieldError('quantity')}
                    hint={undefined}
                >
                    <Input
                        id="quantity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={assetQuantity}
                        value={data.quantity}
                        onChange={(e) => setField('quantity', e.target.value)}
                        className={inputCls(fieldError('quantity'))}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Out of {assetQuantity} unit(s) currently on hand.
                        {remainder > 0 && (
                            <span className="text-amber-700">
                                {' '}
                                The remaining {remainder} unit(s) will be split off and kept in storage.
                            </span>
                        )}
                    </p>
                </Field>
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
                        placeholder="e.g. Virac Fire Station"
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

                <Field
                    id="donee_position"
                    label="Representative's Position / Title"
                    error={fieldError('donee_position')}
                    hint={'Printed on the Deed of Donation, e.g. "represented by [name], [position]".'}
                >
                    <Input
                        id="donee_position"
                        placeholder="e.g. Acting Municipal Fire Marshal"
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
                        placeholder="e.g. CO-2026-0042"
                        value={data.confiscation_order_reference}
                        onChange={(e) => setField('confiscation_order_reference', e.target.value)}
                        className={inputCls(fieldError('confiscation_order_reference'))}
                    />
                </Field>
            </>
        );
    }

    function renderDeliveryStep() {
        return (
            <>
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
                        <Label htmlFor="street">Street / House No.</Label>
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
                    <p className="mt-1 text-xs text-gray-500">
                        Where the donated logs will be brought, for visualization on the asset record.
                    </p>
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
                {pair(
                    'donor_representative_name',
                    'donor_representative_title',
                    'OIC / PENR Officer Name',
                    'OIC / PENR Officer Title',
                    'OIC Name',
                    'e.g. OIC, PENR Officer',
                )}
                {pair('witness_1_name', 'witness_1_title', 'Witness 1 Name', 'Witness 1 Title', 'Witness 1 Name', 'Witness 1 Title')}
                {pair('witness_2_name', 'witness_2_title', 'Witness 2 Name', 'Witness 2 Title', 'Witness 2 Name', 'Witness 2 Title')}
            </div>
        );
    }

    function renderDecayStep() {
        return (
            <>
                <Field id="cause_of_decay" label="Cause of Decay" error={fieldError('cause_of_decay')}>
                    <select
                        id="cause_of_decay"
                        value={data.cause_of_decay}
                        onChange={(e) => setField('cause_of_decay', e.target.value)}
                        className={selectCls(fieldError('cause_of_decay'))}
                    >
                        <option value="" disabled>
                            Select cause…
                        </option>
                        {DECAY_CAUSES.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </Field>

                {data.cause_of_decay === 'Other' && (
                    <Field id="cause_of_decay_other" label="Specify Cause" error={fieldError('cause_of_decay_other')}>
                        <Input
                            id="cause_of_decay_other"
                            placeholder="Describe the cause of decay"
                            value={data.cause_of_decay_other}
                            onChange={(e) => setField('cause_of_decay_other', e.target.value)}
                            className={inputCls(fieldError('cause_of_decay_other'))}
                        />
                    </Field>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <Field id="inspection_date" label="Inspection Date" error={fieldError('inspection_date')}>
                        <Input
                            id="inspection_date"
                            type="date"
                            value={data.inspection_date}
                            onChange={(e) => setField('inspection_date', e.target.value)}
                            className={inputCls(fieldError('inspection_date'))}
                        />
                    </Field>
                    <Field id="inspecting_officer" label="Inspecting Officer" error={fieldError('inspecting_officer')}>
                        <Input
                            id="inspecting_officer"
                            placeholder="Full name of the inspecting officer"
                            value={data.inspecting_officer}
                            onChange={(e) => setField('inspecting_officer', e.target.value)}
                            className={inputCls(fieldError('inspecting_officer'))}
                        />
                    </Field>
                </div>

                <Field
                    id="decay_photo"
                    label="Photo Evidence"
                    optional
                    error={fieldError('decay_photo')}
                    hint="Max 8 MB. Will be embedded in the generated Decay Report PDF."
                >
                    <input
                        id="decay_photo"
                        type="file"
                        accept="image/*"
                        className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
                        onChange={(e) => setField('decay_photo', e.target.files?.[0] ?? null)}
                    />
                </Field>
            </>
        );
    }

    function renderFabricationStep() {
        const num = (key: 'lumber_used_bd_ft' | 'usable_remainder_bd_ft' | 'scrap_bd_ft', label: string, optional?: boolean, hint?: string) => (
            <Field id={key} label={label} optional={optional} hint={hint} error={fieldError(key)}>
                <Input
                    id={key}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={data[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    className={inputCls(fieldError(key))}
                />
            </Field>
        );

        return (
            <>
                <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                    <Field id="fabricated_item" label="What Was Fabricated" error={fieldError('fabricated_item')}>
                        <Input
                            id="fabricated_item"
                            placeholder="e.g. Office table, chair, cabinet"
                            value={data.fabricated_item}
                            onChange={(e) => setField('fabricated_item', e.target.value)}
                            className={inputCls(fieldError('fabricated_item'))}
                        />
                    </Field>
                    <Field id="fabricated_item_count" label="No. of Finished Items" error={fieldError('fabricated_item_count')}>
                        <Input
                            id="fabricated_item_count"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={data.fabricated_item_count}
                            onChange={(e) => setField('fabricated_item_count', e.target.value)}
                            className={inputCls(fieldError('fabricated_item_count'))}
                        />
                    </Field>
                </div>

                <Field id="fabrication_date" label="Fabrication / Completion Date" error={fieldError('fabrication_date')}>
                    <Input
                        id="fabrication_date"
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        value={data.fabrication_date}
                        onChange={(e) => setField('fabrication_date', e.target.value)}
                        className={inputCls(fieldError('fabrication_date'))}
                    />
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                    <Field id="fabrication_location" label="Workshop / Location" error={fieldError('fabrication_location')}>
                        <Input
                            id="fabrication_location"
                            placeholder="e.g. PENRO carpentry shop"
                            value={data.fabrication_location}
                            onChange={(e) => setField('fabrication_location', e.target.value)}
                            className={inputCls(fieldError('fabrication_location'))}
                        />
                    </Field>
                    <Field id="fabricator_name" label="Responsible Officer / Fabricator" error={fieldError('fabricator_name')}>
                        <Input
                            id="fabricator_name"
                            placeholder="Full name"
                            value={data.fabricator_name}
                            onChange={(e) => setField('fabricator_name', e.target.value)}
                            className={inputCls(fieldError('fabricator_name'))}
                        />
                    </Field>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Lumber (board feet)</p>
                    <div className="grid gap-4 md:grid-cols-3">
                        {num('lumber_used_bd_ft', 'Lumber Used')}
                        {num('usable_remainder_bd_ft', 'Usable Remainder', true)}
                        {num('scrap_bd_ft', 'Scrap', true)}
                    </div>
                </div>

                <Field
                    id="fabrication_attachments"
                    label="Photos / Documents"
                    optional
                    error={fieldError('fabrication_attachments')}
                    hint={`Up to ${MAX_FAB_FILES} files, 8 MB each. Images, PDF or Word.`}
                >
                    <input
                        id="fabrication_attachments"
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                        className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
                        onChange={(e) => setField('fabrication_attachments', Array.from(e.target.files ?? []))}
                    />
                    {/* Server errors come back keyed per file, e.g. fabrication_attachments.0 */}
                    {Object.entries(serverErrors)
                        .filter(([k]) => k.startsWith('fabrication_attachments.'))
                        .map(([k, m]) => (
                            <InputError key={k} message={m} className="mt-1" />
                        ))}
                </Field>
            </>
        );
    }

    function renderAppealStep() {
        return (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {asset.appeal_deadline ? (
                    <p>
                        15-day appeal window {appealDeadlinePassed ? 'closed' : 'closes'} on{' '}
                        <span className="font-medium">{new Date(asset.appeal_deadline).toLocaleDateString()}</span>. Release
                        depends on whether the owner appealed within this window; forfeiture is the default absent a timely
                        appeal, subject to the judge or regional office decision, since PENRO Catanduanes lacks jurisdiction.
                    </p>
                ) : (
                    <p>No appeal deadline is recorded for this asset yet.</p>
                )}
                <label className="mt-3 flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={data.appeal_filed}
                        onChange={(e) => setField('appeal_filed', e.target.checked)}
                    />
                    <span>Owner filed an appeal within the window</span>
                </label>
                <InputError message={fieldError('appeal_filed')} className="mt-1" />
            </div>
        );
    }

    function renderReviewStep() {
        const allServerMessages = Object.values(serverErrors);
        const line0 = data.lines[0];

        return (
            <>
                {allServerMessages.length > 0 && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <p className="font-medium">The server could not process this disposal:</p>
                        <ul className="mt-1 list-disc pl-5">
                            {allServerMessages.map((m, i) => (
                                <li key={i}>{m}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <ReviewSection title="Disposal" onEdit={() => goToStep('type')}>
                    <ReviewRow label="Disposal type" value={typeLabel} />
                </ReviewSection>

                <ReviewSection title={isDonation ? 'Assets' : 'Asset'} onEdit={() => goToStep('asset')}>
                    {isDonation ? (
                        data.lines.map((line, i) => {
                            const a = assetsById.get(line.asset_id);
                            if (!a) return null;
                            const nums = selectedPieceNumbers(line, a);
                            const left = a.remaining_quantity - Number(line.quantity);
                            return (
                                <div key={i} className="rounded-md bg-gray-50 p-3 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-medium text-gray-900">{aapOf(a)}</span>
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
                        })
                    ) : (
                        <>
                            <ReviewRow label="AAP No." value={`${aapOf(asset as any)} (${asset.type})`} />
                            {!isVehicleDecision && (
                                <>
                                    <ReviewRow label="Quantity to dispose" value={`${quantityValue} of ${assetQuantity} unit(s)`} />
                                    {(isDecayed || isFabrication) && mainAsset && line0 && selectedPieceNumbers(line0, mainAsset).length > 0 && (
                                        <PieceBadges numbers={selectedPieceNumbers(line0, mainAsset)} total={asset.quantity} />
                                    )}
                                    {remainder > 0 && (
                                        <p className="text-xs text-amber-700">
                                            The remaining {remainder} unit(s) will be split into a new asset record and kept in
                                            storage.
                                        </p>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </ReviewSection>

                {isDonation && (
                    <>
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
                            <ReviewRow label="Position / title" value={data.donee_position} />
                            <ReviewRow label="Purpose" value={data.purpose_statement} />
                            <ReviewRow label="Confiscation order ref." value={data.confiscation_order_reference} />
                        </ReviewSection>

                        <ReviewSection title="Delivery" onEdit={() => goToStep('delivery')}>
                            <ReviewRow
                                label="Address"
                                value={[data.street, data.barangay, data.municipality].filter(Boolean).join(', ')}
                            />
                            <ReviewRow label="Coordinates" value={data.delivery_coordinates} />
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
                    </>
                )}

                {isDecayed && (
                    <ReviewSection title="Decay details" onEdit={() => goToStep('decay')}>
                        <ReviewRow
                            label="Cause of decay"
                            value={data.cause_of_decay === 'Other' ? `Other: ${data.cause_of_decay_other}` : data.cause_of_decay}
                        />
                        <ReviewRow label="Inspection date" value={data.inspection_date} />
                        <ReviewRow label="Inspecting officer" value={data.inspecting_officer} />
                        <ReviewRow label="Photo evidence" value={data.decay_photo?.name ?? 'None'} />
                    </ReviewSection>
                )}

                {isFabrication && (
                    <ReviewSection title="Fabrication details" onEdit={() => goToStep('fabrication')}>
                        <ReviewRow label="Item fabricated" value={data.fabricated_item} />
                        <ReviewRow label="Finished items" value={data.fabricated_item_count} />
                        <ReviewRow
                            label="Fabrication date"
                            value={data.fabrication_date ? new Date(data.fabrication_date + 'T00:00:00').toLocaleDateString() : ''}
                        />
                        <ReviewRow label="Workshop / location" value={data.fabrication_location} />
                        <ReviewRow label="Fabricator / officer" value={data.fabricator_name} />
                        <ReviewRow label="Lumber used" value={data.lumber_used_bd_ft ? `${data.lumber_used_bd_ft} bd.ft` : ''} />
                        <ReviewRow
                            label="Usable remainder"
                            value={data.usable_remainder_bd_ft ? `${data.usable_remainder_bd_ft} bd.ft` : ''}
                        />
                        <ReviewRow label="Scrap" value={data.scrap_bd_ft ? `${data.scrap_bd_ft} bd.ft` : ''} />
                        <ReviewRow
                            label="Supporting files"
                            value={data.fabrication_attachments.map((f) => f.name).join(', ') || 'None'}
                        />
                        <p className="text-xs text-gray-500">The ICS and PAR will be generated automatically when you confirm.</p>
                    </ReviewSection>
                )}

                {isVehicleDecision && (
                    <ReviewSection title="Appeal" onEdit={() => goToStep('appeal')}>
                        <ReviewRow
                            label="Appeal deadline"
                            value={asset.appeal_deadline ? new Date(asset.appeal_deadline).toLocaleDateString() : 'Not recorded'}
                        />
                        <ReviewRow label="Owner filed an appeal" value={data.appeal_filed ? 'Yes' : 'No'} />
                    </ReviewSection>
                )}

                <Field id="notes" label="Notes" optional error={fieldError('notes')}>
                    <Input
                        id="notes"
                        value={data.notes}
                        onChange={(e) => setField('notes', e.target.value)}
                        className={inputCls(fieldError('notes'))}
                    />
                </Field>

                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Confirming will process this disposal. This cannot be undone.
                </div>
            </>
        );
    }

    function renderStep() {
        switch (currentStepId) {
            case 'type':
                return renderTypeStep();
            case 'asset':
                return renderAssetStep();
            case 'recipient':
                return renderRecipientStep();
            case 'delivery':
                return renderDeliveryStep();
            case 'signatories':
                return renderSignatoriesStep();
            case 'decay':
                return renderDecayStep();
            case 'fabrication':
                return renderFabricationStep();
            case 'appeal':
                return renderAppealStep();
            case 'review':
                return renderReviewStep();
        }
    }

    /* ------------------------------- piece picker -------------------------- */

    const pickerLine = piecePickerLine !== null ? data.lines[piecePickerLine] : null;
    const pickerAsset = pickerLine ? assetsById.get(pickerLine.asset_id) : null;

    /* --------------------------------- render ------------------------------ */

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Process Disposal</h2>}>
            <Head title="Process Disposal" />

            <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-4 px-4 sm:px-6 lg:px-8">
                <p className="mb-4 text-sm text-gray-600">
                    AAP No.: <strong>{aapOf(asset as any)}</strong> ({asset.type}) — {assetQuantity} unit(s) on hand
                </p>

                <StepIndicator steps={stepList} current={safeIndex} onJump={(i) => { setShowErrors(false); setStepIndex(i); }} />

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
                            <Link href={route('assets.show', asset.id)}>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </Link>
                        </div>

                        {isLast ? (
                            <Button key="submit" type="submit" disabled={processing}>
                                Confirm Disposal
                            </Button>
                        ) : (
                            <Button key="next" type="button" onClick={goNext}>
                                Next
                                <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </form>
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
                    assetCode={aapOf(pickerAsset)}
                    totalPieces={pickerAsset.quantity}
                    pieces={pickerAsset.pieces}
                    selectedIds={pickerLine.piece_ids ?? []}
                    onClose={() => setPiecePickerLine(null)}
                    onConfirm={(ids) => {
                        const idx = piecePickerLine;
                        setData((prev) => {
                            const next = [...prev.lines];
                            next[idx] = { ...next[idx], piece_ids: ids, quantity: String(ids.length) };
                            return {
                                ...prev,
                                lines: next,
                                ...(isDonation ? {} : { quantity: String(ids.length) }),
                            };
                        });
                        clearErrors(isDonation ? (`lines.${idx}.quantity` as any) : 'quantity');
                        setPiecePickerLine(null);
                    }}
                />
            )}
        </AuthenticatedLayout>
    );
}