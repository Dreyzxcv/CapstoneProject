import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useMemo, useState } from 'react';
import CoordinatesPickerModal from '@/Components/shared/CoordinatesPickerModal';
import { IncidentLocationMap } from '@/Components/shared/IncidentLocationMap';
import { MapPin, Plus, Trash2 } from 'lucide-react';

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
}

interface CreateBatchDonationProps {
    assets: DonatableAsset[];
    municipalities: Option[];
    barangaysByMunicipality: Record<string, string[]>;
}

interface DonationLine {
    asset_id: string;
    quantity: string;
}

const selectClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm';

const ORG_TYPES = [
    { value: 'academe', label: 'Academe' },
    { value: 'national_agency', label: 'National Agency' },
    { value: 'lgu', label: 'LGU' },
    { value: 'individual', label: 'Individual' },
    { value: 'other', label: 'Other' },
];

export default function CreateBatchDonation({ assets, municipalities, barangaysByMunicipality }: CreateBatchDonationProps) {
    const assetsById = useMemo(() => new Map(assets.map((a) => [String(a.id), a])), [assets]);

    const { data, setData, post, processing, errors } = useForm({
        lines: [{ asset_id: '', quantity: '' }] as DonationLine[],
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
        notes: '',
    });

    const [showCoordinatesPicker, setShowCoordinatesPicker] = useState(false);

    function lineError(index: number, field: 'asset_id' | 'quantity'): string | undefined {
        return (errors as Record<string, string>)[`lines.${index}.${field}`];
    }

    function updateLine(index: number, field: keyof DonationLine, value: string) {
        const next = [...data.lines];
        next[index] = { ...next[index], [field]: value };

        // Default quantity to the asset's full on-hand amount when first selected.
        if (field === 'asset_id') {
            const asset = assetsById.get(value);
            if (asset && !next[index].quantity) {
                next[index].quantity = String(asset.remaining_quantity);
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

    // Prevent picking the same asset twice across different lines.
    function availableOptionsFor(currentIndex: number): DonatableAsset[] {
        const chosenElsewhere = new Set(
            data.lines.filter((_, i) => i !== currentIndex).map((l) => l.asset_id).filter(Boolean),
        );
        return assets.filter((a) => !chosenElsewhere.has(String(a.id)));
    }

    function handleMunicipalityChange(value: string) {
        setData('municipality', value);
        setData('barangay', '');
    }

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        const lineSummaries = data.lines
            .map((line) => {
                const asset = assetsById.get(line.asset_id);
                return asset ? `${line.quantity || '?'} pc(s) of ${asset.asset_code}` : null;
            })
            .filter(Boolean)
            .join(', ');

        if (confirm(`Confirm donation of ${lineSummaries} to ${data.requester_name || 'this recipient'}? This cannot be undone.`)) {
            post(route('disposals.donate.store'));
        }
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Donate Assets</h2>}>
            <Head title="Donate Assets" />

            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                {assets.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-sm text-gray-500">
                            No log assets are currently available for donation.
                        </CardContent>
                    </Card>
                ) : (
                    <form onSubmit={submit} className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Assets to Donate</CardTitle>
                                <p className="text-sm text-gray-600">
                                    Choose one or more assets and how many pieces of each go to this recipient.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {data.lines.map((line, index) => {
                                    const selectedAsset = assetsById.get(line.asset_id);
                                    const options = availableOptionsFor(index);

                                    return (
                                        <div key={index} className="rounded-lg border border-gray-200 p-4">
                                            <div className="grid gap-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
                                                <div>
                                                    <Label htmlFor={`asset-${index}`}>Asset</Label>
                                                    <select
                                                        id={`asset-${index}`}
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
                                                </div>
                                                <div>
                                                    <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                                                    <Input
                                                        id={`quantity-${index}`}
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
                                            {selectedAsset && Number(line.quantity) > 0 && Number(line.quantity) < selectedAsset.remaining_quantity && (
                                                <p className="mt-2 text-xs text-amber-700">
                                                    The remaining {selectedAsset.remaining_quantity - Number(line.quantity)} pc(s) of{' '}
                                                    {selectedAsset.asset_code} will stay available for future disposal.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}

                                {data.lines.length < assets.length && (
                                    <Button type="button" variant="outline" size="sm" onClick={addLine}>
                                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                                        Add Another Asset
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Recipient</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
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

                                {data.organization_type !== 'individual' && (
                                    <div>
                                        <Label htmlFor="agency_name">Agency / Organization Name</Label>
                                        <Input
                                            id="agency_name"
                                            value={data.agency_name}
                                            onChange={(e) => setData('agency_name', e.target.value)}
                                        />
                                        <InputError message={errors.agency_name} />
                                    </div>
                                )}

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
                                    <p className="mt-1 text-xs text-gray-500">
                                        Printed on the Deed of Donation, e.g. "represented by [name], [position]".
                                    </p>
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
                                    <p className="mt-1 text-xs text-gray-500">
                                        Describes why the donee needs the lumber — appears in the Deed's WITNESSETH clause.
                                    </p>
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

                                {/* Address block: Municipality, Barangay, Street */}
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
                                        <Button type="button" variant="outline" onClick={() => setShowCoordinatesPicker(true)}>
                                            <MapPin className="mr-1.5 h-4 w-4" />
                                            Pick on Map
                                        </Button>
                                    </div>
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

                                <div>
                                    <Label htmlFor="notes">Notes</Label>
                                    <Input id="notes" value={data.notes} onChange={(e) => setData('notes', e.target.value)} />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex gap-3 pb-8">
                            <Button type="submit" disabled={processing}>Confirm Donation</Button>
                            <Link href={route('disposals.index')}>
                                <Button type="button" variant="outline">Cancel</Button>
                            </Link>
                        </div>
                    </form>
                )}
            </div>

            <CoordinatesPickerModal
                show={showCoordinatesPicker}
                onClose={() => setShowCoordinatesPicker(false)}
                onSelect={(coords) => setData('delivery_coordinates', coords)}
                initialCoordinates={data.delivery_coordinates}
            />
        </AuthenticatedLayout>
    );
}