import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useMemo, useState } from 'react';
import { Plus, Shield, Trash2, Truck, X } from 'lucide-react';
import CoordinatesPickerModal from '@/Components/shared/CoordinatesPickerModal';

interface Option {
    value: string;
    label: string;
}

interface MarketPriceEntry {
    species: string;
    year: number;
    price_per_bd_ft: string;
}

interface CreateProps {
    types: Option[];
    modes: Option[];
    municipalities: Option[];
    barangaysByMunicipality: Record<string, string[]>;
    nextAssetSequence: number;
    marketPrices: MarketPriceEntry[];
}

interface AssetRow {
    type: string;
    species: string;
    speciesIsOther: boolean;
    description: string;
    quantity: string;
    quantity_unit: string;
    length: string;
    width: string;
    height: string;
    volume_bd_ft: string;
    volume_cu_m: string;
    estimated_value: string;
    estimated_value_auto: boolean;
    plate_number: string;
    municipality_of_origin: string;
    location_apprehended: string;
    apprehending_agency: string;
    mode: string;
    has_confiscation_order: boolean;
}

const SPECIES_OPTIONS = [
    'Narra',
    'Coco Lumber',
    'Mahogany',
    'Molave',
    'Yakal',
    'Ipil',
    'Kamagong',
    'Tanguile',
    'Lauan',
    'Apitong',
    'Gmelina',
    'Falcata',
    'Bamboo',
    'Others',
];

// Quantity units that may be used as the intake measurement for an asset
// rather than forcing the UI to always call it "pcs".
const QUANTITY_UNIT_OPTIONS = ['pcs', 'sack', 'bundle', 'piece', 'box', 'container', 'roll', 'lot'];

// Dropdown selection for Equipment / Tools, per NewFlow.pdf Data Encoding
// Module ("Equipment / Tools / Implements — Dropdown Selection"). Kept
// separate from SPECIES_OPTIONS since equipment isn't a species.
const EQUIPMENT_OPTIONS = [
    'Chainsaw',
    'Power Saw',
    'Handheld Circular Saw',
    'Winch / Cable Puller',
    'Hand Tools (Axe, Bolo, Wedge)',
    'Others',
];

// 1 board foot = 0.002359737 cubic meters.
const BD_FT_TO_CU_M = 0.002359737;

function emptyAssetRow(defaults: { municipality: string; agency: string; mode: string }): AssetRow {
    return {
        type: 'log',
        species: '',
        speciesIsOther: false,
        description: '',
        quantity: '1',
        quantity_unit: 'pcs',
        length: '',
        width: '',
        height: '',
        volume_bd_ft: '',
        volume_cu_m: '',
        estimated_value: '',
        estimated_value_auto: false,
        plate_number: '',
        municipality_of_origin: defaults.municipality,
        location_apprehended: defaults.municipality,
        apprehending_agency: defaults.agency,
        mode: defaults.mode,
        has_confiscation_order: false,
    };
}

const selectClass =
    'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

function convertBdFtToCuM(bdFt: string): string {
    const value = parseFloat(bdFt);
    if (Number.isNaN(value) || value <= 0) return '';
    return (value * BD_FT_TO_CU_M).toFixed(4);
}

function calculateBdFtFromDimensions(length: string, width: string, height: string): string {
    const lengthValue = parseFloat(length);
    const widthValue = parseFloat(width);
    const heightValue = parseFloat(height);

    if ([lengthValue, widthValue, heightValue].some((value) => Number.isNaN(value) || value <= 0)) {
        return '';
    }

    return ((lengthValue * widthValue * heightValue) / 12).toFixed(2);
}

// Field label/placeholder for the "species" text depends on asset type —
// Log keeps the species dropdown, Equipment now also uses a dropdown
// (EQUIPMENT_OPTIONS), Vehicle keeps a free-text field with a relabeled
// prompt, since "species" doesn't apply to it.
function speciesFieldLabel(type: string): string {
    switch (type) {
        case 'vehicle':
            return 'Conveyance / Vehicle Type';
        case 'equipment':
            return 'Equipment Type';
        default:
            return 'Species';
    }
}

function speciesFieldPlaceholder(type: string): string {
    switch (type) {
        case 'vehicle':
            return 'e.g. Motorcycle, Tricycle, Habal-habal';
        case 'equipment':
            return 'e.g. Chainsaw, Power Saw';
        default:
            return 'Enter species';
    }
}

