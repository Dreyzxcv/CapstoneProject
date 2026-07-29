import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
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
    volume_bd_ft: string;
    volume_cu_m: string;
    estimated_value: string;
    estimated_value_auto: boolean;
    plate_number: string;
    municipality_of_origin: string;
    location_apprehended: string;
    apprehending_agency: string;
    mode: string;
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

// 1 board foot = 0.002359737 cubic meters.
const BD_FT_TO_CU_M = 0.002359737;

function emptyAssetRow(defaults: { municipality: string; agency: string; mode: string }): AssetRow {
    return {
        type: 'log',
        species: '',
        speciesIsOther: false,
        description: '',
        quantity: '1',
        volume_bd_ft: '',
        volume_cu_m: '',
        estimated_value: '',
        estimated_value_auto: false,
        plate_number: '',
        municipality_of_origin: defaults.municipality,
        location_apprehended: defaults.municipality,
        apprehending_agency: defaults.agency,
        mode: defaults.mode,
    };
}

const selectClass =
    'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

function convertBdFtToCuM(bdFt: string): string {
    const value = parseFloat(bdFt);
    if (Number.isNaN(value) || value <= 0) return '';
    return (value * BD_FT_TO_CU_M).toFixed(4);
}

export default function IncidentsCreate({ types, modes, municipalities, nextAssetSequence, marketPrices }: CreateProps) {
    const defaultMunicipality = municipalities[0]?.value ?? '';
    const defaultAgency = 'PENRO Catanduanes MES';
    const defaultMode = 'apprehended';

    const { data, setData, post, processing, errors, transform } = useForm({
        date_of_apprehension: '',
        place_of_apprehension: defaultMunicipality,
        area: '',
        coordinates: '',
        claimant_offender_name: '',
        is_abandoned: false as boolean,
        apprehending_parties: ['PENRO Catanduanes MES'] as string[],
        date_report_submitted: '',
        assets: [emptyAssetRow({ municipality: defaultMunicipality, agency: defaultAgency, mode: defaultMode })] as AssetRow[],
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
    const previewYear = data.date_of_apprehension
        ? new Date(data.date_of_apprehension).getFullYear()
        : null;
    const previewCode = previewYear
        ? `AAP-FV-${previewYear}-${String(nextAssetSequence).padStart(5, '0')}`
        : null;

    function updateAsset(index: number, field: keyof AssetRow, value: string | boolean) {
        const next = [...data.assets];
        let updated = { ...next[index], [field]: value } as AssetRow;
        if (field === 'type') {
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
            emptyAssetRow({ municipality: data.place_of_apprehension || defaultMunicipality, agency: defaultAgency, mode: defaultMode }),
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

    function handleAbandonedToggle(checked: boolean) {
        setData((prevData) => ({
            ...prevData,
            is_abandoned: checked,
            // Clear any claimant name once the item is marked abandoned,
            // since there's no claimant to record.
            claimant_offender_name: checked ? '' : prevData.claimant_offender_name,
            assets: checked
                ? prevData.assets.map((asset) => ({ ...asset, mode: 'abandoned' }))
                : prevData.assets,
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
                                        AAP No.: {previewCode}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500">
                                        AAP No. will appear once the date of apprehension is set.
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

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <div className="grid gap-4 md:grid-cols-2 md:items-end">
                                    <div className="space-y-2">
                                        <Label htmlFor="claimant_offender_name">Claimant / Offender Name<span className="text-red-500">*</span></Label>
                                        <Input
                                            id="claimant_offender_name"
                                            placeholder={data.is_abandoned ? 'Not applicable — marked abandoned' : 'Leave blank if unknown / abandoned'}
                                            value={data.claimant_offender_name}
                                            onChange={(e) => setData('claimant_offender_name', e.target.value)}
                                            disabled={data.is_abandoned}
                                            required
                                        />
                                        <InputError message={errors.claimant_offender_name} />
                                    </div>
                                    <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            checked={data.is_abandoned}
                                            onChange={(e) => handleAbandonedToggle(e.target.checked)}
                                        />
                                        Abandoned (no known claimant)
                                    </label>
                                </div>
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
                                    <div className="grid gap-4 md:grid-cols-3">
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
                                        <div className="space-y-2">
                                            <Label htmlFor={`mode-${index}`}>Intake Mode<span className="text-red-500">*</span></Label>
                                            <select
                                                id={`mode-${index}`}
                                                value={asset.mode}
                                                onChange={(e) => updateAsset(index, 'mode', e.target.value)}
                                                className={selectClass}
                                                required
                                            >
                                                {modes.map((m) => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                            <InputError message={assetError(index, 'mode')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`quantity-${index}`}>No. of pcs</Label>
                                            <Input
                                                id={`quantity-${index}`}
                                                type="number"
                                                min="1"
                                                value={asset.quantity}
                                                onChange={(e) => updateAsset(index, 'quantity', e.target.value)}
                                            />
                                            <InputError message={assetError(index, 'quantity')} />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor={`species-${index}`}>Species<span className="text-red-500">*</span></Label>
                                            {asset.speciesIsOther ? (
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
                                                <Label htmlFor={`volume_bd_ft-${index}`}>Volume (bd.ft)<span className="text-red-500">*</span></Label>
                                                <Input
                                                    id={`volume_bd_ft-${index}`}
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={asset.volume_bd_ft}
                                                    onChange={(e) => handleVolumeBdFtChange(index, e.target.value)}
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
                                <div>
                                    <dt className="text-gray-500">Claimant / Offender</dt>
                                    <dd className="font-medium text-gray-900">
                                        {data.is_abandoned ? 'Abandoned (no known claimant)' : (data.claimant_offender_name || '—')}
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
                                            <dt className="text-gray-500">Mode</dt>
                                            <dd className="text-gray-900">{labelFor(modes, asset.mode)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500">No. of pcs</dt>
                                            <dd className="text-gray-900">{asset.quantity || '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500">Species</dt>
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