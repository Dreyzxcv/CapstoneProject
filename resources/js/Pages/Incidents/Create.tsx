import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import CoordinatesPickerModal from '@/Components/shared/CoordinatesPickerModal';

interface Option {
    value: string;
    label: string;
}

interface CreateProps {
    types: Option[];
    modes: Option[];
    municipalities: Option[];
    barangaysByMunicipality: Record<string, string[]>;
}

interface AssetRow {
    type: string;
    species: string;
    description: string;
    quantity: string;
    volume_bd_ft: string;
    volume_cu_m: string;
    estimated_value: string;
    plate_number: string;
    municipality_of_origin: string;
    location_apprehended: string;
    apprehending_agency: string;
    mode: string;
    has_ongoing_case: boolean;
    has_confiscation_order: boolean;
}

function emptyAssetRow(defaults: { municipality: string; agency: string; mode: string }): AssetRow {
    return {
        type: 'log',
        species: '',
        description: '',
        quantity: '1',
        volume_bd_ft: '',
        volume_cu_m: '',
        estimated_value: '',
        plate_number: '',
        municipality_of_origin: defaults.municipality,
        location_apprehended: '',
        apprehending_agency: defaults.agency,
        mode: defaults.mode,
        has_ongoing_case: false,
        has_confiscation_order: false,
    };
}

const selectClass =
    'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

