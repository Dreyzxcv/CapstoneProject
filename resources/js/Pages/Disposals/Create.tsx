import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Asset } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import CoordinatesPickerModal from '@/Components/shared/CoordinatesPickerModal';
import { IncidentLocationMap } from '@/Components/shared/IncidentLocationMap';
import { MapPin } from 'lucide-react';

interface DisposalsCreateProps {
    asset: Asset;
    disposalTypes: Array<{ value: string; label: string }>;
}

export default function DisposalsCreate({ asset, disposalTypes }: DisposalsCreateProps) {
    const assetQuantity = asset.quantity ?? 1;

    const ORG_TYPES = [
        { value: 'academe', label: 'Academe' },
        { value: 'national_agency', label: 'National Agency' },
        { value: 'lgu', label: 'LGU' },
        { value: 'individual', label: 'Individual' },
        { value: 'other', label: 'Other' },
    ];


    const { data, setData, post, processing, errors } = useForm({
        disposal_type: disposalTypes[0]?.value ?? '',
        quantity: String(assetQuantity),
        requester_name: '',
        organization_type: 'individual',
        organization_type_other: '',
        agency_name: '',
        delivery_coordinates: '',
        appeal_filed: false as boolean,
        notes: '',
    });

    const [showCoordinatesPicker, setShowCoordinatesPicker] = useState(false);

    const isDonation = data.disposal_type === 'donation';
    const isVehicleDecision = data.disposal_type === 'released' || data.disposal_type === 'forfeited';
    const appealDeadlinePassed = asset.appeal_deadline ? new Date(asset.appeal_deadline) <= new Date() : null;

    const quantityValue = Number(data.quantity) || 0;
    const remainder = assetQuantity - quantityValue;

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
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
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                            {disposalTypes.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                        <InputError message={errors.disposal_type} />
                    </div>

                    {!isVehicleDecision && (
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
                    )}

                    {isDonation && (
                        <>
                            <div>
                                <Label htmlFor="organization_type">Organization Type</Label>
                                <select
                                    id="organization_type"
                                    value={data.organization_type}
                                    onChange={(e) => setData('organization_type', e.target.value)}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        </AuthenticatedLayout>
    );
}