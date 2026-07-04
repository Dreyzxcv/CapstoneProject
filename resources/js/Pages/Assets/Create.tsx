import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

interface CreateProps {
    types: Array<{ value: string; label: string }>;
    modes: Array<{ value: string; label: string }>;
    municipalities: Array<{ value: string; label: string }>;
}

export default function AssetsCreate({ types, modes, municipalities }: CreateProps) {
    const { data, setData, post, processing, errors } = useForm({
        type: 'log',
        species: '',
        description: '',
        municipality_of_origin: municipalities[0]?.value ?? '',
        location_apprehended: '',
        apprehending_agency: 'PENRO Catanduanes MES',
        mode: 'apprehended',
        has_ongoing_case: false,
        has_confiscation_order: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('assets.store'));
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-gray-800">MES Asset Intake</h2>}
        >
            <Head title="New Asset Intake" />

            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-xl">New Asset Intake</CardTitle>
                        <p className="text-sm text-gray-600">
                            Capture the intake details for confiscated or turned-over assets.
                        </p>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={submit} className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Asset Type</Label>
                                    <select
                                        id="type"
                                        value={data.type}
                                        onChange={(e) => setData('type', e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        {types.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                    <InputError message={errors.type} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mode">Intake Mode</Label>
                                    <select
                                        id="mode"
                                        value={data.mode}
                                        onChange={(e) => setData('mode', e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        {modes.map((m) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                    <InputError message={errors.mode} />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="species">Species</Label>
                                    <Input id="species" value={data.species} onChange={(e) => setData('species', e.target.value)} />
                                    <InputError message={errors.species} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="municipality_of_origin">Municipality of Origin</Label>
                                    <select
                                        id="municipality_of_origin"
                                        value={data.municipality_of_origin}
                                        onChange={(e) => setData('municipality_of_origin', e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        {municipalities.map((m) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                    <InputError message={errors.municipality_of_origin} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input id="description" value={data.description} onChange={(e) => setData('description', e.target.value)} />
                                <InputError message={errors.description} />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="location_apprehended">Location Apprehended</Label>
                                    <Input id="location_apprehended" value={data.location_apprehended} onChange={(e) => setData('location_apprehended', e.target.value)} required />
                                    <InputError message={errors.location_apprehended} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="apprehending_agency">Apprehending Agency</Label>
                                    <Input id="apprehending_agency" value={data.apprehending_agency} onChange={(e) => setData('apprehending_agency', e.target.value)} required />
                                    <InputError message={errors.apprehending_agency} />
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <div className="flex flex-wrap gap-6">
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            checked={data.has_ongoing_case}
                                            onChange={(e) => setData('has_ongoing_case', e.target.checked)}
                                        />
                                        Ongoing case (Steady)
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            checked={data.has_confiscation_order}
                                            onChange={(e) => setData('has_confiscation_order', e.target.checked)}
                                        />
                                        Confiscation / Forfeiture Order
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                                <Button type="submit" disabled={processing}>Record Intake</Button>
                                <Link href={route('assets.index')}>
                                    <Button type="button" variant="outline">Cancel</Button>
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}