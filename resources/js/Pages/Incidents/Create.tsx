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

// One physical piece encoded individually by MES
interface PieceRow {
    species: string;
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
}

interface AssetRow {
    type: string;
    apprehending_agency: string;
    municipality_of_origin: string;
    location_apprehended: string;
    mode: string;
    has_ongoing_case: boolean;
    has_confiscation_order: boolean;
    // Each item is broken into individually-measured pieces
    pieces: PieceRow[];
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

const EQUIPMENT_OPTIONS = [
    'Chainsaw',
    'Power Saw',
    'Handheld Circular Saw',
    'Winch / Cable Puller',
    'Hand Tools (Axe, Bolo, Wedge)',
    'Others',
];

const BD_FT_TO_CU_M = 0.002359737;

function emptyPieceRow(species = ''): PieceRow {
    return {
        species,
        speciesIsOther: false,
        description: '',
        length: '',
        width: '',
        height: '',
        volume_bd_ft: '',
        volume_cu_m: '',
        estimated_value: '',
        estimated_value_auto: false,
        plate_number: '',
    };
}

function emptyAssetRow(defaults: { municipality: string; agency: string; mode: string }): AssetRow {
    return {
        type: 'log',
        apprehending_agency: defaults.agency,
        municipality_of_origin: defaults.municipality,
        location_apprehended: defaults.municipality,
        mode: defaults.mode,
        has_ongoing_case: false,
        has_confiscation_order: false,
        pieces: [emptyPieceRow()],
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
    const l = parseFloat(length);
    const w = parseFloat(width);
    const h = parseFloat(height);
    if ([l, w, h].some((v) => Number.isNaN(v) || v <= 0)) return '';
    return ((l * w * h) / 12).toFixed(2);
}

function speciesFieldLabel(type: string): string {
    switch (type) {
        case 'vehicle':   return 'Conveyance / Vehicle Type';
        case 'equipment': return 'Equipment Type';
        default:          return 'Species';
    }
}

function speciesFieldPlaceholder(type: string): string {
    switch (type) {
        case 'vehicle':   return 'e.g. Motorcycle, Tricycle, Habal-habal';
        case 'equipment': return 'e.g. Chainsaw, Power Saw';
        default:          return 'Enter species';
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
        initial_custodian_name: '',
        date_report_submitted: '',
        assets: [emptyAssetRow({ municipality: defaultMunicipality, agency: defaultAgency, mode: '' })] as AssetRow[],
    });

    const marketPriceMap = useMemo(() => {
        const map: Record<string, number> = {};
        marketPrices.forEach((mp) => {
            map[`${mp.species}|${mp.year}`] = Number(mp.price_per_bd_ft);
        });
        return map;
    }, [marketPrices]);

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

    // ── Piece helpers ────────────────────────────────────────────────────────

    function withPieceAutoEstimate(piece: PieceRow, species: string, year: number | null): PieceRow {
        if (piece.speciesIsOther || !species || !year) {
            return { ...piece, estimated_value_auto: false };
        }
        const price = marketPriceMap[`${species}|${year}`];
        const volume = parseFloat(piece.volume_bd_ft);
        if (price === undefined || Number.isNaN(volume) || volume <= 0) {
            return { ...piece, estimated_value_auto: false };
        }
        return {
            ...piece,
            estimated_value: (volume * price).toFixed(2),
            estimated_value_auto: true,
        };
    }

    function updatePiece(assetIndex: number, pieceIndex: number, fields: Partial<PieceRow>, recompute = false) {
        const nextAssets = [...data.assets];
        const nextPieces = [...nextAssets[assetIndex].pieces];
        let updated = { ...nextPieces[pieceIndex], ...fields };
        if (recompute) {
            updated = withPieceAutoEstimate(updated, updated.species, apprehensionYear);
        }
        nextPieces[pieceIndex] = updated;
        nextAssets[assetIndex] = { ...nextAssets[assetIndex], pieces: nextPieces };
        setData('assets', nextAssets);
    }

    function handlePieceDimensionChange(
        assetIndex: number,
        pieceIndex: number,
        field: 'length' | 'width' | 'height',
        value: string,
    ) {
        const asset = data.assets[assetIndex];
        const piece = asset.pieces[pieceIndex];
        const updated = { ...piece, [field]: value };

        if (asset.type === 'log') {
            const bdFt = calculateBdFtFromDimensions(updated.length, updated.width, updated.height);
            updated.volume_bd_ft = bdFt;
            updated.volume_cu_m  = convertBdFtToCuM(bdFt);
            const withEstimate = withPieceAutoEstimate(updated, updated.species, apprehensionYear);
            const nextAssets = [...data.assets];
            const nextPieces = [...nextAssets[assetIndex].pieces];
            nextPieces[pieceIndex] = withEstimate;
            nextAssets[assetIndex] = { ...nextAssets[assetIndex], pieces: nextPieces };
            setData('assets', nextAssets);
            return;
        }

        updatePiece(assetIndex, pieceIndex, { [field]: value });
    }

    function handlePieceVolumeBdFtChange(assetIndex: number, pieceIndex: number, value: string) {
        updatePiece(assetIndex, pieceIndex, {
            volume_bd_ft: value,
            volume_cu_m: convertBdFtToCuM(value),
        }, true);
    }

    function handlePieceSpeciesSelect(assetIndex: number, pieceIndex: number, value: string) {
        if (value === 'Others') {
            updatePiece(assetIndex, pieceIndex, { species: '', speciesIsOther: true, estimated_value_auto: false });
        } else {
            updatePiece(assetIndex, pieceIndex, { species: value, speciesIsOther: false }, true);
        }
    }

    function handlePieceEquipmentSelect(assetIndex: number, pieceIndex: number, value: string) {
        if (value === 'Others') {
            updatePiece(assetIndex, pieceIndex, { species: '', speciesIsOther: true });
        } else {
            updatePiece(assetIndex, pieceIndex, { species: value, speciesIsOther: false });
        }
    }

    function addPiece(assetIndex: number) {
        const asset = data.assets[assetIndex];
        // Inherit species from last piece for convenience
        const lastPiece = asset.pieces[asset.pieces.length - 1];
        const inheritedSpecies = lastPiece?.speciesIsOther ? '' : (lastPiece?.species ?? '');
        const nextAssets = [...data.assets];
        nextAssets[assetIndex] = {
            ...nextAssets[assetIndex],
            pieces: [...asset.pieces, emptyPieceRow(inheritedSpecies)],
        };
        setData('assets', nextAssets);
    }

    function removePiece(assetIndex: number, pieceIndex: number) {
        const asset = data.assets[assetIndex];
        if (asset.pieces.length === 1) return;
        const nextAssets = [...data.assets];
        nextAssets[assetIndex] = {
            ...nextAssets[assetIndex],
            pieces: asset.pieces.filter((_, i) => i !== pieceIndex),
        };
        setData('assets', nextAssets);
    }

    // ── Asset-row helpers ────────────────────────────────────────────────────

    function updateAsset(index: number, field: keyof AssetRow, value: string | boolean) {
        const next = [...data.assets];
        next[index] = { ...next[index], [field]: value } as AssetRow;
        setData('assets', next);
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

    // ── Incident-level helpers ───────────────────────────────────────────────

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
                assets: prevData.assets.map((asset) => ({
                    ...asset,
                    pieces: asset.pieces.map((piece) =>
                        withPieceAutoEstimate(piece, piece.species, year),
                    ),
                })),
            };
        });
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

    const handleReviewClick: FormEventHandler = (e) => {
        e.preventDefault();
        setShowConfirmModal(true);
    };

    function confirmAndSubmit() {
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

    function pieceError(assetIndex: number, pieceIndex: number, field: string): string | undefined {
        return (errors as Record<string, string>)[`assets.${assetIndex}.pieces.${pieceIndex}.${field}`];
    }

    function labelFor(options: Option[], value: string): string {
        return options.find((o) => o.value === value)?.label ?? value;
    }

    // ── Piece form — rendered inside each asset card ──────────────────────────

    function renderPieceForm(asset: AssetRow, assetIndex: number, pieceIndex: number) {
        const piece = asset.pieces[pieceIndex];
        const isLog = asset.type === 'log';
        const isVehicle = asset.type === 'vehicle';

        return (
            <div
                key={pieceIndex}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                        Piece {pieceIndex + 1}
                    </span>
                    {asset.pieces.length > 1 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePiece(assetIndex, pieceIndex)}
                        >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Remove
                        </Button>
                    )}
                </div>

                {/* Species / Equipment / Vehicle type per piece */}
                <div className="space-y-2">
                    <Label htmlFor={`piece-species-${assetIndex}-${pieceIndex}`}>
                        {speciesFieldLabel(asset.type)}<span className="text-red-500">*</span>
                    </Label>

                    {isLog ? (
                        piece.speciesIsOther ? (
                            <div className="flex gap-2">
                                <Input
                                    id={`piece-species-${assetIndex}-${pieceIndex}`}
                                    placeholder="Enter species"
                                    value={piece.species}
                                    onChange={(e) => updatePiece(assetIndex, pieceIndex, { species: e.target.value })}
                                    autoFocus
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updatePiece(assetIndex, pieceIndex, { speciesIsOther: false, species: '' })}
                                >
                                    Choose from list
                                </Button>
                            </div>
                        ) : (
                            <select
                                id={`piece-species-${assetIndex}-${pieceIndex}`}
                                value={piece.species}
                                onChange={(e) => handlePieceSpeciesSelect(assetIndex, pieceIndex, e.target.value)}
                                className={selectClass}
                            >
                                <option value="" disabled>Select species…</option>
                                {SPECIES_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        )
                    ) : asset.type === 'equipment' ? (
                        piece.speciesIsOther ? (
                            <div className="flex gap-2">
                                <Input
                                    id={`piece-species-${assetIndex}-${pieceIndex}`}
                                    placeholder={speciesFieldPlaceholder(asset.type)}
                                    value={piece.species}
                                    onChange={(e) => updatePiece(assetIndex, pieceIndex, { species: e.target.value })}
                                    autoFocus
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updatePiece(assetIndex, pieceIndex, { speciesIsOther: false, species: '' })}
                                >
                                    Choose from list
                                </Button>
                            </div>
                        ) : (
                            <select
                                id={`piece-species-${assetIndex}-${pieceIndex}`}
                                value={piece.species}
                                onChange={(e) => handlePieceEquipmentSelect(assetIndex, pieceIndex, e.target.value)}
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
                            id={`piece-species-${assetIndex}-${pieceIndex}`}
                            placeholder={speciesFieldPlaceholder(asset.type)}
                            value={piece.species}
                            onChange={(e) => updatePiece(assetIndex, pieceIndex, { species: e.target.value })}
                            required
                        />
                    )}
                    <InputError message={pieceError(assetIndex, pieceIndex, 'species')} />
                </div>

                {/* Description per piece */}
                <div className="space-y-2">
                    <Label htmlFor={`piece-desc-${assetIndex}-${pieceIndex}`}>Description</Label>
                    <Input
                        id={`piece-desc-${assetIndex}-${pieceIndex}`}
                        value={piece.description}
                        onChange={(e) => updatePiece(assetIndex, pieceIndex, { description: e.target.value })}
                        placeholder="e.g. squared, rough-cut, with bark"
                    />
                    <InputError message={pieceError(assetIndex, pieceIndex, 'description')} />
                </div>

                {/* Log: dimensions → auto-computed volume + estimated value */}
                {isLog && (
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Dimensions (L × W × H) <span className="text-red-500">*</span></Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['length', 'width', 'height'] as const).map((dim) => (
                                    <Input
                                        key={dim}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder={dim.charAt(0).toUpperCase() + dim.slice(1)}
                                        value={piece[dim]}
                                        onChange={(e) => handlePieceDimensionChange(assetIndex, pieceIndex, dim, e.target.value)}
                                        required
                                    />
                                ))}
                            </div>
                            <InputError message={pieceError(assetIndex, pieceIndex, 'length')} />
                        </div>
                        <div className="space-y-2">
                            <Label>Volume (bd.ft)<span className="text-red-500">*</span></Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={piece.volume_bd_ft}
                                onChange={(e) => handlePieceVolumeBdFtChange(assetIndex, pieceIndex, e.target.value)}
                                disabled
                                className="bg-gray-100"
                            />
                            <p className="text-xs text-gray-500">Auto-converted from dimensions</p>
                            <InputError message={pieceError(assetIndex, pieceIndex, 'volume_bd_ft')} />
                        </div>
                        <div className="space-y-2">
                            <Label>Volume (cu.m)</Label>
                            <Input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={piece.volume_cu_m}
                                readOnly
                                disabled
                                className="bg-gray-100"
                            />
                            <p className="text-xs text-gray-500">Auto-converted from bd.ft</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Estimated Value (php)<span className="text-red-500">*</span></Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={piece.estimated_value}
                                onChange={(e) =>
                                    updatePiece(assetIndex, pieceIndex, {
                                        estimated_value: e.target.value,
                                        estimated_value_auto: false,
                                    })
                                }
                                readOnly={piece.estimated_value_auto}
                                className={piece.estimated_value_auto ? 'bg-gray-100' : undefined}
                                required
                            />
                            {piece.estimated_value_auto ? (
                                <p className="text-xs text-emerald-700">
                                    Auto-computed: {piece.volume_bd_ft} bd.ft × ₱
                                    {marketPriceMap[`${piece.species}|${apprehensionYear}`]?.toFixed(2)} (market price {apprehensionYear})
                                </p>
                            ) : piece.species && !piece.speciesIsOther && apprehensionYear ? (
                                <p className="text-xs text-amber-700">
                                    No market price set for {piece.species} ({apprehensionYear}) — enter manually.
                                </p>
                            ) : null}
                            <InputError message={pieceError(assetIndex, pieceIndex, 'estimated_value')} />
                        </div>
                    </div>
                )}

                {/* Vehicle: plate number per piece */}
                {isVehicle && (
                    <div className="max-w-xs space-y-2">
                        <Label htmlFor={`piece-plate-${assetIndex}-${pieceIndex}`}>
                            Conveyance / Plate No.<span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id={`piece-plate-${assetIndex}-${pieceIndex}`}
                            value={piece.plate_number}
                            onChange={(e) => updatePiece(assetIndex, pieceIndex, { plate_number: e.target.value })}
                            required
                        />
                        <InputError message={pieceError(assetIndex, pieceIndex, 'plate_number')} />
                    </div>
                )}

                {/* Non-log estimated value */}
                {!isLog && (
                    <div className="max-w-xs space-y-2">
                        <Label htmlFor={`piece-value-${assetIndex}-${pieceIndex}`}>
                            Estimated Value (php)<span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id={`piece-value-${assetIndex}-${pieceIndex}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={piece.estimated_value}
                            onChange={(e) => updatePiece(assetIndex, pieceIndex, { estimated_value: e.target.value })}
                            required
                        />
                        <InputError message={pieceError(assetIndex, pieceIndex, 'estimated_value')} />
                    </div>
                )}
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">MES Apprehension Intake</h2>}>
            <Head title="New Apprehension Intake" />

            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                <form onSubmit={handleReviewClick} className="space-y-6">
                    {/* Intake Mode */}
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
                                    Select Apprehended or Turned Over above to continue.
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
                                                    disabled
                                                    required
                                                />
                                                <Button type="button" variant="outline" onClick={() => setShowCoordinatesPicker(true)}>
                                                    Pick on Map
                                                </Button>
                                            </div>
                                            <InputError message={errors.coordinates} />
                                        </div>

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
                                            Leave blank if PENRO received it directly.
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
                                {data.assets.map((asset, assetIndex) => (
                                    <Card key={assetIndex} className="border-0 shadow-sm">
                                        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
                                            <CardTitle className="text-base">
                                                Item {assetIndex + 1}
                                                <span className="ml-2 text-xs font-normal text-gray-500">
                                                    ({asset.pieces.length} {asset.pieces.length === 1 ? 'piece' : 'pieces'})
                                                </span>
                                            </CardTitle>
                                            {data.assets.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeAssetRow(assetIndex)}
                                                >
                                                    <Trash2 className="mr-1.5 h-4 w-4" />
                                                    Remove Item
                                                </Button>
                                            )}
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-6">
                                            {/* Asset-level fields (container) */}
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`type-${assetIndex}`}>Asset Type<span className="text-red-500">*</span></Label>
                                                    <select
                                                        id={`type-${assetIndex}`}
                                                        value={asset.type}
                                                        onChange={(e) => updateAsset(assetIndex, 'type', e.target.value)}
                                                        className={selectClass}
                                                        required
                                                    >
                                                        {types.map((t) => (
                                                            <option key={t.value} value={t.value}>{t.label}</option>
                                                        ))}
                                                    </select>
                                                    <InputError message={assetError(assetIndex, 'type')} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`apprehending_agency-${assetIndex}`}>Apprehending Agency<span className="text-red-500">*</span></Label>
                                                    <Input
                                                        id={`apprehending_agency-${assetIndex}`}
                                                        value={asset.apprehending_agency}
                                                        onChange={(e) => updateAsset(assetIndex, 'apprehending_agency', e.target.value)}
                                                        required
                                                    />
                                                    <InputError message={assetError(assetIndex, 'apprehending_agency')} />
                                                </div>
                                            </div>

                                            {/* Legal flags */}
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                                <Label className="mb-2 block">Legal</Label>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateAsset(assetIndex, 'has_ongoing_case', !asset.has_ongoing_case)}
                                                        className={
                                                            'rounded-md border px-4 py-2 text-sm font-medium transition ' +
                                                            (asset.has_ongoing_case
                                                                ? 'border-amber-600 bg-amber-100 text-amber-900'
                                                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')
                                                        }
                                                    >
                                                        {asset.has_ongoing_case ? 'Ongoing case' : 'No ongoing case'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateAsset(assetIndex, 'has_confiscation_order', !asset.has_confiscation_order)}
                                                        className={
                                                            'rounded-md border px-4 py-2 text-sm font-medium transition ' +
                                                            (asset.has_confiscation_order
                                                                ? 'border-red-600 bg-red-100 text-red-900'
                                                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')
                                                        }
                                                    >
                                                        {asset.has_confiscation_order ? 'Confiscation / Forfeiture Order' : 'No order yet'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Per-piece forms */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold text-gray-700">
                                                        Pieces — encode each one individually
                                                    </h4>
                                                    <span className="text-xs text-gray-500">
                                                        {asset.pieces.length} {asset.pieces.length === 1 ? 'piece' : 'pieces'} total
                                                    </span>
                                                </div>

                                                {asset.pieces.map((_, pieceIndex) =>
                                                    renderPieceForm(asset, assetIndex, pieceIndex),
                                                )}

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => addPiece(assetIndex)}
                                                >
                                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                    Add Piece
                                                </Button>
                                            </div>
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
                        Please review the details below before recording this incident.
                    </p>

                    <div className="mt-6 space-y-6">
                        {/* Incident summary */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <h3 className="text-sm font-semibold text-gray-700">Apprehension Details</h3>
                            {previewCode && (
                                <p className="mt-1 font-mono text-xs font-semibold text-emerald-700">
                                    Asset ID: {previewCode}
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
                                    <dt className="text-gray-500">Municipality</dt>
                                    <dd className="font-medium text-gray-900">
                                        {labelFor(municipalities, data.place_of_apprehension) || '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Area</dt>
                                    <dd className="font-medium text-gray-900">{data.area || '—'}</dd>
                                </div>
                                <div className="md:col-span-2">
                                    <dt className="text-gray-500">Apprehending Party</dt>
                                    <dd className="font-medium text-gray-900">
                                        {data.apprehending_parties.filter((p) => p.trim() !== '').join('; ') || '—'}
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

                        {/* Per-item + per-piece summary */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">
                                Items ({data.assets.length}) — {data.assets.reduce((sum, a) => sum + a.pieces.length, 0)} pieces total
                            </h3>
                            {data.assets.map((asset, assetIndex) => (
                                <div key={assetIndex} className="rounded-lg border border-gray-200 p-4">
                                    <p className="text-sm font-semibold text-gray-800">
                                        Item {assetIndex + 1} — {labelFor(types, asset.type)} ({asset.pieces.length} {asset.pieces.length === 1 ? 'piece' : 'pieces'})
                                    </p>
                                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm md:grid-cols-2">
                                        <div>
                                            <dt className="text-gray-500">Ongoing Case</dt>
                                            <dd className="text-gray-900">{asset.has_ongoing_case ? 'Yes' : 'No'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500">Confiscation / Forfeiture Order</dt>
                                            <dd className="text-gray-900">{asset.has_confiscation_order ? 'Yes' : 'No'}</dd>
                                        </div>
                                    </dl>

                                    {/* Piece breakdown */}
                                    <div className="mt-3 space-y-2">
                                        {asset.pieces.map((piece, pieceIndex) => (
                                            <div key={pieceIndex} className="rounded border border-gray-100 bg-gray-50 p-3 text-sm">
                                                <p className="font-medium text-gray-700 mb-1">Piece {pieceIndex + 1}</p>
                                                <dl className="grid gap-x-4 gap-y-1 md:grid-cols-3">
                                                    <div>
                                                        <dt className="text-gray-500">{speciesFieldLabel(asset.type)}</dt>
                                                        <dd className="text-gray-900">{piece.species || '—'}</dd>
                                                    </div>
                                                    {asset.type === 'log' && (
                                                        <>
                                                            <div>
                                                                <dt className="text-gray-500">Dimensions (L×W×H)</dt>
                                                                <dd className="text-gray-900">
                                                                    {piece.length || '—'} × {piece.width || '—'} × {piece.height || '—'}
                                                                </dd>
                                                            </div>
                                                            <div>
                                                                <dt className="text-gray-500">Volume (bd.ft)</dt>
                                                                <dd className="text-gray-900">{piece.volume_bd_ft || '—'}</dd>
                                                            </div>
                                                        </>
                                                    )}
                                                    {asset.type === 'vehicle' && (
                                                        <div>
                                                            <dt className="text-gray-500">Plate No.</dt>
                                                            <dd className="text-gray-900">{piece.plate_number || '—'}</dd>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <dt className="text-gray-500">Est. Value</dt>
                                                        <dd className="text-gray-900">
                                                            {piece.estimated_value ? `₱${Number(piece.estimated_value).toLocaleString()}` : '—'}
                                                        </dd>
                                                    </div>
                                                </dl>
                                            </div>
                                        ))}
                                    </div>
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