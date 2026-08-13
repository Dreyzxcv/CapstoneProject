import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Asset } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useMemo, useState } from 'react';
import CoordinatesPickerModal from '@/Components/shared/CoordinatesPickerModal';
import { IncidentLocationMap } from '@/Components/shared/IncidentLocationMap';
import { MapPin, Plus, Trash2, ScanLine } from 'lucide-react';
import AssetScanModal, { ScannedAsset } from '@/Components/shared/AssetScanModal';

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
    // Optional per-piece info if the asset was added via a per-piece QR scan
    piece_number?: number | null;
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
}

const selectClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm';

export default function DisposalsCreate({
    asset,
    disposalTypes,
    municipalities,
    barangaysByMunicipality,
    availableAssets,
}: DisposalsCreateProps) {
    const assetQuantity = asset.remaining_quantity ?? asset.quantity ?? 1;

    const ORG_TYPES = [
        { value: 'academe', label: 'Academe' },
        { value: 'national_agency', label: 'National Agency' },
        { value: 'lgu', label: 'LGU' },
        { value: 'individual', label: 'Individual' },
        { value: 'other', label: 'Other' },
    ];

    const [scanning, setScanning] = useState(false);
    const [extraAssets, setExtraAssets] = useState<DonatableAsset[]>([]);

    // Current asset + whatever other donatable log assets the controller
    // sent along, combined so the line-item picker can look either up.
    const allDonatableAssets: DonatableAsset[] = useMemo(
        () => [
            {
                id: asset.id,
                asset_code: asset.asset_code,
                species: asset.species,
                description: asset.description,
                quantity: asset.quantity ?? 1,
                remaining_quantity: assetQuantity,
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

    function handleAssetScanned(scanned: ScannedAsset) {
        setExtraAssets((prev) => (prev.some((a) => a.id === scanned.id) ? prev : [...prev, scanned]));

        setData((prevData) => {
            const alreadyIndex = prevData.lines.findIndex((l) => l.asset_id === String(scanned.id));
            if (alreadyIndex !== -1) return prevData;

            const emptyIndex = prevData.lines.findIndex((l) => !l.asset_id);
            const newLine = { asset_id: String(scanned.id), quantity: String(scanned.remaining_quantity) };

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

    const { data, setData, post, processing, errors } = useForm({
        disposal_type: disposalTypes[0]?.value ?? '',
        quantity: String(assetQuantity),
        // Donation line items — this asset is pre-added as the first line
        // since the user got here by clicking "Process" on it specifically.
        lines: [{ asset_id: String(asset.id), quantity: String(assetQuantity) }] as DonationLine[],
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
    });

    const [showCoordinatesPicker, setShowCoordinatesPicker] = useState(false);

    const isDonation = data.disposal_type === 'donation';
    const isVehicleDecision = data.disposal_type === 'released' || data.disposal_type === 'forfeited';
    const appealDeadlinePassed = asset.appeal_deadline ? new Date(asset.appeal_deadline) <= new Date() : null;

    const quantityValue = Number(data.quantity) || 0;
    const remainder = assetQuantity - quantityValue;

    function handleMunicipalityChange(value: string) {
        setData('municipality', value);
        setData('barangay', '');
    }

    function lineError(index: number, field: 'asset_id' | 'quantity'): string | undefined {
        return (errors as Record<string, string>)[`lines.${index}.${field}`];
    }

    function updateLine(index: number, field: keyof DonationLine, value: string) {
        const next = [...data.lines];
        next[index] = { ...next[index], [field]: value };

        if (field === 'asset_id') {
            const selected = assetsById.get(value);
            if (selected && !next[index].quantity) {
                next[index].quantity = String(selected.remaining_quantity);
            }
        }

        setData('lines', next);
    }

    function addLine() {
        setData('lines', [...data.lines, { asset_id: '', quantity: '' }]);
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

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        if (isDonation) {
            const lineSummaries = data.lines
                .map((line) => {
                    const donatable = assetsById.get(line.asset_id);
                    return donatable ? `${line.quantity || '?'} pc(s) of ${donatable.asset_code}` : null;
                })
                .filter(Boolean)
                .join(', ');

            if (confirm(`Confirm donation of ${lineSummaries} to ${data.requester_name || 'this recipient'}? This cannot be undone.`)) {
                post(route('disposals.donate.store'));
            }
            return;
        }

        const confirmMsg =
            remainder > 0
                ? `Confirm disposal of ${quantityValue} of ${assetQuantity} unit(s)? The remaining ${remainder} unit(s) will be split into a new asset record and kept in storage.`
                : 'Confirm disposal action? This cannot be undone.';
        if (confirm(confirmMsg)) {
            post(route('disposals.store', asset.id));
        }
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Process Disposal</h2>}>
            <Head title="Process Disposal" />

            <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
                <p className="mb-4 text-sm text-gray-600">
                    Asset: <strong>{asset.asset_code}</strong> ({asset.type}) — {assetQuantity} unit(s) on hand
                </p>

                <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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

                    {isDonation ? (
                        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Assets to Donate
                            </p>
                            <p className="text-xs text-gray-500">
                                {asset.asset_code} is already added below. Add more log assets to this donation if needed.
                            </p>

                            {data.lines.map((line, index) => {
                                const selectedAsset = assetsById.get(line.asset_id);
                                const options = availableOptionsFor(index);

                                return (
                                    <div key={index} className="rounded-lg border border-gray-200 bg-white p-3">
                                        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                                            <div>
                                                <Label htmlFor={`line-asset-${index}`}>Asset</Label>
                                                <select
                                                    id={`line-asset-${index}`}
                                                    value={line.asset_id}
                                                    onChange={(e) => updateLine(index, 'asset_id', e.target.value)}
                                                    className={selectClass}
                                                    required
                                                >
                                                    <option value="" disabled>Select an asset…</option>
                                                    {options.map((a) => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.asset_code} — {a.species ?? a.description ?? 'Log'} ({a.remaining_quantity} on hand)
                                                        </option>
                                                    ))}
                                                </select>
                                                <InputError message={lineError(index, 'asset_id')} />
                                                {selectedAsset?.piece_number !== undefined && selectedAsset?.piece_number !== null && (
                                                    <div className="mt-2">
                                                        <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                                                            Piece {selectedAsset.piece_number} / {selectedAsset.quantity ?? 1}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <Label htmlFor={`line-qty-${index}`}>Quantity</Label>
                                                <Input
                                                    id={`line-qty-${index}`}
                                                    type="number"
                                                    min={1}
                                                    max={selectedAsset?.remaining_quantity}
                                                    value={line.quantity}
                                                    onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                                    required
                                                />
                                                <InputError message={lineError(index, 'quantity')} />
                                            </div>
                                            {data.lines.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeLine(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        {selectedAsset &&
                                            Number(line.quantity) > 0 &&
                                            Number(line.quantity) < selectedAsset.remaining_quantity && (
                                                <p className="mt-2 text-xs text-amber-700">
                                                    The remaining {selectedAsset.remaining_quantity - Number(line.quantity)} pc(s) of{' '}
                                                    {selectedAsset.asset_code} will stay available for future disposal.
                                                </p>
                                            )}
                                    </div>
                                );
                            })}

                            {data.lines.length < allDonatableAssets.length && (
                                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Add Another Asset
                                </Button>
                            )}
                            {data.lines.length < allDonatableAssets.length && (
                                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Add Another Asset
                                </Button>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => setScanning(true)}>
                                <ScanLine className="mr-1.5 h-3.5 w-3.5" />
                                Scan Barcode
                            </Button>
                        </div>
                    ) : (
                        !isVehicleDecision && (
                            <div>
                                <Label htmlFor="quantity">Quantity to Dispose</Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    min={1}
                                    max={assetQuantity}
                                    value={data.quantity}
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
                        )
                    )}

                    {isDonation && (
                        <>
                            <div>
                                <Label htmlFor="organization_type">Organization Type</Label>
                                <select
                                    id="organization_type"
                                    value={data.organization_type}
                                    onChange={(e) => setData('organization_type', e.target.value)}
                                    className={selectClass}
                                >
                                    {ORG_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <InputError message={errors.organization_type} />
                            </div>

                            {data.organization_type === 'other' && (
                                <div>
                                    <Label htmlFor="organization_type_other">Specify Type</Label>
                                    <Input
                                        id="organization_type_other"
                                        value={data.organization_type_other}
                                        onChange={(e) => setData('organization_type_other', e.target.value)}
                                    />
                                    <InputError message={errors.organization_type_other} />
                                </div>
                            )}

                            <div>
                                <Label htmlFor="agency_name">Donee Office / Institution Name</Label>
                                <Input
                                    id="agency_name"
                                    placeholder="e.g. Virac Fire Station"
                                    value={data.agency_name}
                                    onChange={(e) => setData('agency_name', e.target.value)}
                                    required
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Printed in the Deed of Donation's signature block (the "DONEE OFFICE" heading).
                                </p>
                                <InputError message={errors.agency_name} />
                            </div>

                            <div>
                                <Label htmlFor="requester_name">Representative Name</Label>
                                <Input
                                    id="requester_name"
                                    value={data.requester_name}
                                    onChange={(e) => setData('requester_name', e.target.value)}
                                    required
                                />
                                <InputError message={errors.requester_name} />
                            </div>

                            <div>
                                <Label htmlFor="donee_position">Representative's Position / Title</Label>
                                <Input
                                    id="donee_position"
                                    placeholder="e.g. Acting Municipal Fire Marshal"
                                    value={data.donee_position}
                                    onChange={(e) => setData('donee_position', e.target.value)}
                                    required
                                />
                                <InputError message={errors.donee_position} />
                            </div>

                            <div>
                                <Label htmlFor="purpose_statement">Purpose / Need Statement</Label>
                                <Input
                                    id="purpose_statement"
                                    placeholder="e.g. for the improvement and renovation of the office space"
                                    value={data.purpose_statement}
                                    onChange={(e) => setData('purpose_statement', e.target.value)}
                                    required
                                />
                                <InputError message={errors.purpose_statement} />
                            </div>

                            <div>
                                <Label htmlFor="confiscation_order_reference">Confiscation Order Reference (optional)</Label>
                                <Input
                                    id="confiscation_order_reference"
                                    placeholder="e.g. CO-2026-0042"
                                    value={data.confiscation_order_reference}
                                    onChange={(e) => setData('confiscation_order_reference', e.target.value)}
                                />
                                <InputError message={errors.confiscation_order_reference} />
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Donee Address
                                </p>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <Label htmlFor="municipality">Municipality</Label>
                                        <select
                                            id="municipality"
                                            value={data.municipality}
                                            onChange={(e) => handleMunicipalityChange(e.target.value)}
                                            className={selectClass}
                                            required
                                        >
                                            {municipalities.map((m) => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                        <InputError message={errors.municipality} />
                                    </div>
                                    <div>
                                        <Label htmlFor="barangay">Barangay</Label>
                                        <select
                                            id="barangay"
                                            value={data.barangay}
                                            onChange={(e) => setData('barangay', e.target.value)}
                                            className={selectClass}
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
                                        onChange={(e) => setData('street', e.target.value)}
                                    />
                                    <InputError message={errors.street} />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="delivery_coordinates">Delivery Location</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="delivery_coordinates"
                                        placeholder="e.g. 13.5833, 124.2333"
                                        value={data.delivery_coordinates}
                                        onChange={(e) => setData('delivery_coordinates', e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowCoordinatesPicker(true)}
                                    >
                                        <MapPin className="mr-1.5 h-4 w-4" />
                                        Pick on Map
                                    </Button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Optional — where the donated logs will be brought, for visualization on the asset record.
                                </p>
                                <InputError message={errors.delivery_coordinates} />

                                {data.delivery_coordinates && (
                                    <div className="mt-3">
                                        <IncidentLocationMap
                                            coordinates={data.delivery_coordinates}
                                            placeName={data.requester_name || 'Donation delivery point'}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Deed of Donation Signatories
                                </p>
                                <p className="mb-3 text-xs text-gray-500">
                                    Leave any of these blank to use the office's standing default for this document.
                                </p>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <Label htmlFor="donor_representative_name">OIC / PENR Officer Name</Label>
                                        <Input
                                            id="donor_representative_name"
                                            placeholder="OIC Name"
                                            value={data.donor_representative_name}
                                            onChange={(e) => setData('donor_representative_name', e.target.value)}
                                        />
                                        <InputError message={errors.donor_representative_name} />
                                    </div>
                                    <div>
                                        <Label htmlFor="donor_representative_title">OIC / PENR Officer Title</Label>
                                        <Input
                                            id="donor_representative_title"
                                            placeholder="e.g. OIC, PENR Officer"
                                            value={data.donor_representative_title}
                                            onChange={(e) => setData('donor_representative_title', e.target.value)}
                                        />
                                        <InputError message={errors.donor_representative_title} />
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div>
                                        <Label htmlFor="witness_1_name">Witness 1 Name</Label>
                                        <Input
                                            id="witness_1_name"
                                            placeholder="Witness 1 Name"
                                            value={data.witness_1_name}
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
                                            onChange={(e) => setData('witness_1_title', e.target.value)}
                                        />
                                        <InputError message={errors.witness_1_title} />
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div>
                                        <Label htmlFor="witness_2_name">Witness 2 Name</Label>
                                        <Input
                                            id="witness_2_name"
                                            placeholder="Witness 2 Name"
                                            value={data.witness_2_name}
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
                                            onChange={(e) => setData('witness_2_title', e.target.value)}
                                        />
                                        <InputError message={errors.witness_2_title} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {isVehicleDecision && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            {asset.appeal_deadline ? (
                                <p>
                                    15-day appeal window {appealDeadlinePassed ? 'closed' : 'closes'} on{' '}
                                    <span className="font-medium">{new Date(asset.appeal_deadline).toLocaleDateString()}</span>.
                                    Release depends on whether the owner appealed within this window; forfeiture is the
                                    default absent a timely appeal, subject to the judge or regional office decision, since
                                    PENRO Catanduanes lacks jurisdiction.
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

                    <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Input id="notes" value={data.notes} onChange={(e) => setData('notes', e.target.value)} />
                    </div>

                    <div className="flex gap-3">
                        <Button type="submit" disabled={processing}>Confirm Disposal</Button>
                        <Link href={route('assets.show', asset.id)}>
                            <Button type="button" variant="outline">Cancel</Button>
                        </Link>
                    </div>
                </form>
            </div>

            <CoordinatesPickerModal
                show={showCoordinatesPicker}
                onClose={() => setShowCoordinatesPicker(false)}
                onSelect={(coords) => setData('delivery_coordinates', coords)}
                initialCoordinates={data.delivery_coordinates}
            />
            <AssetScanModal
                show={scanning}
                onClose={() => setScanning(false)}
                onFound={handleAssetScanned}
            />
        </AuthenticatedLayout>
    );
}