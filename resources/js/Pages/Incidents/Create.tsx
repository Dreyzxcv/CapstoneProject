import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Shield, Trash2, Truck, X, ChevronRight, ChevronLeft, Check, Copy, Calculator } from 'lucide-react';
import CoordinatesPickerModal from '@/Components/shared/CoordinatesPickerModal';
import { IncidentLocationMap } from '@/Components/shared/IncidentLocationMap';

// ── Types ────────────────────────────────────────────────────────────────────

interface Option { value: string; label: string; }
interface MarketPriceEntry { species: string; year: number; price_per_bd_ft: string; }

interface CreateProps {
    types: Option[];
    modes: Option[];
    municipalities: Option[];
    barangaysByMunicipality: Record<string, string[]>;
    nextAssetSequence: number;
    marketPrices: MarketPriceEntry[];
}

interface PieceRow {
    species: string;
    equipment_type: string;
    vehicle_type: string;
    speciesIsOther: boolean;
    description: string;
    length: string;
    width: string;
    height: string;
    volume_bd_ft: string;
    volume_cu_m: string;
    estimated_value: string;
    estimated_value_auto: boolean;
    plate_number: string;
    serial_number: string;
}

interface AssetRow {
    type: string;
    apprehending_agency: string;
    municipality_of_origin: string;
    location_apprehended: string;
    mode: string;
    pieces: PieceRow[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const SPECIES_OPTIONS = [
    'Narra','Coco Lumber','Mahogany','Molave','Yakal','Ipil',
    'Kamagong','Tanguile','Lauan','Apitong','Gmelina','Falcata','Bamboo','Others',
];
const EQUIPMENT_OPTIONS = [
    'Chainsaw','Power Saw','Handheld Circular Saw','Winch / Cable Puller',
    'Hand Tools (Axe, Bolo, Wedge)','Others',
];
const BD_FT_TO_CU_M = 0.002359737;

// Soft pulsing highlight used to guide the user to the next required field.
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

// ── Valid ID types with optional prefix and placeholder ──────────────────────

interface ValidIdConfig {
    label: string;
    prefix?: string; 
    placeholder?: string; 
}

const VALID_IDS: ValidIdConfig[] = [
    { label: 'PhilSys (National ID)',                         placeholder: '0000-0000-0000-0000' },
    { label: "Driver's License",                              placeholder: 'e.g. N12-34-567890' },
    { label: 'Passport',                                      placeholder: 'e.g. P1234567A' },
    { label: "Voter's ID",                                    placeholder: 'Enter ID number' },
    { label: 'PRC ID',                                        placeholder: 'Enter PRC ID number' },
    { label: 'SSS ID',                                        placeholder: 'Enter SSS number' },
    { label: 'GSIS ID',                                       placeholder: 'Enter GSIS ID number' },
    { label: 'Senior Citizen ID',                             placeholder: 'Enter SC ID number' },
    { label: 'PWD ID',                                        placeholder: 'Enter PWD ID number' },
    { label: 'NBI Clearance',                                 placeholder: 'Enter clearance number' },
    { label: 'Others' },
];

const STEPS = [
    { id: 1, label: 'Intake Mode',       description: 'How the asset reached MES' },
    { id: 2, label: 'Incident Details',  description: 'Location, parties & claimant' },
    { id: 3, label: 'Assets & Pieces',   description: 'Items and measurements' },
    { id: 4, label: 'Review',            description: 'Confirm before recording' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const selectClass =
    'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

function emptyPieceRow(species = ''): PieceRow {
    return {
        species, equipment_type: '', vehicle_type: '', speciesIsOther: false,
        description: '', length: '', width: '', height: '',
        volume_bd_ft: '', volume_cu_m: '', estimated_value: '',
        estimated_value_auto: false, plate_number: '', serial_number: '',
    };
}

function emptyAssetRow(defaults: { municipality: string; agency: string; mode: string }): AssetRow {
    return {
        type: 'log',
        apprehending_agency: defaults.agency,
        municipality_of_origin: defaults.municipality,
        location_apprehended: defaults.municipality,
        mode: defaults.mode,
        pieces: [emptyPieceRow()],
    };
}

function convertBdFtToCuM(bdFt: string): string {
    const v = parseFloat(bdFt);
    return Number.isNaN(v) || v <= 0 ? '' : (v * BD_FT_TO_CU_M).toFixed(4);
}

function calculateBdFt(l: string, w: string, h: string): string {
    const [lv, wv, hv] = [l, w, h].map(parseFloat);
    return [lv, wv, hv].some((v) => Number.isNaN(v) || v <= 0) ? '' : ((lv * wv * hv) / 12).toFixed(2);
}

function speciesFieldLabel(type: string): string {
    if (type === 'vehicle')   return 'Conveyance / Vehicle Type';
    if (type === 'equipment') return 'Equipment Type';
    return 'Species';
}

function speciesFieldPlaceholder(type: string): string {
    if (type === 'vehicle')   return 'e.g. Motorcycle, Tricycle, Habal-habal';
    if (type === 'equipment') return 'e.g. Chainsaw, Power Saw';
    return 'Enter species';
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
    return (
        <div className="w-full">
            {/* Mobile: compact pill */}
            <div className="flex items-center justify-between sm:hidden px-1 mb-6">
                <span className="text-sm font-semibold text-emerald-700">
                    Step {current} of {STEPS.length}
                </span>
                <span className="text-sm text-gray-500">{STEPS[current - 1].label}</span>
            </div>

            {/* Desktop: full stepper */}
            <nav className="hidden sm:flex items-center mb-8" aria-label="Form steps">
                {STEPS.map((step, idx) => {
                    const done    = current > step.id;
                    const active  = current === step.id;
                    const upcoming = current < step.id;

                    return (
                        <div key={step.id} className="flex items-center flex-1 last:flex-none">
                            {/* Circle + label */}
                            <div className="flex flex-col items-center gap-1 min-w-0">
                                <div
                                    className={[
                                        'flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-semibold shrink-0 transition-colors',
                                        done    ? 'border-emerald-600 bg-emerald-600 text-white'         : '',
                                        active  ? 'border-emerald-600 bg-white text-emerald-700'         : '',
                                        upcoming? 'border-gray-300 bg-white text-gray-400'               : '',
                                    ].join(' ')}
                                >
                                    {done ? <Check className="h-4 w-4" /> : step.id}
                                </div>
                                <div className="text-center leading-tight">
                                    <p className={`text-xs font-semibold truncate ${active ? 'text-emerald-700' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                                        {step.label}
                                    </p>
                                    <p className={`text-[11px] truncate ${active ? 'text-gray-500' : 'text-gray-300'}`}>
                                        {step.description}
                                    </p>
                                </div>
                            </div>

                            {/* Connector line */}
                            {idx < STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-colors ${done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* Progress bar (mobile) */}
            <div className="sm:hidden h-1.5 w-full bg-gray-100 rounded-full mb-6 overflow-hidden">
                <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${((current - 1) / (STEPS.length - 1)) * 100}%` }}
                />
            </div>
        </div>
    );
}

// ── Navigation bar ────────────────────────────────────────────────────────────

function StepNav({
    step, totalSteps, onBack, onNext, nextLabel = 'Continue', nextDisabled = false, processing = false, highlightNext = false,
}: {
    step: number; totalSteps: number;
    onBack?: () => void; onNext?: () => void;
    nextLabel?: string; nextDisabled?: boolean; processing?: boolean; highlightNext?: boolean;
}) {
    const highlightClass = highlightNext && !nextDisabled ? 'nf-highlight' : undefined;
    return (
        <div className="flex items-center justify-between pt-2 pb-8">
            <div>
                {step > 1 && (
                    <Button type="button" variant="outline" onClick={onBack}>
                        <ChevronLeft className="mr-1.5 h-4 w-4" />
                        Back
                    </Button>
                )}
            </div>
            <div className="flex gap-3">
                <Link href={route('assets.index')}>
                    <Button type="button" variant="ghost" className="text-gray-500">Cancel</Button>
                </Link>
                {step < totalSteps ? (
                    <Button type="button" onClick={onNext} disabled={nextDisabled} className={highlightClass}>
                        {nextLabel}
                        <ChevronRight className="ml-1.5 h-4 w-4" />
                    </Button>
                ) : (
                    <Button type="button" onClick={onNext} disabled={processing || nextDisabled} className={highlightClass}>
                        {processing ? 'Recording…' : 'Confirm & Record'}
                    </Button>
                )}
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IncidentsCreate({
    types, modes, municipalities, barangaysByMunicipality, nextAssetSequence, marketPrices,
}: CreateProps) {
    const defaultAgency = 'PENRO Catanduanes MES';

    const [step, setStep] = useState(1);
    const [showCoordinatesPicker, setShowCoordinatesPicker] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showAddressPicker, setShowAddressPicker] = useState(false);
    const [addressMunicipality, setAddressMunicipality] = useState('');
    const [addressBarangay, setAddressBarangay] = useState('');
    const [idTypeIsOthers, setIdTypeIsOthers] = useState(false);
    const [coordsMode, setCoordsMode] = useState<'map' | 'manual'>('map');
    const DRAFT_KEY = 'forestrack_incident_draft';
    const [showRestoreDraft, setShowRestoreDraft] = useState(false);
    const [savedDraft, setSavedDraft] = useState<{ data: typeof data; step: number } | null>(null);

    const { data, setData, post, processing, errors, transform } = useForm({
        intake_mode: '',
        date_of_apprehension: '',
        place_of_apprehension: '',
        area: '',
        coordinates: '',
        has_claimant: null as boolean | null,   // null = user hasn't chosen yet
        claimant_offender_name: '',
        claimant_address: '',
        claimant_contact_number: '',
        claimant_id_type: '',
        claimant_id_number: '',
        has_ongoing_case: false as boolean,
        has_confiscation_order: false as boolean,
        has_confiscation_order_file: null as File | null,
        apprehending_parties: ['PENRO Catanduanes MES'] as string[],
        initial_custodian_name: '',
        date_report_submitted: '',
        assets: [emptyAssetRow({ municipality: '', agency: defaultAgency, mode: '' })] as AssetRow[],
    });

    useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                // Ask user if they want to restore
                setShowRestoreDraft(true);
                setSavedDraft(parsed);
            }
        } catch {}
    }, []);

    // Save draft on every data change
    useEffect(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, step }));
        } catch {}
    }, [data, step]);

    const marketPriceMap = useMemo(() => {
        const map: Record<string, number> = {};
        marketPrices.forEach((mp) => { map[`${mp.species}|${mp.year}`] = Number(mp.price_per_bd_ft); });
        return map;
    }, [marketPrices]);

    const apprehensionYear = data.date_of_apprehension
        ? new Date(data.date_of_apprehension).getFullYear() : null;

    const previewYear = data.date_report_submitted
        ? new Date(data.date_report_submitted).getFullYear() : null;
    const previewPrefix = data.intake_mode === 'turned_over' ? 'TO' : data.intake_mode === 'apprehended' ? 'AP' : null;
    const previewCode = previewYear && previewPrefix
        ? `${previewPrefix}-${previewYear}-${String(nextAssetSequence).padStart(5, '0')}` : null;

    // ── Piece helpers ────────────────────────────────────────────────────────

    function withPieceAutoEstimate(piece: PieceRow, species: string, year: number | null): PieceRow {
        if (piece.speciesIsOther || !species || !year) return { ...piece, estimated_value_auto: false };
        const price = marketPriceMap[`${species}|${year}`];
        const volume = parseFloat(piece.volume_bd_ft);
        if (price === undefined || Number.isNaN(volume) || volume <= 0) return { ...piece, estimated_value_auto: false };
        return { ...piece, estimated_value: (volume * price).toFixed(2), estimated_value_auto: true };
    }

    function updatePiece(ai: number, pi: number, fields: Partial<PieceRow>, recompute = false) {
        const nextAssets = [...data.assets];
        const nextPieces = [...nextAssets[ai].pieces];
        let updated = { ...nextPieces[pi], ...fields };
        if (recompute) updated = withPieceAutoEstimate(updated, updated.species, apprehensionYear);
        nextPieces[pi] = updated;
        nextAssets[ai] = { ...nextAssets[ai], pieces: nextPieces };
        setData('assets', nextAssets);
    }

    function handlePieceDimensionChange(ai: number, pi: number, field: 'length'|'width'|'height', value: string) {
        const piece  = data.assets[ai].pieces[pi];
        const updated = { ...piece, [field]: value };
        if (data.assets[ai].type === 'log') {
            const bdFt = calculateBdFt(updated.length, updated.width, updated.height);
            updated.volume_bd_ft = bdFt;
            updated.volume_cu_m  = convertBdFtToCuM(bdFt);
            const withEst = withPieceAutoEstimate(updated, updated.species, apprehensionYear);
            const nextAssets = [...data.assets];
            const nextPieces = [...nextAssets[ai].pieces];
            nextPieces[pi] = withEst;
            nextAssets[ai] = { ...nextAssets[ai], pieces: nextPieces };
            setData('assets', nextAssets);
            return;
        }
        updatePiece(ai, pi, { [field]: value });
    }

    function handlePieceVolumeBdFtChange(ai: number, pi: number, value: string) {
        updatePiece(ai, pi, { volume_bd_ft: value, volume_cu_m: convertBdFtToCuM(value) }, true);
    }

    function handlePieceSpeciesSelect(ai: number, pi: number, value: string) {
        if (value === 'Others') updatePiece(ai, pi, { species: '', speciesIsOther: true, estimated_value_auto: false });
        else updatePiece(ai, pi, { species: value, speciesIsOther: false }, true);
    }

    function handlePieceEquipmentSelect(ai: number, pi: number, value: string) {
        if (value === 'Others') updatePiece(ai, pi, { equipment_type: '', speciesIsOther: true });
        else updatePiece(ai, pi, { equipment_type: value, speciesIsOther: false });
    }

    function addPiece(ai: number) {
        const asset = data.assets[ai];
        const last = asset.pieces[asset.pieces.length - 1];
        const inherited = last?.speciesIsOther ? '' : (last?.species ?? '');
        const nextAssets = [...data.assets];
        nextAssets[ai] = { ...nextAssets[ai], pieces: [...asset.pieces, emptyPieceRow(inherited)] };
        setData('assets', nextAssets);
    }

    function removePiece(ai: number, pi: number) {
        if (data.assets[ai].pieces.length === 1) return;
        const nextAssets = [...data.assets];
        nextAssets[ai] = { ...nextAssets[ai], pieces: data.assets[ai].pieces.filter((_, i) => i !== pi) };
        setData('assets', nextAssets);
    }

    function duplicatePiece(ai: number, pi: number) {
        const asset = data.assets[ai];
        const original = asset.pieces[pi];
        const copy: PieceRow = { ...original, estimated_value_auto: false };
        const nextAssets = [...data.assets];
        const nextPieces = [...nextAssets[ai].pieces];
        nextPieces.splice(pi + 1, 0, copy);
        nextAssets[ai] = { ...nextAssets[ai], pieces: nextPieces };
        setData('assets', nextAssets);
    }

    // ── Asset helpers ────────────────────────────────────────────────────────

    function updateAsset(index: number, field: keyof AssetRow, value: string | boolean) {
        const next = [...data.assets];
        next[index] = { ...next[index], [field]: value } as AssetRow;
        setData('assets', next);
    }

    function addAssetRow() {
        const usedTypes = data.assets.map((a) => a.type);
        const firstUnused = types.find((t) => !usedTypes.includes(t.value))?.value ?? types[0].value;
        setData('assets', [
            ...data.assets,
            { ...emptyAssetRow({ municipality: data.place_of_apprehension, agency: defaultAgency, mode: data.intake_mode }), type: firstUnused },
        ]);
    }

    function removeAssetRow(index: number) {
        if (data.assets.length === 1) return;
        setData('assets', data.assets.filter((_, i) => i !== index));
    }

    const usedTypes  = (ci: number) => data.assets.filter((_, i) => i !== ci).map((a) => a.type);
    const availableTypes = (ci: number) => types.filter((t) => !usedTypes(ci).includes(t.value));

    // ── Incident-level helpers ───────────────────────────────────────────────

    function handleMunicipalityChange(value: string) {
        setData('place_of_apprehension', value);
        setData('assets', data.assets.map((a) => ({ ...a, municipality_of_origin: value, location_apprehended: value })));
    }

    function handleIntakeModeChange(value: string) {
        setData((prev) => ({
            ...prev,
            intake_mode: value,
            has_claimant: value === 'turned_over'
                ? false
                : (prev.intake_mode === 'turned_over' ? null : prev.has_claimant),
            claimant_offender_name: value === 'turned_over' ? '' : prev.claimant_offender_name,
            claimant_address: value === 'turned_over' ? '' : prev.claimant_address,
            claimant_contact_number: value === 'turned_over' ? '' : prev.claimant_contact_number,
            claimant_id_type: value === 'turned_over' ? '' : prev.claimant_id_type,
            claimant_id_number: value === 'turned_over' ? '' : prev.claimant_id_number,
            assets: prev.assets.map((a) => ({ ...a, mode: value })),
        }));
    }

    function handleDateOfApprehensionChange(value: string) {
        setData((prev) => {
            const year = value ? new Date(value).getFullYear() : null;
            return {
                ...prev,
                date_of_apprehension: value,
                assets: prev.assets.map((a) => ({
                    ...a,
                    pieces: a.pieces.map((p) => withPieceAutoEstimate(p, p.species, year)),
                })),
            };
        });
    }

    function addApprehendingParty() { setData('apprehending_parties', [...data.apprehending_parties, '']); }
    function updateApprehendingParty(i: number, v: string) {
        const next = [...data.apprehending_parties]; next[i] = v; setData('apprehending_parties', next);
    }
    function removeApprehendingParty(i: number) {
        if (data.apprehending_parties.length === 1) return;
        setData('apprehending_parties', data.apprehending_parties.filter((_, idx) => idx !== i));
    }

    function handleClaimantToggle(has: boolean) {
        if (!has) setIdTypeIsOthers(false);
        setData((prev) => ({
            ...prev, has_claimant: has,
            claimant_offender_name: has ? prev.claimant_offender_name : '',
            claimant_address: has ? prev.claimant_address : '',
            claimant_contact_number: has ? prev.claimant_contact_number : '',
            claimant_id_type: has ? prev.claimant_id_type : '',
            claimant_id_number: has ? prev.claimant_id_number : '',
        }));
    }

    function labelFor(opts: Option[], value: string) { return opts.find((o) => o.value === value)?.label ?? value; }

    function assetError(i: number, f: string) { return (errors as Record<string,string>)[`assets.${i}.${f}`]; }
    function pieceError(ai: number, pi: number, f: string) { return (errors as Record<string,string>)[`assets.${ai}.pieces.${pi}.${f}`]; }

    // ── Step validation (lightweight, prevents accidental skip) ──────────────

    function canProceedStep1() { return !!data.intake_mode; }
    function canProceedStep2() {
        return !!(
            data.date_of_apprehension &&
            data.date_report_submitted &&
            data.place_of_apprehension &&
            data.area &&
            data.coordinates &&
            data.apprehending_parties.some((p) => p.trim() !== '') &&
            (data.intake_mode === 'turned_over' ||
                (data.has_claimant !== null &&
                    (!data.has_claimant || (data.claimant_offender_name && data.claimant_address)))) &&
            (!data.has_confiscation_order || !!data.has_confiscation_order_file)
        );
    }
    function canProceedStep3() {
        return data.assets.every((a) =>
            a.pieces.every((p) => {
                if (a.type === 'log')       return p.species && p.volume_bd_ft && p.estimated_value;
                if (a.type === 'vehicle')   return p.vehicle_type && p.plate_number;
                if (a.type === 'equipment') return p.equipment_type;
                return true;
            })
        );
    }

    // ── Guided highlight: returns the key of the NEXT required field ─────────
    // Order here = the order the user is guided through. Returns 'next_btn'
    // once everything required on the current step is filled.

    function getNextTarget(): string {
        if (step === 1) return data.intake_mode ? 'next_btn' : 'intake_mode';

        if (step === 2) {
            const isTurnedOver = data.intake_mode === 'turned_over';
            if (!data.date_of_apprehension)   return 'date_of_apprehension';
            if (!data.date_report_submitted)  return 'date_report_submitted';
            if (!data.place_of_apprehension)  return 'place_of_apprehension';
            if (!data.area)                   return 'area';
            if (!data.coordinates)            return 'coordinates';
            if (!data.apprehending_parties.some((p) => p.trim() !== '')) return 'apprehending_party';
            if (!isTurnedOver && data.has_claimant === null) return 'claimant_choice';
            if (!isTurnedOver && data.has_claimant) {
                if (!data.claimant_offender_name) return 'claimant_name';
                if (!data.claimant_address)       return 'claimant_address';
            }
            if (!isTurnedOver && data.has_confiscation_order && !data.has_confiscation_order_file) {
                return 'confiscation_file';
            }
            return 'next_btn';
        }

        if (step === 3) {
            for (let ai = 0; ai < data.assets.length; ai++) {
                const asset = data.assets[ai];
                for (let pi = 0; pi < asset.pieces.length; pi++) {
                    const p = asset.pieces[pi];
                    const k = (f: string) => `piece:${ai}:${pi}:${f}`;
                    if (asset.type === 'log') {
                        if (!p.species) return k('species');
                        for (const dim of ['length', 'width', 'height'] as const) {
                            const v = parseFloat(p[dim]);
                            if (Number.isNaN(v) || v <= 0) return k(dim);
                        }
                        if (!p.estimated_value) return k('estimated_value');
                    } else if (asset.type === 'vehicle') {
                        if (!p.vehicle_type)  return k('vehicle_type');
                        if (!p.plate_number)  return k('plate_number');
                    } else if (asset.type === 'equipment') {
                        if (!p.equipment_type) return k('equipment_type');
                    }
                }
            }
            return 'next_btn';
        }

        return 'next_btn';
    }

    function handleNext() {
        if (step === 1 && canProceedStep1()) setStep(2);
        else if (step === 2 && canProceedStep2()) setStep(3);
        else if (step === 3 && canProceedStep3()) setStep(4);
        else if (step === 4) setShowConfirmModal(true);
    }

    function confirmAndSubmit() {
        transform((fd) => ({
            ...fd,
            apprehending_party: fd.apprehending_parties.filter((p) => p.trim() !== '').join('; '),
        }));
        post(route('incidents.store'), {
            forceFormData: true,   // ← add this
            onSuccess: () => {
                setShowConfirmModal(false);
                try { localStorage.removeItem(DRAFT_KEY); } catch {}
            },
        });
    }

    // Current highlight target + helper used by every field below.
    const nextTarget = getNextTarget();
    const hl = (key: string) => (nextTarget === key ? 'nf-highlight' : '');

    // ── Piece form ────────────────────────────────────────────────────────────

    function renderPieceForm(asset: AssetRow, ai: number, pi: number) {
        const piece     = asset.pieces[pi];
        const isLog     = asset.type === 'log';
        const isVehicle = asset.type === 'vehicle';
        const pk = (f: string) => `piece:${ai}:${pi}:${f}`;

        return (
            <div key={pi} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Piece {pi + 1}</span>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => duplicatePiece(ai, pi)}>
                            <Copy className="h-3.5 w-3.5 mr-1" />Duplicate
                        </Button>
                        {asset.pieces.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removePiece(ai, pi)}>
                                <X className="h-3.5 w-3.5 mr-1" />Remove
                            </Button>
                        )}
                    </div>
                </div>

                {/* Species / type */}
                <div className="space-y-2">
                    <Label>{speciesFieldLabel(asset.type)}<span className="text-red-500">*</span></Label>
                    {isLog ? (
                        piece.speciesIsOther ? (
                            <div className="flex gap-2">
                                <Input placeholder="Enter species" value={piece.species}
                                    className={hl(pk('species'))}
                                    onChange={(e) => updatePiece(ai, pi, { species: e.target.value })} autoFocus required />
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => updatePiece(ai, pi, { speciesIsOther: false, species: '' })}>
                                    Choose from list
                                </Button>
                            </div>
                        ) : (
                            <select value={piece.species} onChange={(e) => handlePieceSpeciesSelect(ai, pi, e.target.value)}
                                className={`${selectClass} ${hl(pk('species'))}`}>
                                <option value="" disabled>Select species…</option>
                                {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )
                    ) : asset.type === 'equipment' ? (
                        piece.speciesIsOther ? (
                            <div className="flex gap-2">
                                <Input placeholder={speciesFieldPlaceholder(asset.type)} value={piece.equipment_type}
                                    className={hl(pk('equipment_type'))}
                                    onChange={(e) => updatePiece(ai, pi, { equipment_type: e.target.value })} autoFocus required />
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => updatePiece(ai, pi, { speciesIsOther: false, equipment_type: '' })}>
                                    Choose from list
                                </Button>
                            </div>
                        ) : (
                            <select value={piece.equipment_type} onChange={(e) => handlePieceEquipmentSelect(ai, pi, e.target.value)}
                                className={`${selectClass} ${hl(pk('equipment_type'))}`}>
                                <option value="" disabled>Select equipment type…</option>
                                {EQUIPMENT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )
                    ) : (
                        <Input placeholder={speciesFieldPlaceholder(asset.type)} value={piece.vehicle_type}
                            className={hl(pk('vehicle_type'))}
                            onChange={(e) => updatePiece(ai, pi, { vehicle_type: e.target.value })} required />
                    )}
                    <InputError message={pieceError(ai, pi, 'species')} />
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={piece.description}
                        onChange={(e) => updatePiece(ai, pi, { description: e.target.value })}
                        placeholder="e.g. squared, rough-cut, with bark" />
                    {pi > 0 && asset.pieces[pi - 1]?.description && (
                        <button type="button" className="text-xs text-emerald-700 hover:underline"
                            onClick={() => updatePiece(ai, pi, { description: asset.pieces[pi - 1].description })}>
                            Same as Piece {pi} description
                        </button>
                    )}
                </div>

                {/* Log: dimensions */}
                {isLog && (
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Dimensions (L × W × H)<span className="text-red-500">*</span></Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['length','width','height'] as const).map((dim) => (
                                    <Input key={dim} type="number" min="0" step="0.01"
                                        placeholder={dim.charAt(0).toUpperCase() + dim.slice(1)}
                                        value={piece[dim]}
                                        className={hl(pk(dim))}
                                        onChange={(e) => handlePieceDimensionChange(ai, pi, dim, e.target.value)} required />
                                ))}
                            </div>
                            <InputError message={pieceError(ai, pi, 'length')} />
                        </div>
                        <div className="space-y-2">
                            <Label>Volume (bd.ft)<span className="text-red-500">*</span></Label>
                            <Input type="number" step="0.01" min="0" value={piece.volume_bd_ft}
                                onChange={(e) => handlePieceVolumeBdFtChange(ai, pi, e.target.value)}
                                disabled className="bg-gray-100" />
                            <p className="text-xs text-gray-500">Auto-converted from dimensions</p>
                            <InputError message={pieceError(ai, pi, 'volume_bd_ft')} />
                        </div>
                        <div className="space-y-2">
                            <Label>Volume (cu.m)</Label>
                            <Input type="number" step="0.0001" min="0" value={piece.volume_cu_m}
                                readOnly disabled className="bg-gray-100" />
                            <p className="text-xs text-gray-500">Auto-converted from bd.ft</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Estimated Value (₱)<span className="text-red-500">*</span></Label>
                            <Input type="number" step="0.01" min="0" value={piece.estimated_value}
                                onChange={(e) => updatePiece(ai, pi, { estimated_value: e.target.value, estimated_value_auto: false })}
                                readOnly={piece.estimated_value_auto}
                                className={`${piece.estimated_value_auto ? 'bg-gray-100' : ''} ${hl(pk('estimated_value'))}`} required />
                            {piece.estimated_value_auto ? (
                                <p className="text-xs text-emerald-700">
                                    Auto-computed: {piece.volume_bd_ft} bd.ft × ₱{marketPriceMap[`${piece.species}|${apprehensionYear}`]?.toFixed(2)} (market price {apprehensionYear})
                                </p>
                            ) : piece.species && !piece.speciesIsOther && apprehensionYear ? (
                                <p className="text-xs text-amber-700">No market price set for {piece.species} ({apprehensionYear}) — enter manually.</p>
                            ) : null}
                            <InputError message={pieceError(ai, pi, 'estimated_value')} />
                        </div>
                    </div>
                )}

                {isVehicle && (
                    <div className="max-w-xs space-y-2">
                        <Label>Conveyance / Plate No.<span className="text-red-500">*</span></Label>
                        <Input value={piece.plate_number}
                            className={hl(pk('plate_number'))}
                            onChange={(e) => updatePiece(ai, pi, { plate_number: e.target.value })} required />
                        <InputError message={pieceError(ai, pi, 'plate_number')} />
                    </div>
                )}

                {asset.type === 'equipment' && (
                    <div className="max-w-xs space-y-2">
                        <Label>Serial Number</Label>
                        <Input placeholder="e.g. SN-123456" value={piece.serial_number}
                            onChange={(e) => updatePiece(ai, pi, { serial_number: e.target.value })} />
                        <InputError message={pieceError(ai, pi, 'serial_number')} />
                    </div>
                )}
            </div>
        );
    }

    // ── Step 1: Intake Mode ──────────────────────────────────────────────────

    function renderStep1() {
        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">How did this asset reach MES?</CardTitle>
                    <p className="text-sm text-gray-600">
                        This determines which documents are required and applies to every item in this incident.
                    </p>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <button type="button" onClick={() => handleIntakeModeChange('apprehended')}
                            className={`flex items-start gap-3 rounded-lg border-2 p-5 text-left transition ${
                                data.intake_mode === 'apprehended'
                                    ? 'border-emerald-600 bg-emerald-50'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'} ${hl('intake_mode')}`}>
                            <Shield className={`mt-0.5 h-5 w-5 shrink-0 ${data.intake_mode === 'apprehended' ? 'text-emerald-700' : 'text-gray-400'}`} />
                            <span>
                                <span className="block text-sm font-semibold text-gray-900">Apprehended</span>
                                <span className="mt-1 block text-xs text-gray-500">
                                    Requires DAO Forms, Tally Sheets, and a scanned AAP document.
                                </span>
                            </span>
                        </button>
                        <button type="button" onClick={() => handleIntakeModeChange('turned_over')}
                            className={`flex items-start gap-3 rounded-lg border-2 p-5 text-left transition ${
                                data.intake_mode === 'turned_over'
                                    ? 'border-emerald-600 bg-emerald-50'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'} ${hl('intake_mode')}`}>
                            <Truck className={`mt-0.5 h-5 w-5 shrink-0 ${data.intake_mode === 'turned_over' ? 'text-emerald-700' : 'text-gray-400'}`} />
                            <span>
                                <span className="block text-sm font-semibold text-gray-900">Turned Over</span>
                                <span className="mt-1 block text-xs text-gray-500">
                                    Requires an STCP document upload.
                                </span>
                            </span>
                        </button>
                    </div>
                    {!data.intake_mode && (
                        <p className="mt-4 text-xs text-gray-400">Select one above to continue.</p>
                    )}
                </CardContent>
            </Card>
        );
    }

    // ── Step 2: Incident Details ─────────────────────────────────────────────

    function renderStep2() {
        const isTurnedOver = data.intake_mode === 'turned_over';
        return (
            <div className="space-y-6">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-xl">
                            {isTurnedOver ? 'Turn-Over Details' : 'Apprehension Details'}
                        </CardTitle>
                        <p className="text-sm text-gray-600">
                            {isTurnedOver
                                ? 'Details shared across every item turned over in this incident.'
                                : 'Details shared across every item apprehended in this incident.'}
                        </p>
                        {previewCode && (
                            <span className="mt-2 inline-flex w-fit items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-mono font-semibold text-emerald-800">
                                Asset ID: {previewCode}
                            </span>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        {/* Dates */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>{isTurnedOver ? 'Date of Turn-Over' : 'Date of Apprehension'}<span className="text-red-500">*</span></Label>
                                <Input type="date" value={data.date_of_apprehension}
                                    className={hl('date_of_apprehension')}
                                    onChange={(e) => handleDateOfApprehensionChange(e.target.value)} required />
                                <InputError message={errors.date_of_apprehension} />
                            </div>
                            <div className="space-y-2">
                                <Label>{isTurnedOver ? 'Date Submitted (Turn-Over Report)' : 'Date Submitted (Apprehension Report)'}<span className="text-red-500">*</span></Label>
                                <Input type="date" value={data.date_report_submitted}
                                    className={hl('date_report_submitted')}
                                    onChange={(e) => setData('date_report_submitted', e.target.value)} required />
                                <InputError message={errors.date_report_submitted} />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Province</Label>
                                <select className={selectClass} value="Catanduanes" disabled>
                                    <option value="Catanduanes">Catanduanes</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>{isTurnedOver ? 'Municipality (Place of Turn-Over)' : 'Municipality (Place of Apprehension)'}<span className="text-red-500">*</span></Label>
                                <select value={data.place_of_apprehension} onChange={(e) => handleMunicipalityChange(e.target.value)}
                                    className={`${selectClass} ${hl('place_of_apprehension')}`} required>
                                    <option value="" disabled>-- Select Municipality --</option>
                                    {municipalities.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                                <InputError message={errors.place_of_apprehension} />
                            </div>
                            <div className="space-y-2">
                                <Label>Land Class<span className="text-red-500">*</span></Label>
                                <select value={data.area} onChange={(e) => setData('area', e.target.value)}
                                    className={`${selectClass} ${hl('area')}`} required>
                                    <option value="" disabled>Select land class…</option>
                                    <option value="Timberland">Timberland</option>
                                    <option value="Protected Area">Protected Area</option>
                                    <option value="Alienable & Disposable">Alienable &amp; Disposable</option>
                                </select>
                                <InputError message={errors.area} />
                            </div>
                        </div>

                        {/* Coordinates + Parties */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>{isTurnedOver ? 'Turn-Over Site Coordinates' : 'Apprehension Site Coordinates'}<span className="text-red-500">*</span></Label>
                                    <button
                                        type="button"
                                        onClick={() => setCoordsMode((m) => m === 'map' ? 'manual' : 'map')}
                                        className="text-xs font-medium text-emerald-700 hover:underline"
                                    >
                                        {coordsMode === 'map' ? 'Type manually instead' : 'Pick on map instead'}
                                    </button>
                                </div>
                                {coordsMode === 'map' ? (
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g. 13.5833, 124.2333"
                                            value={data.coordinates}
                                            readOnly
                                            className="bg-gray-50"
                                            required
                                        />
                                        <Button type="button" variant="outline" className={hl('coordinates')} onClick={() => setShowCoordinatesPicker(true)}>
                                            Pick on Map
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <Input
                                            placeholder="e.g. 13.5833, 124.2333"
                                            value={data.coordinates}
                                            onChange={(e) => setData('coordinates', e.target.value)}
                                            className={hl('coordinates')}
                                            required
                                            autoFocus
                                        />
                                        <p className="text-xs text-gray-500">Format: latitude, longitude (e.g. 13.7481, 124.2439)</p>
                                    </div>
                                )}
                                {data.coordinates && (
                                    <p className="text-xs text-emerald-700">
                                        Coordinates set: <span className="font-mono">{data.coordinates}</span>
                                    </p>
                                )}
                                <InputError message={errors.coordinates} />
                            </div>
                            <div className="space-y-2">
                                <Label>{isTurnedOver ? 'Turning-Over Party' : 'Apprehending Party'}<span className="text-red-500">*</span></Label>
                                <div className="space-y-2">
                                    {data.apprehending_parties.map((party, i) => (
                                        <div key={i} className="flex gap-2">
                                            <Input value={party}
                                                className={i === 0 ? hl('apprehending_party') : undefined}
                                                onChange={(e) => updateApprehendingParty(i, e.target.value)}
                                                placeholder="e.g. PENRO Catanduanes MES" required />
                                            {data.apprehending_parties.length > 1 && (
                                                <Button type="button" variant="ghost" size="sm" onClick={() => removeApprehendingParty(i)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addApprehendingParty}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    {isTurnedOver ? 'Add Another Turning-Over Party' : 'Add Another Apprehending Party'}
                                </Button>
                                <InputError message={(errors as Record<string,string>).apprehending_party} />
                            </div>
                        </div>

                        {!isTurnedOver && (
                            <div className="space-y-2">
                                <Label>Initial Custodian (before PENRO)</Label>
                                <Input placeholder="e.g. Barangay Tanod / ENRO field officer who first held the item"
                                    value={data.initial_custodian_name}
                                    onChange={(e) => setData('initial_custodian_name', e.target.value)} />
                                <p className="text-xs text-gray-500">Leave blank if PENRO received it directly.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Claimant */}
                {!isTurnedOver && (
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="border-b border-gray-100">
                            <CardTitle className="text-base">Claimant</CardTitle>
                            <p className="text-sm text-gray-600">
                                Did a claimant or offender come forward? If none, this apprehension will be recorded as <span className="font-semibold text-amber-700">abandoned</span>.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="flex gap-2">
                                {[true, false].map((val) => (
                                    <button key={String(val)} type="button" onClick={() => handleClaimantToggle(val)}
                                        className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition ${
                                            data.has_claimant === val
                                                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'} ${hl('claimant_choice')}`}>
                                        {val ? 'With Claimant' : 'Without Claimant (Abandoned)'}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500">
                                {data.has_claimant === null
                                    ? 'Select one above to continue.'
                                    : data.has_claimant
                                        ? 'A claimant/offender has come forward regarding this apprehension.'
                                        : 'Abandoned — no claimant came forward. This proceeds toward automatic confiscation per DAO 97-32.'}
                            </p>
                            {data.has_claimant && (
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Claimant / Offender Name<span className="text-red-500">*</span></Label>
                                        <Input value={data.claimant_offender_name}
                                            className={hl('claimant_name')}
                                            onChange={(e) => setData('claimant_offender_name', e.target.value)} required />
                                        <InputError message={errors.claimant_offender_name} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Claimant Address<span className="text-red-500">*</span></Label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={data.claimant_address}
                                                onChange={(e) => setData('claimant_address', e.target.value)}
                                                placeholder="Municipality, Barangay"
                                                readOnly
                                                className="bg-gray-50 cursor-default"
                                                required
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={hl('claimant_address')}
                                                onClick={() => {
                                                    // Pre-populate picker with current value if any
                                                    const parts = data.claimant_address.split(', ');
                                                    setAddressMunicipality(parts[0] ?? '');
                                                    setAddressBarangay(parts[1] ?? '');
                                                    setShowAddressPicker(true);
                                                }}
                                            >
                                                Pick Address
                                            </Button>
                                        </div>
                                        <InputError message={errors.claimant_address} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Contact Number</Label>
                                        <Input value={data.claimant_contact_number}
                                            onChange={(e) => setData('claimant_contact_number', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Valid ID Type */}
                                        <div className="space-y-2">
                                            <Label>Valid ID Type</Label>
                                            {idTypeIsOthers ? (
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Specify ID type"
                                                        value={data.claimant_id_type}
                                                        onChange={(e) => setData('claimant_id_type', e.target.value)}
                                                        autoFocus
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setIdTypeIsOthers(false);
                                                            setData('claimant_id_type', '');
                                                            setData('claimant_id_number', '');
                                                        }}
                                                    >
                                                        Back
                                                    </Button>
                                                </div>
                                            ) : (
                                                <select
                                                    value={data.claimant_id_type}
                                                    onChange={(e) => {
                                                        const selected = e.target.value;
                                                        if (selected === 'Others') {
                                                            setIdTypeIsOthers(true);
                                                            setData('claimant_id_type', '');
                                                            setData('claimant_id_number', '');
                                                        } else {
                                                            const config = VALID_IDS.find((id) => id.label === selected);
                                                            setData('claimant_id_type', selected);
                                                            setData('claimant_id_number', config?.prefix ?? '');
                                                        }
                                                    }}
                                                    className={selectClass}
                                                >
                                                    <option value="" disabled>Select ID type…</option>
                                                    {VALID_IDS.map((id) => (
                                                        <option key={id.label} value={id.label}>{id.label}</option>
                                                    ))}
                                                </select>
                                            )}
                                            <InputError message={errors.claimant_id_type} />
                                        </div>

                                        {/* ID Number */}
                                        <div className="space-y-2">
                                            <Label>ID Number</Label>
                                            {(() => {
                                                const config = VALID_IDS.find((id) => id.label === data.claimant_id_type);
                                                const disabled = !data.claimant_id_type && !idTypeIsOthers;
                                                const isPhilSys = data.claimant_id_type === 'PhilSys (National ID)';

                                                function handleIdNumberChange(raw: string) {
                                                    if (isPhilSys) {
                                                        // Strip everything except digits
                                                        const digits = raw.replace(/\D/g, '').slice(0, 16);
                                                        // Insert dashes every 4 digits
                                                        const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1-');
                                                        setData('claimant_id_number', formatted);
                                                    } else {
                                                        setData('claimant_id_number', raw);
                                                    }
                                                }

                                                return (
                                                    <Input
                                                        value={data.claimant_id_number}
                                                        onChange={(e) => handleIdNumberChange(e.target.value)}
                                                        placeholder={
                                                            disabled
                                                                ? 'Select an ID type first'
                                                                : idTypeIsOthers
                                                                    ? 'Enter ID number'
                                                                    : (config?.placeholder ?? 'Enter ID number')
                                                        }
                                                        disabled={disabled}
                                                        inputMode={isPhilSys ? 'numeric' : undefined}
                                                        maxLength={isPhilSys ? 19 : undefined}
                                                        className={disabled ? 'bg-gray-50 text-gray-400' : undefined}
                                                    />
                                                );
                                            })()}
                                            <InputError message={errors.claimant_id_number} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Legal */}
                {!isTurnedOver && (
                    <Card className="border-0 shadow-sm border-amber-100">
                        <CardHeader className="border-b border-amber-100 bg-amber-50 rounded-t-lg">
                            <CardTitle className="text-base">Legal Case</CardTitle>
                            <p className="text-sm text-gray-600">Applies to all items in this incident.</p>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <button type="button" onClick={() => setData('has_ongoing_case', !data.has_ongoing_case)}
                                    className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                                        data.has_ongoing_case
                                            ? 'border-amber-600 bg-amber-100 text-amber-900'
                                            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}>
                                    {data.has_ongoing_case ? 'Ongoing case' : 'No ongoing case'}
                                </button>
                                <button type="button" onClick={() => setData('has_confiscation_order', !data.has_confiscation_order)}
                                    className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                                        data.has_confiscation_order
                                            ? 'border-red-600 bg-red-100 text-red-900'
                                            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}>
                                    {data.has_confiscation_order ? 'Confiscation / Forfeiture Order' : 'No confiscation order'}
                                </button>
                            </div>

                            {data.has_confiscation_order && (
                                <div className="space-y-2">
                                    <Label htmlFor="confiscation-order-file">
                                        Confiscation / Forfeiture Order Document
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    {data.has_confiscation_order_file ? (
                                        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {/* simple PDF icon */}
                                                <svg className="h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                    <polyline points="14 2 14 8 20 8"/>
                                                </svg>
                                                <span className="text-sm font-medium text-red-900 truncate">
                                                    {data.has_confiscation_order_file.name}
                                                </span>
                                                <span className="text-xs text-red-600 shrink-0">
                                                    ({(data.has_confiscation_order_file.size / 1024).toFixed(0)} KB)
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setData('has_confiscation_order_file', null)}
                                                className="ml-3 shrink-0 text-red-400 hover:text-red-600 transition"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label
                                            htmlFor="confiscation-order-file"
                                            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-red-200 bg-red-50 px-4 py-6 text-center hover:border-red-400 hover:bg-red-50 transition ${hl('confiscation_file')}`}
                                        >
                                            <svg className="h-6 w-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                <polyline points="14 2 14 8 20 8"/>
                                                <line x1="12" y1="18" x2="12" y2="12"/>
                                                <line x1="9" y1="15" x2="15" y2="15"/>
                                            </svg>
                                            <span className="text-sm font-medium text-red-700">Click to upload PDF</span>
                                            <span className="text-xs text-red-500">PDF only · max 10 MB</span>
                                            <input
                                                id="confiscation-order-file"
                                                type="file"
                                                accept="application/pdf"
                                                className="sr-only"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0] ?? null;
                                                    setData('has_confiscation_order_file', file);
                                                    // reset input so the same file can be re-selected after removal
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                    )}
                                    <p className="text-xs text-gray-500">
                                        Upload a scanned copy of the confiscation or forfeiture order.
                                    </p>
                                    <InputError message={(errors as Record<string, string>).has_confiscation_order_file} />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    // ── Step 3: Assets & Pieces ──────────────────────────────────────────────
    function assetTotals(asset: AssetRow) {
        const totalBdFt = asset.pieces.reduce((s, p) => s + (parseFloat(p.volume_bd_ft) || 0), 0);
        const totalCuM  = asset.pieces.reduce((s, p) => s + (parseFloat(p.volume_cu_m)  || 0), 0);
        const totalVal  = asset.pieces.reduce((s, p) => s + (parseFloat(p.estimated_value) || 0), 0);
        return { totalBdFt, totalCuM, totalVal };
    }

    function renderStep3() {
        return (
            <div className="space-y-4">
                {data.assets.map((asset, ai) => (
                    <Card key={ai} className="border-0 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
                            <CardTitle className="text-base">
                                Item {ai + 1}
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                    ({asset.pieces.length} {asset.pieces.length === 1 ? 'piece' : 'pieces'})
                                </span>
                            </CardTitle>
                            {data.assets.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeAssetRow(ai)}>
                                    <Trash2 className="mr-1.5 h-4 w-4" />Remove Item
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className={`grid gap-4 ${data.intake_mode !== 'turned_over' ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
                                <div className="space-y-2">
                                    <Label>Asset Type<span className="text-red-500">*</span></Label>
                                    <select value={asset.type} onChange={(e) => updateAsset(ai, 'type', e.target.value)} className={selectClass} required>
                                        {availableTypes(ai).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    <InputError message={assetError(ai, 'type')} />
                                </div>
                                {data.intake_mode !== 'turned_over' && (
                                    <div className="space-y-2">
                                        <Label>Apprehending Agency<span className="text-red-500">*</span></Label>
                                        <Input value={asset.apprehending_agency}
                                            onChange={(e) => updateAsset(ai, 'apprehending_agency', e.target.value)} required />
                                        <InputError message={assetError(ai, 'apprehending_agency')} />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-700">Pieces — encode each one individually</h4>
                                    <span className="text-xs text-gray-500">{asset.pieces.length} {asset.pieces.length === 1 ? 'piece' : 'pieces'}</span>
                                </div>
                                {asset.pieces.map((_, pi) => renderPieceForm(asset, ai, pi))}

                                {asset.type === 'log' && asset.pieces.length > 1 && (() => {
                                    const { totalBdFt, totalCuM, totalVal } = assetTotals(asset);
                                    return (
                                        <div className="flex flex-wrap gap-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
                                            <div className="flex items-center gap-1.5 text-emerald-800">
                                                <Calculator className="h-3.5 w-3.5 shrink-0" />
                                                <span className="font-semibold">Running totals:</span>
                                            </div>
                                            <span className="text-emerald-700">
                                                <span className="font-medium">{totalBdFt.toFixed(2)}</span> bd.ft
                                            </span>
                                            <span className="text-emerald-700">
                                                <span className="font-medium">{totalCuM.toFixed(4)}</span> cu.m
                                            </span>
                                            {totalVal > 0 && (
                                                <span className="text-emerald-700">
                                                    ₱<span className="font-medium">{totalVal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                                </span>
                                            )}
                                            <span className="ml-auto text-emerald-600 text-xs">
                                                {asset.pieces.length} pieces
                                            </span>
                                        </div>
                                    );
                                })()}

                                <Button type="button" variant="outline" size="sm" onClick={() => addPiece(ai)}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />Add Piece
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {data.assets.length < types.length && (
                    <Button type="button" variant="outline" onClick={addAssetRow}>
                        <Plus className="mr-1.5 h-4 w-4" />Add Another Item
                    </Button>
                )}
            </div>
        );
    }


    // ── Step 4: Review ───────────────────────────────────────────────────────

    function renderStep4() {
        const isTurnedOver = data.intake_mode === 'turned_over';
        return (
            <div className="space-y-6">
                <p className="text-sm text-gray-600">
                    Review everything below. Go back to any step to make changes before recording.
                </p>

                {/* Incident summary */}
                {(() => {
                const Field = ({ label, value, mono = false, wide = false }: {
                    label: string; value?: string | null; mono?: boolean; wide?: boolean;
                }) => (
                    <div className={wide ? 'sm:col-span-2' : undefined}>
                        <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
                        <dd className={`text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>
                            {value && value.trim() !== '' ? value : <span className="font-normal text-gray-300">—</span>}
                        </dd>
                    </div>
                );

                return (
                    <Card className="border-0 shadow-sm">
                        {/* Header row: title + asset ID + edit */}
                        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-gray-900">
                                        {isTurnedOver ? 'Turn-Over Details' : 'Apprehension Details'}
                                    </h3>
                                    {previewCode && (
                                        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-700">
                                            {previewCode}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                        {labelFor(modes, data.intake_mode)}
                                    </span>
                                    {!isTurnedOver && !data.has_claimant && (
                                        <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                            Abandoned
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button type="button" onClick={() => setStep(2)}
                                className="text-xs font-medium text-emerald-700 hover:underline mt-0.5">
                                Edit
                            </button>
                        </div>

                        <CardContent className="pt-5 pb-6 space-y-5">
                            {/* Dates + location in one flat grid — no section header needed */}
                            <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                                <Field
                                    label={isTurnedOver ? 'Date of Turn-Over' : 'Date of Apprehension'}
                                    value={data.date_of_apprehension}
                                />
                                <Field label="Report Submitted" value={data.date_report_submitted} />
                                <Field label="Municipality" value={labelFor(municipalities, data.place_of_apprehension)} />
                                <Field label="Land Class" value={data.area} />
                                <Field label="Coordinates" value={data.coordinates} mono wide />
                            </dl>

                            {/* Thin divider before party info */}
                            <div className="border-t border-gray-100" />

                            <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                                <Field
                                    label={isTurnedOver ? 'Turning-Over Party' : 'Apprehending Party'}
                                    value={data.apprehending_parties.filter((p) => p.trim()).join('; ')}
                                    wide
                                />
                                {!isTurnedOver && data.initial_custodian_name && (
                                    <Field label="Initial Custodian" value={data.initial_custodian_name} wide />
                                )}
                            </dl>

                            {/* Claimant (apprehended only) */}
                            {!isTurnedOver && (
                                <>
                                    <div className="border-t border-gray-100" />

                                    {data.has_claimant ? (
                                        <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                                            <Field label="Claimant Name" value={data.claimant_offender_name} />
                                            <Field label="Address" value={data.claimant_address} />
                                            {data.claimant_contact_number && (
                                                <Field label="Contact" value={data.claimant_contact_number} />
                                            )}
                                            {(data.claimant_id_type || data.claimant_id_number) && (
                                                <Field
                                                    label="Valid ID"
                                                    value={[data.claimant_id_type, data.claimant_id_number].filter(Boolean).join(' · ')}
                                                />
                                            )}
                                        </dl>
                                    ) : (
                                        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                                            <p className="text-sm font-medium text-amber-900">No claimant — recorded as abandoned</p>
                                            <p className="mt-0.5 text-xs text-amber-700">
                                                Proceeds toward automatic confiscation per DAO 97-32.
                                            </p>
                                        </div>
                                    )}

                                    {/* Legal status — only show if something is toggled on */}
                                    {(data.has_ongoing_case || data.has_confiscation_order) && (
                                        <>
                                            <div className="border-t border-gray-100" />
                                            <div className="flex flex-wrap gap-1.5">
                                                {data.has_ongoing_case ? (
                                                    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                                                        Ongoing case
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400">
                                                        No ongoing case
                                                    </span>
                                                )}
                                                {data.has_confiscation_order && data.has_confiscation_order_file ? (
                                                    <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800">
                                                        Confiscation order issued
                                                    </span>
                                                ) : data.has_confiscation_order && !data.has_confiscation_order_file ? (
                                                    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                                        Confiscation order — file not yet uploaded
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400">
                                                        No confiscation order
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            {/* Map preview */}
                            {data.coordinates && (
                                <>
                                    <div className="border-t border-gray-100" />
                                    <IncidentLocationMap
                                        coordinates={data.coordinates}
                                        placeName={data.place_of_apprehension}
                                        areaName={data.area}
                                    />
                                </>
                            )}
                        </CardContent>
                    </Card>
                );
            })()}

                {/* Assets */}
                {(() => {
                    const totalPieces = data.assets.reduce((sum, a) => sum + a.pieces.length, 0);
                    const money = (v: string | number) =>
                        `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    const num = (v: string | number, d = 2) =>
                        Number(v).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d });

                    return (
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-start justify-between border-b border-gray-100">
                                <div>
                                    <CardTitle className="text-base">Items to Record</CardTitle>
                                    <p className="mt-0.5 text-sm text-gray-500">
                                        {data.assets.length} {data.assets.length === 1 ? 'item' : 'items'} ·{' '}
                                        {totalPieces} {totalPieces === 1 ? 'piece' : 'pieces'}
                                    </p>
                                </div>
                                <button type="button" onClick={() => setStep(3)} className="text-xs font-medium text-emerald-700 hover:underline">
                                    Edit
                                </button>
                            </CardHeader>

                            <CardContent className="space-y-5 pt-5">
                                {data.assets.map((asset, ai) => {
                                    const isLog = asset.type === 'log';
                                    const isVehicle = asset.type === 'vehicle';
                                    const { totalBdFt, totalCuM, totalVal } = assetTotals(asset);

                                    const headers = isLog
                                        ? ['#', 'Species', 'Dimensions (L × W × H)', 'Volume (bd.ft)', 'Est. Value']
                                        : isVehicle
                                            ? ['#', 'Vehicle Type', 'Plate No.', 'Description']
                                            : ['#', 'Equipment Type', 'Serial No.', 'Description'];

                                    return (
                                        <div key={ai} className="overflow-hidden rounded-lg border border-gray-200">
                                            {/* Item header */}
                                            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                                                        Item {ai + 1}
                                                    </span>
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {labelFor(types, asset.type)}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {asset.pieces.length} {asset.pieces.length === 1 ? 'piece' : 'pieces'}
                                                </span>
                                            </div>

                                            {/* Pieces table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                                                            {headers.map((h, i) => (
                                                                <th
                                                                    key={h}
                                                                    className={`whitespace-nowrap px-4 py-2 font-medium ${
                                                                        isLog && i >= 3 ? 'text-right' : ''
                                                                    }`}
                                                                >
                                                                    {h}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {asset.pieces.map((piece, pi) => (
                                                            <tr key={pi} className="align-top">
                                                                <td className="px-4 py-3 text-gray-400">{pi + 1}</td>

                                                                {isLog && (
                                                                    <>
                                                                        <td className="px-4 py-3 font-semibold text-gray-900">
                                                                            {piece.species || '—'}
                                                                            {piece.description && (
                                                                                <p className="mt-0.5 text-xs font-normal text-gray-500">{piece.description}</p>
                                                                            )}
                                                                        </td>
                                                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                                                            {piece.length || '—'} × {piece.width || '—'} × {piece.height || '—'}
                                                                        </td>
                                                                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                                                                            {piece.volume_bd_ft ? num(piece.volume_bd_ft) : '—'}
                                                                        </td>
                                                                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">
                                                                            {piece.estimated_value ? money(piece.estimated_value) : '—'}
                                                                        </td>
                                                                    </>
                                                                )}

                                                                {isVehicle && (
                                                                    <>
                                                                        <td className="px-4 py-3 font-semibold text-gray-900">{piece.vehicle_type || '—'}</td>
                                                                        <td className="px-4 py-3 font-mono text-gray-900">{piece.plate_number || '—'}</td>
                                                                        <td className="px-4 py-3 text-gray-600">{piece.description || '—'}</td>
                                                                    </>
                                                                )}

                                                                {asset.type === 'equipment' && (
                                                                    <>
                                                                        <td className="px-4 py-3 font-semibold text-gray-900">{piece.equipment_type || '—'}</td>
                                                                        <td className="px-4 py-3 font-mono text-gray-900">{piece.serial_number || '—'}</td>
                                                                        <td className="px-4 py-3 text-gray-600">{piece.description || '—'}</td>
                                                                    </>
                                                                )}
                                                            </tr>
                                                        ))}
                                                    </tbody>

                                                    {/* Totals (logs only, 2+ pieces) */}
                                                    {isLog && asset.pieces.length > 1 && (
                                                        <tfoot>
                                                            <tr className="border-t-2 border-emerald-100 bg-emerald-50">
                                                                <td colSpan={3} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                                                                    Total · {num(totalCuM, 4)} cu.m
                                                                </td>
                                                                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-emerald-800">
                                                                    {num(totalBdFt)}
                                                                </td>
                                                                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-emerald-800">
                                                                    {money(totalVal)}
                                                                </td>
                                                            </tr>
                                                        </tfoot>
                                                    )}
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    );
                })()}
            </div>
        );
    }

    // ── Can proceed per step ─────────────────────────────────────────────────

    const nextDisabled =
        (step === 1 && !canProceedStep1()) ||
        (step === 2 && !canProceedStep2()) ||
        (step === 3 && !canProceedStep3());

    const nextLabel =
        step === 1 ? 'Set Incident Details' :
        step === 2 ? 'Add Assets & Pieces' :
        step === 3 ? 'Review' : 'Record Incident';

    // ── Render ───────────────────────────────────────────────────────────────

    const title = data.intake_mode === 'turned_over' ? 'MES Turn-Over Intake' : 'MES Apprehension Intake';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm('Discard this draft and start over?')) {
                                try { localStorage.removeItem(DRAFT_KEY); } catch {}
                                window.location.reload();
                            }
                        }}
                        className="text-xs font-medium text-gray-400 hover:text-red-600 transition"
                    >
                        Discard Draft
                    </button>
                </div>
            }
        >
            <Head title={data.intake_mode === 'turned_over' ? 'New Turn-Over Intake' : 'New Apprehension Intake'} />
            <style>{HIGHLIGHT_CSS}</style>

            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
                <StepIndicator current={step} />

                <div className="space-y-6">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}

                    <StepNav
                        step={step}
                        totalSteps={STEPS.length}
                        onBack={() => setStep((s) => s - 1)}
                        onNext={handleNext}
                        nextLabel={nextLabel}
                        nextDisabled={nextDisabled}
                        processing={processing}
                        highlightNext={nextTarget === 'next_btn'}
                    />
                </div>
            </div>

            <CoordinatesPickerModal
                show={showCoordinatesPicker}
                onClose={() => setShowCoordinatesPicker(false)}
                onSelect={(coords) => setData('coordinates', coords)}
                initialCoordinates={data.coordinates}
            />

            {/* Address picker modal */}
            <Modal show={showAddressPicker} onClose={() => setShowAddressPicker(false)} maxWidth="sm">
                <div className="p-6 space-y-5">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Select Claimant Address</h2>
                        <p className="mt-0.5 text-sm text-gray-500">Choose municipality then barangay.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="addr-municipality">Municipality<span className="text-red-500">*</span></Label>
                        <select
                            id="addr-municipality"
                            value={addressMunicipality}
                            onChange={(e) => {
                                setAddressMunicipality(e.target.value);
                                setAddressBarangay(''); // reset barangay when municipality changes
                            }}
                            className={selectClass}
                        >
                            <option value="" disabled>Select municipality…</option>
                            {municipalities.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="addr-barangay">Barangay<span className="text-red-500">*</span></Label>
                        <select
                            id="addr-barangay"
                            value={addressBarangay}
                            onChange={(e) => setAddressBarangay(e.target.value)}
                            disabled={!addressMunicipality}
                            className={selectClass + (!addressMunicipality ? ' opacity-50 cursor-not-allowed' : '')}
                        >
                            <option value="" disabled>
                                {addressMunicipality ? 'Select barangay…' : 'Select a municipality first'}
                            </option>
                            {(barangaysByMunicipality[addressMunicipality] ?? []).map((b) => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                        <Button type="button" variant="outline" onClick={() => setShowAddressPicker(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={!addressMunicipality || !addressBarangay}
                            onClick={() => {
                                setData('claimant_address', `${addressMunicipality}, ${addressBarangay}`);
                                setShowAddressPicker(false);
                            }}
                        >
                            Confirm Address
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirm modal */}
            <Modal show={showConfirmModal} onClose={() => setShowConfirmModal(false)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {data.intake_mode === 'turned_over' ? 'Record Turn-Over?' : 'Record Apprehension?'}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                        This will save the incident. You can edit it afterwards if needed.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setShowConfirmModal(false)}>
                            Go Back
                        </Button>
                        <Button type="button" onClick={confirmAndSubmit} disabled={processing}>
                            {processing ? 'Recording…' : 'Confirm & Record'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Draft restore modal */}
            <Modal show={showRestoreDraft} onClose={() => setShowRestoreDraft(false)} maxWidth="sm">
                <div className="p-6">
                    <h2 className="text-base font-semibold text-gray-900">Restore unsaved draft?</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        You have an unfinished intake form. Would you like to continue where you left off?
                    </p>
                    <div className="mt-5 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                try { localStorage.removeItem(DRAFT_KEY); } catch {}
                                setShowRestoreDraft(false);
                            }}
                        >
                            Start Fresh
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (savedDraft) {
                                    setData(savedDraft.data);
                                    setStep(savedDraft.step);
                                }
                                setShowRestoreDraft(false);
                            }}
                        >
                            Restore Draft
                        </Button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}