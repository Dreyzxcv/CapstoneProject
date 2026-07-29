import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Trash2 } from 'lucide-react';

interface MarketPrice {
    id: number;
    species: string;
    year: number;
    price_per_bd_ft: string;
}

interface Props {
    marketPrices: MarketPrice[];
    speciesOptions: string[];
}

const selectClass =
    'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

export default function MarketPricesIndex({ marketPrices, speciesOptions }: Props) {
    const currentYear = new Date().getFullYear();

    const { data, setData, post, processing, errors, reset } = useForm({
        species: speciesOptions[0] ?? '',
        year: String(currentYear),
        price_per_bd_ft: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post(route('market-prices.store'), {
            preserveScroll: true,
            onSuccess: () => reset('price_per_bd_ft'),
        });
    }

    function remove(id: number) {
        if (confirm('Remove this market price entry?')) {
            router.delete(route('market-prices.destroy', id), { preserveScroll: true });
        }
    }

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Market Prices</h2>}>
            <Head title="Market Prices" />

            <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-lg">Set / Update Market Price</CardTitle>
                        <p className="text-sm text-gray-600">
                            One price per species per year. Saving an existing species/year combo updates the rate.
                            Used to auto-compute Estimated Value for logs in the intake form.
                        </p>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_140px_160px_auto] sm:items-end">
                            <div className="space-y-2">
                                <Label htmlFor="species">Species</Label>
                                <select
                                    id="species"
                                    value={data.species}
                                    onChange={(e) => setData('species', e.target.value)}
                                    className={selectClass}
                                >
                                    {speciesOptions.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <InputError message={errors.species} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year">Year</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    value={data.year}
                                    onChange={(e) => setData('year', e.target.value)}
                                    required
                                />
                                <InputError message={errors.year} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="price_per_bd_ft">Price per bd.ft (php)</Label>
                                <Input
                                    id="price_per_bd_ft"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.price_per_bd_ft}
                                    onChange={(e) => setData('price_per_bd_ft', e.target.value)}
                                    required
                                />
                                <InputError message={errors.price_per_bd_ft} />
                            </div>
                            <Button type="submit" disabled={processing}>Save</Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-lg">Current Rates</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {marketPrices.length === 0 ? (
                            <p className="py-8 text-center text-sm text-gray-500">No market prices set yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead>
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Species</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Year</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Price / bd.ft</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {marketPrices.map((mp) => (
                                            <tr key={mp.id}>
                                                <td className="px-3 py-2 text-sm text-gray-800">{mp.species}</td>
                                                <td className="px-3 py-2 text-sm text-gray-600">{mp.year}</td>
                                                <td className="px-3 py-2 text-sm text-gray-600">
                                                    ₱{Number(mp.price_per_bd_ft).toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(mp.id)}
                                                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}