export default function IncidentsCreate({ types, modes, municipalities, nextAssetSequence, marketPrices }: CreateProps) {
    const defaultMunicipality = municipalities[0]?.value ?? '';
    const defaultAgency = 'PENRO Catanduanes MES';

    const { data, setData, post, processing, errors, transform } = useForm({
        intake_mode: '',
        date_of_apprehension: '',
        place_of_apprehension: defaultMunicipality,
        area: '',
        coordinates: '',
        has_claimant: true as boolean,
        claimant_offender_name: '',
        claimant_address: '',
        claimant_contact_number: '',
        claimant_id_type: '',
        claimant_id_number: '',
        apprehending_parties: ['PENRO Catanduanes MES'] as string[],
        // Initial handler/custodian before the asset reaches PENRO custody
        // (NewFlow.pdf Data Encoding Module). Distinct from apprehending
        // party and from the Property Custodian who takes over in Stage 2.
        initial_custodian_name: '',
        date_report_submitted: '',
        // No item rows until an intake mode is chosen — mode starts blank
        // and gets backfilled by handleIntakeModeChange once picked.
        assets: [emptyAssetRow({ municipality: defaultMunicipality, agency: defaultAgency, mode: '' })] as AssetRow[],
    });

    const marketPriceMap = useMemo(() => {
        const map: Record<string, number> = {};
        marketPrices.forEach((mp) => {
            map[`${mp.species}|${mp.year}`] = Number(mp.price_per_bd_ft);
        });
        return map;
    }, [marketPrices]);

    function withAutoEstimate(asset: AssetRow, year: number | null): AssetRow {
        if (asset.type !== 'log' || asset.speciesIsOther || !asset.species || !year) {
            return { ...asset, estimated_value_auto: false };
        }

        const price = marketPriceMap[`${asset.species}|${year}`];
        const volume = parseFloat(asset.volume_bd_ft);

        if (price === undefined || Number.isNaN(volume) || volume <= 0) {
            return { ...asset, estimated_value_auto: false };
        }

        return {
            ...asset,
            estimated_value: (volume * price).toFixed(2),
            estimated_value_auto: true,
        };
    }

    const apprehensionYear = data.date_of_apprehension
        ? new Date(data.date_of_apprehension).getFullYear()
        : null;
    const [showCoordinatesPicker, setShowCoordinatesPicker] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const previewYear = data.date_report_submitted
        ? new Date(data.date_report_submitted).getFullYear()
        : null;
    const previewPrefix = data.intake_mode === 'turned_over' ? 'TO' : data.intake_mode === 'apprehended' ? 'AP' : null;
    const previewCode = previewYear && previewPrefix
        ? `${previewPrefix}-${previewYear}-${String(nextAssetSequence).padStart(5, '0')}`
        : null;

    function updateAsset(index: number, field: keyof AssetRow, value: string | boolean) {
        const next = [...data.assets];
        let updated = { ...next[index], [field]: value } as AssetRow;
        if (field === 'type') {
            updated = { ...updated, species: '', speciesIsOther: false, estimated_value_auto: false };
            updated = withAutoEstimate(updated, apprehensionYear);
        }
        next[index] = updated;
        setData('assets', next);
    }

    function handleSpeciesSelect(index: number, value: string) {
        if (value === 'Others') {
            updateAssetMultiple(index, { species: '', speciesIsOther: true, estimated_value_auto: false });
        } else {
            updateAssetMultiple(index, { species: value, speciesIsOther: false }, true);
        }
    }

    // Equipment dropdown uses the same speciesIsOther/species fields as Log,
    // just sourced from EQUIPMENT_OPTIONS instead of SPECIES_OPTIONS, so no
    // schema or backend change is needed.
    function handleEquipmentSelect(index: number, value: string) {
        if (value === 'Others') {
            updateAssetMultiple(index, { species: '', speciesIsOther: true });
        } else {
            updateAssetMultiple(index, { species: value, speciesIsOther: false });
        }
    }

    function updateAssetMultiple(index: number, fields: Partial<AssetRow>, recompute = false) {
        const next = [...data.assets];
        let updated = { ...next[index], ...fields } as AssetRow;
        if (recompute) {
            updated = withAutoEstimate(updated, apprehensionYear);
        }
        next[index] = updated;
        setData('assets', next);
    }

    function handleVolumeBdFtChange(index: number, value: string) {
        updateAssetMultiple(index, {
            volume_bd_ft: value,
            volume_cu_m: convertBdFtToCuM(value),
        }, true);
    }

    function handleDimensionChange(index: number, field: 'length' | 'width' | 'height', value: string) {
        const next = [...data.assets];
        const asset = next[index];
        const updated = {
            ...asset,
            [field]: value,
        } as AssetRow;

        if (asset.type === 'log') {
            const bdFt = calculateBdFtFromDimensions(updated.length, updated.width, updated.height);
            updated.volume_bd_ft = bdFt;
            updated.volume_cu_m = convertBdFtToCuM(bdFt);
            const estimated = withAutoEstimate(updated, apprehensionYear);
            next[index] = estimated;
            setData('assets', next);
            return;
        }

        next[index] = updated;
        setData('assets', next);
    }

    function handleMunicipalityChange(value: string) {
        setData('place_of_apprehension', value);
        setData(
            'assets',
            data.assets.map((asset) => ({
                ...asset,
                municipality_of_origin: value,
                location_apprehended: value,
            })),
        );
    }

    // Stage 1 entry point (NewFlow.pdf): Apprehended vs. Turned-Over is
    // decided once, for the whole incident, before anything else is
    // encoded — not per line item. Every asset row inherits this value.
    // This is also the gate that reveals the rest of the form.
    function handleIntakeModeChange(value: string) {
        setData((prevData) => ({
            ...prevData,
            intake_mode: value,
            assets: prevData.assets.map((asset) => ({ ...asset, mode: value })),
        }));
    }

    function handleDateOfApprehensionChange(value: string) {
        setData((prevData) => {
            const year = value ? new Date(value).getFullYear() : null;
            return {
                ...prevData,
                date_of_apprehension: value,
                assets: prevData.assets.map((asset) => withAutoEstimate(asset, year)),
            };
        });
    }

    function addAssetRow() {
        setData('assets', [
            ...data.assets,
            emptyAssetRow({
                municipality: data.place_of_apprehension || defaultMunicipality,
                agency: defaultAgency,
                mode: data.intake_mode,
            }),
        ]);
    }

    function removeAssetRow(index: number) {
        if (data.assets.length === 1) return;
        setData('assets', data.assets.filter((_, i) => i !== index));
    }

    function addApprehendingParty() {
        setData('apprehending_parties', [...data.apprehending_parties, '']);
    }

    function updateApprehendingParty(index: number, value: string) {
        const next = [...data.apprehending_parties];
        next[index] = value;
        setData('apprehending_parties', next);
    }

    function removeApprehendingParty(index: number) {
        if (data.apprehending_parties.length === 1) return;
        setData('apprehending_parties', data.apprehending_parties.filter((_, i) => i !== index));
    }

    function handleClaimantToggle(hasClaimant: boolean) {
        setData((prevData) => ({
            ...prevData,
            has_claimant: hasClaimant,
            claimant_offender_name: hasClaimant ? prevData.claimant_offender_name : '',
            claimant_address: hasClaimant ? prevData.claimant_address : '',
            claimant_contact_number: hasClaimant ? prevData.claimant_contact_number : '',
            claimant_id_type: hasClaimant ? prevData.claimant_id_type : '',
            claimant_id_number: hasClaimant ? prevData.claimant_id_number : '',
        }));
    }

    // Instead of submitting immediately, open the confirmation modal.
    // Native "required" validation still runs first, so this only fires
    // once the visible required fields are actually filled in.
    const handleReviewClick: FormEventHandler = (e) => {
        e.preventDefault();
        setShowConfirmModal(true);
    };

    function confirmAndSubmit() {
        // The backend column is a single `apprehending_party` string, so
        // multiple entries are joined here rather than requiring a schema
        // change; the asset-level `species` custom-text case is already
        // stored directly in `species` by handleSpeciesSelect.
        transform((formData) => ({
            ...formData,
            apprehending_party: formData.apprehending_parties.filter((p) => p.trim() !== '').join('; '),
        }));

        post(route('incidents.store'), {
            onSuccess: () => setShowConfirmModal(false),
        });
    }

    function assetError(index: number, field: string): string | undefined {
        return (errors as Record<string, string>)[`assets.${index}.${field}`];
    }

    function labelFor(options: Option[], value: string): string {
        return options.find((o) => o.value === value)?.label ?? value;
    }

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">MES Apprehension Intake</h2>}>
            <Head title="New Apprehension Intake" />

            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                <form onSubmit={handleReviewClick} className="space-y-6">
                    {/* Stage 1 entry point — Intake Mode (Apprehended vs. Turned-Over) */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="border-b border-gray-100">
                            <CardTitle className="text-xl">Intake Mode</CardTitle>
                            <p className="text-sm text-gray-600">
                                How did this asset reach MES? This determines which documents are required later
                                and applies to every item in this incident.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => handleIntakeModeChange('apprehended')}
                                    className={
                                        'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition ' +
                                        (data.intake_mode === 'apprehended'
                                            ? 'border-emerald-600 bg-emerald-50'
                                            : 'border-gray-200 bg-white hover:bg-gray-50')
                                    }
                                >
                                    <Shield className={'mt-0.5 h-5 w-5 shrink-0 ' + (data.intake_mode === 'apprehended' ? 'text-emerald-700' : 'text-gray-400')} />
                                    <span>
                                        <span className="block text-sm font-semibold text-gray-900">Apprehended</span>
                                        <span className="mt-0.5 block text-xs text-gray-500">
                                            Requires DAO Forms, Tally Sheets, and a scanned AAP document.
                                        </span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleIntakeModeChange('turned_over')}
                                    className={
                                        'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition ' +
                                        (data.intake_mode === 'turned_over'
                                            ? 'border-emerald-600 bg-emerald-50'
                                            : 'border-gray-200 bg-white hover:bg-gray-50')
                                    }
                                >
                                    <Truck className={'mt-0.5 h-5 w-5 shrink-0 ' + (data.intake_mode === 'turned_over' ? 'text-emerald-700' : 'text-gray-400')} />
                                    <span>
                                        <span className="block text-sm font-semibold text-gray-900">Turned Over</span>
                                        <span className="mt-0.5 block text-xs text-gray-500">
                                            Requires an STCP document upload.
                                        </span>
                                    </span>
                                </button>
                            </div>

                            {!data.intake_mode && (
                                <p className="mt-3 text-xs text-gray-500">
                                    Select Apprehended or Turned Over above to continue with the rest of the intake form.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {data.intake_mode && (
                        <>
                            {/* Incident-level details */}
                            <Card className="border-0 shadow-sm">
                                <CardHeader className="border-b border-gray-100">
                                    <CardTitle className="text-xl">Apprehension Details</CardTitle>
                                    <p className="text-sm text-gray-600">
                                        Details shared across every item apprehended in this incident.
                                    </p>

                                    <div className="mt-2">
                                        {previewCode ? (
                                            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-mono font-semibold text-emerald-800">
                                                Asset ID: {previewCode}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500">
                                                Asset ID will appear once the date submitted is set.
                                            </span>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="date_of_apprehension">Date of Apprehension<span className="text-red-500">*</span></Label>
                                            <Input
                                                id="date_of_apprehension"
                                                type="date"
                                                value={data.date_of_apprehension}
                                                onChange={(e) => handleDateOfApprehensionChange(e.target.value)}
                                                required
                                            />
                                            <InputError message={errors.date_of_apprehension} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="date_report_submitted">Date Submitted (Apprehension Report)<span className="text-red-500">*</span></Label>
                                            <Input
                                                id="date_report_submitted"
                                                type="date"
                                                value={data.date_report_submitted}
                                                onChange={(e) => setData('date_report_submitted', e.target.value)}
                                                required
                                            />
                                            <InputError message={errors.date_report_submitted} />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="province">Province</Label>
                                            <select id="province" className={selectClass} value="Catanduanes" disabled>
                                                <option value="Catanduanes">Catanduanes</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="place_of_apprehension">Municipality (Place of Apprehension)<span className="text-red-500">*</span></Label>
                                            <select
                                                id="place_of_apprehension"
                                                value={data.place_of_apprehension}
                                                onChange={(e) => handleMunicipalityChange(e.target.value)}
                                                className={selectClass}
                                                required
                                            >
                                                <option value="" disabled>Select municipality…</option>
                                                {municipalities.map((m) => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                            <InputError message={errors.place_of_apprehension} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="area">Area<span className="text-red-500">*</span></Label>
                                            <Input
                                                id="area"
                                                placeholder="Forest area / compartment"
                                                value={data.area}
                                                onChange={(e) => setData('area', e.target.value)}
                                                required
                                            />
                                            <InputError message={errors.area} />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="coordinates">Coordinates<span className="text-red-500">*</span></Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="coordinates"
                                                    placeholder="e.g. 13.5833, 124.2333"
                                                    value={data.coordinates}
                                                    onChange={(e) => setData('coordinates', e.target.value)}
                                                    required
                                                />
                                                <Button type="button" variant="outline" onClick={() => setShowCoordinatesPicker(true)}>
                                                    Pick on Map
                                                </Button>
                                            </div>
                                            <InputError message={errors.coordinates} />
                                        </div>

                                        {/* Apprehending Party — supports multiple entries */}
                                        <div className="space-y-2">
                                            <Label>Apprehending Party<span className="text-red-500">*</span></Label>
                                            <div className="space-y-2">
                                                {data.apprehending_parties.map((party, index) => (
                                                    <div key={index} className="flex gap-2">
                                                        <Input
                                                            value={party}
                                                            onChange={(e) => updateApprehendingParty(index, e.target.value)}
                                                            placeholder="e.g. PENRO Catanduanes MES"
                                                            required
                                                        />
                                                        {data.apprehending_parties.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeApprehendingParty(index)}
                                                                aria-label="Remove apprehending party"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <Button type="button" variant="outline" size="sm" onClick={addApprehendingParty}>
                                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                Add Another Apprehending Party
                                            </Button>
                                            <InputError message={(errors as Record<string, string>).apprehending_party} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="initial_custodian_name">Initial Custodian (before PENRO)</Label>
                                        <Input
                                            id="initial_custodian_name"
                                            placeholder="e.g. Barangay Tanod / ENRO field officer who first held the item"
                                            value={data.initial_custodian_name}
                                            onChange={(e) => setData('initial_custodian_name', e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500">
                                            The person or office that held the asset before it reached PENRO custody. Leave blank if
                                            PENRO received it directly.
                                        </p>
                                        <InputError message={errors.initial_custodian_name} />
                                    </div>

                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                        <Label className="mb-2 block">Claimant Status<span className="text-red-500">*</span></Label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleClaimantToggle(true)}
                                                className={
                                                    'flex-1 rounded-md border px-4 py-2 text-sm font-medium transition ' +
                                                    (data.has_claimant
                                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')
                                                }
                                            >
                                                With Claimant
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleClaimantToggle(false)}
                                                className={
                                                    'flex-1 rounded-md border px-4 py-2 text-sm font-medium transition ' +
                                                    (!data.has_claimant
                                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')
                                                }
                                            >
                                                Without Claimant
                                            </button>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {data.has_claimant
                                                ? 'A claimant/offender has come forward regarding this apprehension.'
                                                : 'No claimant has come forward — this proceeds toward automatic confiscation per DAO 97-32.'}
                                        </p>

                                        {data.has_claimant && (
                                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="claimant_offender_name">Claimant / Offender Name<span className="text-red-500">*</span></Label>
                                                    <Input
                                                        id="claimant_offender_name"
                                                        value={data.claimant_offender_name}
                                                        onChange={(e) => setData('claimant_offender_name', e.target.value)}
                                                        required
                                                    />
                                                    <InputError message={errors.claimant_offender_name} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="claimant_address">Claimant Address<span className="text-red-500">*</span></Label>
                                                    <Input
                                                        id="claimant_address"
                                                        value={data.claimant_address}
                                                        onChange={(e) => setData('claimant_address', e.target.value)}
                                                        required
                                                    />
                                                    <InputError message={errors.claimant_address} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="claimant_contact_number">Contact Number</Label>
                                                    <Input
                                                        id="claimant_contact_number"
                                                        value={data.claimant_contact_number}
                                                        onChange={(e) => setData('claimant_contact_number', e.target.value)}
                                                    />
                                                    <InputError message={errors.claimant_contact_number} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="claimant_id_type">Valid ID Type</Label>
                                                        <Input
                                                            id="claimant_id_type"
                                                            placeholder="e.g. Driver's License"
                                                            value={data.claimant_id_type}
                                                            onChange={(e) => setData('claimant_id_type', e.target.value)}
                                                        />
                                                        <InputError message={errors.claimant_id_type} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="claimant_id_number">ID Number</Label>
                                                        <Input
                                                            id="claimant_id_number"
                                                            value={data.claimant_id_number}
                                                            onChange={(e) => setData('claimant_id_number', e.target.value)}
                                                        />
                                                        <InputError message={errors.claimant_id_number} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Repeatable asset rows */}
                            <div className="space-y-4">
                                {data.assets.map((asset, index) => (
                                    <Card key={index} className="border-0 shadow-sm">
                                        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
                                            <CardTitle className="text-base">Item {index + 1}</CardTitle>
                                            {data.assets.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeAssetRow(index)}
                                                >
                                                    <Trash2 className="mr-1.5 h-4 w-4" />
                                                    Remove
                                                </Button>
                                            )}
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-6">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`type-${index}`}>Asset Type<span className="text-red-500">*</span></Label>
                                                    <select
                                                        id={`type-${index}`}
                                                        value={asset.type}
                                                        onChange={(e) => updateAsset(index, 'type', e.target.value)}
                                                        className={selectClass}
                                                        required
                                                    >
                                                        {types.map((t) => (
                                                            <option key={t.value} value={t.value}>{t.label}</option>
                                                        ))}
                                                    </select>
                                                    <InputError message={assetError(index, 'type')} />
                                                </div>
                                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`quantity-${index}`}>No. of Units</Label>
                                                        <Input
                                                            id={`quantity-${index}`}
                                                            type="number"
                                                            min="1"
                                                            value={asset.quantity}
                                                            onChange={(e) => updateAsset(index, 'quantity', e.target.value)}
                                                        />
                                                        <InputError message={assetError(index, 'quantity')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`quantity_unit-${index}`}>Unit</Label>
                                                        <select
                                                            id={`quantity_unit-${index}`}
                                                            value={asset.quantity_unit}
                                                            onChange={(e) => updateAsset(index, 'quantity_unit', e.target.value)}
                                                            className={selectClass}
                                                        >
                                                            {QUANTITY_UNIT_OPTIONS.map((unit) => (
                                                                <option key={unit} value={unit}>{unit}</option>
                                                            ))}
                                                        </select>
                                                        <InputError message={assetError(index, 'quantity_unit')} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`species-${index}`}>
                                                        {speciesFieldLabel(asset.type)}<span className="text-red-500">*</span>
                                                    </Label>

                                                    {asset.type === 'log' ? (
                                                        asset.speciesIsOther ? (
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    id={`species-${index}`}
                                                                    placeholder="Enter species"
                                                                    value={asset.species}
                                                                    onChange={(e) => updateAsset(index, 'species', e.target.value)}
                                                                    autoFocus
                                                                    required
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => updateAssetMultiple(index, { speciesIsOther: false, species: '' })}
                                                                >
                                                                    Choose from list
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <select
                                                                id={`species-${index}`}
                                                                value={asset.species}
                                                                onChange={(e) => handleSpeciesSelect(index, e.target.value)}
                                                                className={selectClass}
                                                            >
                                                                <option value="" disabled>Select species…</option>
                                                                {SPECIES_OPTIONS.map((s) => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                        )
                                                    ) : asset.type === 'equipment' ? (
                                                        asset.speciesIsOther ? (
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    id={`species-${index}`}
                                                                    placeholder={speciesFieldPlaceholder(asset.type)}
                                                                    value={asset.species}
                                                                    onChange={(e) => updateAsset(index, 'species', e.target.value)}
                                                                    autoFocus
                                                                    required
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => updateAssetMultiple(index, { speciesIsOther: false, species: '' })}
                                                                >
                                                                    Choose from list
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <select
                                                                id={`species-${index}`}
                                                                value={asset.species}
                                                                onChange={(e) => handleEquipmentSelect(index, e.target.value)}
                                                                className={selectClass}
                                                            >
                                                                <option value="" disabled>Select equipment type…</option>
                                                                {EQUIPMENT_OPTIONS.map((s) => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                        )
                                                    ) : (
                                                        <Input
                                                            id={`species-${index}`}
                                                            placeholder={speciesFieldPlaceholder(asset.type)}
                                                            value={asset.species}
                                                            onChange={(e) => updateAsset(index, 'species', e.target.value)}
                                                            required
                                                        />
                                                    )}

                                                    <InputError message={assetError(index, 'species')} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`apprehending_agency-${index}`}>Apprehending Agency<span className="text-red-500">*</span></Label>
                                                    <Input
                                                        id={`apprehending_agency-${index}`}
                                                        value={asset.apprehending_agency}
                                                        onChange={(e) => updateAsset(index, 'apprehending_agency', e.target.value)}
                                                        required
                                                    />
                                                    <InputError message={assetError(index, 'apprehending_agency')} />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor={`description-${index}`}>Description<span className="text-red-500">*</span></Label>
                                                <Input
                                                    id={`description-${index}`}
                                                    value={asset.description}
                                                    onChange={(e) => updateAsset(index, 'description', e.target.value)}
                                                    required
                                                />
                                                <InputError message={assetError(index, 'description')} />
                                            </div>

                                            {asset.type === 'log' && (
                                                <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-3">
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`dimensions-${index}`}>Dimensions (L × W × H) <span className="text-red-500">*</span></Label>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <Input
                                                                id={`length-${index}`}
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                placeholder="Length"
                                                                value={asset.length}
                                                                onChange={(e) => handleDimensionChange(index, 'length', e.target.value)}
                                                                required
                                                            />
                                                            <Input
                                                                id={`width-${index}`}
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                placeholder="Width"
                                                                value={asset.width}
                                                                onChange={(e) => handleDimensionChange(index, 'width', e.target.value)}
                                                                required
                                                            />
                                                            <Input
                                                                id={`height-${index}`}
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                placeholder="Height"
                                                                value={asset.height}
                                                                onChange={(e) => handleDimensionChange(index, 'height', e.target.value)}
                                                                required
                                                            />
                                                        </div>
                                                        <p className="text-xs text-gray-500">Formula: (Length × Width × Height) / 12 = bd.ft</p>
                                                        <InputError message={assetError(index, 'length')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`volume_bd_ft-${index}`}>Volume (bd.ft)<span className="text-red-500">*</span></Label>
                                                        <Input
                                                            id={`volume_bd_ft-${index}`}
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={asset.volume_bd_ft}
                                                            onChange={(e) => handleVolumeBdFtChange(index, e.target.value)}
                                                            readOnly={Boolean(asset.length || asset.width || asset.height)}
                                                            required
                                                        />
                                                        <InputError message={assetError(index, 'volume_bd_ft')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`volume_cu_m-${index}`}>Volume (cu.m)</Label>
                                                        <Input
                                                            id={`volume_cu_m-${index}`}
                                                            type="number"
                                                            step="0.0001"
                                                            min="0"
                                                            value={asset.volume_cu_m}
                                                            readOnly
                                                            disabled
                                                            className="bg-gray-100"
                                                        />
                                                        <p className="text-xs text-gray-500">Auto-converted from bd.ft</p>
                                                        <InputError message={assetError(index, 'volume_cu_m')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`estimated_value-${index}`}>Estimated Value (php)<span className="text-red-500">*</span></Label>
                                                        <Input
                                                            id={`estimated_value-${index}`}
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={asset.estimated_value}
                                                            onChange={(e) => updateAssetMultiple(index, { estimated_value: e.target.value, estimated_value_auto: false })}
                                                            readOnly={asset.estimated_value_auto}
                                                            className={asset.estimated_value_auto ? 'bg-gray-100' : undefined}
                                                            required
                                                        />
                                                        {asset.estimated_value_auto ? (
                                                            <p className="text-xs text-emerald-700">
                                                                Auto-computed: {asset.volume_bd_ft} bd.ft × ₱{marketPriceMap[`${asset.species}|${apprehensionYear}`]?.toFixed(2)} (market price {apprehensionYear})
                                                            </p>
                                                        ) : asset.type === 'log' && asset.species && !asset.speciesIsOther && apprehensionYear ? (
                                                            <p className="text-xs text-amber-700">
                                                                No market price set for {asset.species} ({apprehensionYear}) — enter manually.
                                                            </p>
                                                        ) : null}
                                                        <InputError message={assetError(index, 'estimated_value')} />
                                                    </div>
                                                </div>
                                            )}

                                            {asset.type === 'vehicle' && (
                                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                                    <div className="max-w-xs space-y-2">
                                                        <Label htmlFor={`plate_number-${index}`}>Conveyance / Plate No.<span className="text-red-500">*</span></Label>
                                                        <Input
                                                            id={`plate_number-${index}`}
                                                            value={asset.plate_number}
                                                            onChange={(e) => updateAsset(index, 'plate_number', e.target.value)}
                                                            required
                                                        />
                                                        <InputError message={assetError(index, 'plate_number')} />
                                                    </div>
                                                </div>
                                            )}

                                            {asset.type !== 'log' && (
                                                <div className="space-y-2 md:max-w-xs">
                                                    <Label htmlFor={`estimated_value_other-${index}`}>Estimated Value (php)<span className="text-red-500">*</span></Label>
                                                    <Input
                                                        id={`estimated_value_other-${index}`}
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={asset.estimated_value}
                                                        onChange={(e) => updateAsset(index, 'estimated_value', e.target.value)}
                                                        required
                                                    />
                                                    <InputError message={assetError(index, 'estimated_value')} />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}

                                <Button type="button" variant="outline" onClick={addAssetRow}>
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    Add Another Item
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-3 pb-8">
                                <Button type="submit" disabled={processing}>Record Incident</Button>
                                <Link href={route('assets.index')}>
                                    <Button type="button" variant="outline">Cancel</Button>
                                </Link>
                            </div>
                        </>
                    )}
                </form>
            </div>

            <CoordinatesPickerModal
                show={showCoordinatesPicker}
                onClose={() => setShowCoordinatesPicker(false)}
                onSelect={(coords) => setData('coordinates', coords)}
                initialCoordinates={data.coordinates}
            />

            {/* Confirmation modal */}
            <Modal show={showConfirmModal} onClose={() => setShowConfirmModal(false)} maxWidth="2xl">
                <div className="max-h-[85vh] overflow-y-auto p-6">
                    <h2 className="text-lg font-medium text-gray-900">Confirm Apprehension Intake</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Please review the details below before recording this incident. Once submitted,
                        an acknowledgement receipt will be generated for each item.
                    </p>

                    <div className="mt-6 space-y-6">
                        {/* Incident-level summary */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <h3 className="text-sm font-semibold text-gray-700">Apprehension Details</h3>
                            {previewCode && (
                                <p className="mt-1 font-mono text-xs font-semibold text-emerald-700">
                                    AAP No.: {previewCode}
                                </p>
                            )}
                            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
                                <div>
                                    <dt className="text-gray-500">Intake Mode</dt>
                                    <dd className="font-medium text-gray-900">{labelFor(modes, data.intake_mode)}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Date of Apprehension</dt>
                                    <dd className="font-medium text-gray-900">{data.date_of_apprehension || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Date Submitted</dt>
                                    <dd className="font-medium text-gray-900">{data.date_report_submitted || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Province</dt>
                                    <dd className="font-medium text-gray-900">Catanduanes</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Municipality</dt>
                                    <dd className="font-medium text-gray-900">
                                        {labelFor(municipalities, data.place_of_apprehension) || '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Area</dt>
                                    <dd className="font-medium text-gray-900">{data.area || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Coordinates</dt>
                                    <dd className="font-medium text-gray-900">{data.coordinates || '—'}</dd>
                                </div>
                                <div className="md:col-span-2">
                                    <dt className="text-gray-500">Apprehending Party</dt>
                                    <dd className="font-medium text-gray-900">
                                        {data.apprehending_parties.filter((p) => p.trim() !== '').join('; ') || '—'}
                                    </dd>
                                </div>
                                <div className="md:col-span-2">
                                    <dt className="text-gray-500">Initial Custodian (before PENRO)</dt>
                                    <dd className="font-medium text-gray-900">
                                        {data.initial_custodian_name || '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Claimant Status</dt>
                                    <dd className="font-medium text-gray-900">
                                        {data.has_claimant
                                            ? `With Claimant — ${data.claimant_offender_name || '—'}`
                                            : 'Without Claimant (unclaimed)'}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {/* Per-item summary */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">
                                Items ({data.assets.length})
                            </h3>
                            {data.assets.map((asset, index) => (
                                <div key={index} className="rounded-lg border border-gray-200 p-4">
                                    <p className="text-sm font-semibold text-gray-800">
                                        Item {index + 1} — {labelFor(types, asset.type)}
                                    </p>
                                    <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm md:grid-cols-2">
                                        <div>
                                            <dt className="text-gray-500">No. of Units</dt>
                                            <dd className="text-gray-900">
                                                {asset.quantity || '—'} {asset.quantity_unit || 'pcs'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500">{speciesFieldLabel(asset.type)}</dt>
                                            <dd className="text-gray-900">{asset.species || '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500">Apprehending Agency</dt>
                                            <dd className="text-gray-900">{asset.apprehending_agency || '—'}</dd>
                                        </div>
                                        <div className="md:col-span-2">
                                            <dt className="text-gray-500">Description</dt>
                                            <dd className="text-gray-900">{asset.description || '—'}</dd>
                                        </div>

                                        {asset.type === 'log' && (
                                            <>
                                                <div>
                                                    <dt className="text-gray-500">Volume (bd.ft)</dt>
                                                    <dd className="text-gray-900">{asset.volume_bd_ft || '—'}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-gray-500">Volume (cu.m)</dt>
                                                    <dd className="text-gray-900">{asset.volume_cu_m || '—'}</dd>
                                                </div>
                                            </>
                                        )}

                                        {asset.type === 'vehicle' && (
                                            <div>
                                                <dt className="text-gray-500">Conveyance / Plate No.</dt>
                                                <dd className="text-gray-900">{asset.plate_number || '—'}</dd>
                                            </div>
                                        )}

                                        <div>
                                            <dt className="text-gray-500">Estimated Value (php)</dt>
                                            <dd className="text-gray-900">{asset.estimated_value || '—'}</dd>
                                        </div>
                                    </dl>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                        <Button type="button" variant="outline" onClick={() => setShowConfirmModal(false)}>
                            Go Back &amp; Edit
                        </Button>
                        <Button type="button" onClick={confirmAndSubmit} disabled={processing}>
                            {processing ? 'Recording…' : 'Confirm & Record Incident'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}