export default function IncidentsCreate({ types, modes, municipalities, barangaysByMunicipality }: CreateProps) {
    const defaultMunicipality = municipalities[0]?.value ?? '';
    const defaultAgency = 'PENRO Catanduanes MES';
    const defaultMode = 'apprehended';

    const { data, setData, post, processing, errors } = useForm({
        date_of_apprehension: '',
        place_of_apprehension: '',
        area: '',
        coordinates: '',
        claimant_offender_name: '',
        is_abandoned: false as boolean,
        apprehending_party: 'PENRO Catanduanes MES',
        date_report_submitted: '',
        assets: [emptyAssetRow({ municipality: defaultMunicipality, agency: defaultAgency, mode: defaultMode })] as AssetRow[],
    });

    const [showCoordinatesPicker, setShowCoordinatesPicker] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    function updateAsset(index: number, field: keyof AssetRow, value: string | boolean) {
        const next = [...data.assets];
        next[index] = { ...next[index], [field]: value };
        if (field === 'municipality_of_origin') {
            next[index].location_apprehended = '';
        }
        setData('assets', next);
    }

    function addAssetRow() {
        setData('assets', [
            ...data.assets,
            emptyAssetRow({ municipality: defaultMunicipality, agency: defaultAgency, mode: defaultMode }),
        ]);
    }

    function removeAssetRow(index: number) {
        if (data.assets.length === 1) return;
        setData('assets', data.assets.filter((_, i) => i !== index));
    }

    // Instead of submitting immediately, open the confirmation modal.
    // Native "required" validation still runs first, so this only fires
    // once the visible required fields are actually filled in.
    const handleReviewClick: FormEventHandler = (e) => {
        e.preventDefault();
        setShowConfirmModal(true);
    };

    function confirmAndSubmit() {
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
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="date_of_apprehension">Date of Apprehension</Label>
                                    <Input
                                        id="date_of_apprehension"
                                        type="date"
                                        value={data.date_of_apprehension}
                                        onChange={(e) => setData('date_of_apprehension', e.target.value)}
                                        required
                                    />
                                    <InputError message={errors.date_of_apprehension} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="date_report_submitted">Date Submitted (Apprehension Report)</Label>
                                    <Input
                                        id="date_report_submitted"
                                        type="date"
                                        value={data.date_report_submitted}
                                        onChange={(e) => setData('date_report_submitted', e.target.value)}
                                    />
                                    <InputError message={errors.date_report_submitted} />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="place_of_apprehension">Place of Apprehension</Label>
                                    <Input
                                        id="place_of_apprehension"
                                        value={data.place_of_apprehension}
                                        onChange={(e) => setData('place_of_apprehension', e.target.value)}
                                        required
                                    />
                                    <InputError message={errors.place_of_apprehension} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="area">Area</Label>
                                    <Input
                                        id="area"
                                        placeholder="Forest area / compartment"
                                        value={data.area}
                                        onChange={(e) => setData('area', e.target.value)}
                                    />
                                    <InputError message={errors.area} />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="coordinates">Coordinates</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="coordinates"
                                            placeholder="e.g. 13.5833, 124.2333"
                                            value={data.coordinates}
                                            onChange={(e) => setData('coordinates', e.target.value)}
                                        />
                                        <Button type="button" variant="outline" onClick={() => setShowCoordinatesPicker(true)}>
                                            Pick on Map
                                        </Button>
                                    </div>
                                    <InputError message={errors.coordinates} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="apprehending_party">Apprehending Party</Label>
                                    <Input
                                        id="apprehending_party"
                                        value={data.apprehending_party}
                                        onChange={(e) => setData('apprehending_party', e.target.value)}
                                        required
                                    />
                                    <InputError message={errors.apprehending_party} />
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <div className="grid gap-4 md:grid-cols-2 md:items-end">
                                    <div className="space-y-2">
                                        <Label htmlFor="claimant_offender_name">Claimant / Offender Name</Label>
                                        <Input
                                            id="claimant_offender_name"
                                            placeholder="Leave blank if unknown / abandoned"
                                            value={data.claimant_offender_name}
                                            onChange={(e) => setData('claimant_offender_name', e.target.value)}
                                        />
                                        <InputError message={errors.claimant_offender_name} />
                                    </div>
                                    <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            checked={data.is_abandoned}
                                            onChange={(e) => setData('is_abandoned', e.target.checked)}
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
                                            <Label htmlFor={`type-${index}`}>Asset Type</Label>
                                            <select
                                                id={`type-${index}`}
                                                value={asset.type}
                                                onChange={(e) => updateAsset(index, 'type', e.target.value)}
                                                className={selectClass}
                                            >
                                                {types.map((t) => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                            <InputError message={assetError(index, 'type')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`mode-${index}`}>Intake Mode</Label>
                                            <select
                                                id={`mode-${index}`}
                                                value={asset.mode}
                                                onChange={(e) => updateAsset(index, 'mode', e.target.value)}
                                                className={selectClass}
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
                                            <Label htmlFor={`species-${index}`}>Species</Label>
                                            <Input
                                                id={`species-${index}`}
                                                value={asset.species}
                                                onChange={(e) => updateAsset(index, 'species', e.target.value)}
                                            />
                                            <InputError message={assetError(index, 'species')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`municipality-${index}`}>Municipality of Origin</Label>
                                            <select
                                                id={`municipality-${index}`}
                                                value={asset.municipality_of_origin}
                                                onChange={(e) => updateAsset(index, 'municipality_of_origin', e.target.value)}
                                                className={selectClass}
                                            >
                                                {municipalities.map((m) => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                            <InputError message={assetError(index, 'municipality_of_origin')} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`description-${index}`}>Description</Label>
                                        <Input
                                            id={`description-${index}`}
                                            value={asset.description}
                                            onChange={(e) => updateAsset(index, 'description', e.target.value)}
                                        />
                                        <InputError message={assetError(index, 'description')} />
                                    </div>

                                    {asset.type === 'log' && (
                                        <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label htmlFor={`volume_bd_ft-${index}`}>Volume (bd.ft)</Label>
                                                <Input
                                                    id={`volume_bd_ft-${index}`}
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={asset.volume_bd_ft}
                                                    onChange={(e) => updateAsset(index, 'volume_bd_ft', e.target.value)}
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
                                                    onChange={(e) => updateAsset(index, 'volume_cu_m', e.target.value)}
                                                />
                                                <InputError message={assetError(index, 'volume_cu_m')} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`estimated_value-${index}`}>Estimated Value (php)</Label>
                                                <Input
                                                    id={`estimated_value-${index}`}
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={asset.estimated_value}
                                                    onChange={(e) => updateAsset(index, 'estimated_value', e.target.value)}
                                                />
                                                <InputError message={assetError(index, 'estimated_value')} />
                                            </div>
                                        </div>
                                    )}

                                    {asset.type === 'vehicle' && (
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                            <div className="max-w-xs space-y-2">
                                                <Label htmlFor={`plate_number-${index}`}>Conveyance / Plate No.</Label>
                                                <Input
                                                    id={`plate_number-${index}`}
                                                    value={asset.plate_number}
                                                    onChange={(e) => updateAsset(index, 'plate_number', e.target.value)}
                                                />
                                                <InputError message={assetError(index, 'plate_number')} />
                                            </div>
                                        </div>
                                    )}

                                    {asset.type !== 'log' && (
                                        <div className="space-y-2 md:max-w-xs">
                                            <Label htmlFor={`estimated_value_other-${index}`}>Estimated Value (php)</Label>
                                            <Input
                                                id={`estimated_value_other-${index}`}
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={asset.estimated_value}
                                                onChange={(e) => updateAsset(index, 'estimated_value', e.target.value)}
                                            />
                                            <InputError message={assetError(index, 'estimated_value')} />
                                        </div>
                                    )}

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor={`location_apprehended-${index}`}>Barangay Apprehended</Label>
                                            <select
                                                id={`location_apprehended-${index}`}
                                                value={asset.location_apprehended}
                                                onChange={(e) => updateAsset(index, 'location_apprehended', e.target.value)}
                                                className={selectClass}
                                                required
                                            >
                                                <option value="" disabled>Select barangay…</option>
                                                {(barangaysByMunicipality[asset.municipality_of_origin] ?? []).map((brgy) => (
                                                    <option key={brgy} value={brgy}>{brgy}</option>
                                                ))}
                                            </select>
                                            <InputError message={assetError(index, 'location_apprehended')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`apprehending_agency-${index}`}>Apprehending Agency</Label>
                                            <Input
                                                id={`apprehending_agency-${index}`}
                                                value={asset.apprehending_agency}
                                                onChange={(e) => updateAsset(index, 'apprehending_agency', e.target.value)}
                                                required
                                            />
                                            <InputError message={assetError(index, 'apprehending_agency')} />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-6">
                                        <label className="flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                checked={asset.has_ongoing_case}
                                                onChange={(e) => updateAsset(index, 'has_ongoing_case', e.target.checked)}
                                            />
                                            Ongoing case (Steady)
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                checked={asset.has_confiscation_order}
                                                onChange={(e) => updateAsset(index, 'has_confiscation_order', e.target.checked)}
                                            />
                                            Confiscation / Forfeiture Order
                                        </label>
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
                                    <dt className="text-gray-500">Place of Apprehension</dt>
                                    <dd className="font-medium text-gray-900">{data.place_of_apprehension || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Area</dt>
                                    <dd className="font-medium text-gray-900">{data.area || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Coordinates</dt>
                                    <dd className="font-medium text-gray-900">{data.coordinates || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Apprehending Party</dt>
                                    <dd className="font-medium text-gray-900">{data.apprehending_party || '—'}</dd>
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
                                            <dt className="text-gray-500">Municipality of Origin</dt>
                                            <dd className="text-gray-900">{labelFor(municipalities, asset.municipality_of_origin)}</dd>
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
                                        <div>
                                            <dt className="text-gray-500">Barangay Apprehended</dt>
                                            <dd className="text-gray-900">{asset.location_apprehended || '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500">Apprehending Agency</dt>
                                            <dd className="text-gray-900">{asset.apprehending_agency || '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500">Ongoing Case</dt>
                                            <dd className="text-gray-900">{asset.has_ongoing_case ? 'Yes' : 'No'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500">Confiscation / Forfeiture Order</dt>
                                            <dd className="text-gray-900">{asset.has_confiscation_order ? 'Yes' : 'No'}</dd>
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