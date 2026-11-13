import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';
import { CalendarDays, Layers, Leaf, Pencil, Trash2, TrendingDown, TrendingUp } from 'lucide-react';

interface MarketPrice {
    id: number;
    species: string;
    year: number;
    month: number;
    month_label: string;
    price_per_bd_ft: string;
}

interface Props {
    marketPrices: MarketPrice[];
    speciesOptions: string[];
    monthOptions: Record<string, string>;
}

type RateType = 'year' | 'month';

const selectClass =
    'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

const th = 'px-3 py-2 text-left text-xs font-medium uppercase text-gray-500';

const peso = (v: string | number) =>
    `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Badge({ tone, children }: { tone: 'gray' | 'emerald'; children: React.ReactNode }) {
    const cls =
        tone === 'emerald'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-gray-200 bg-gray-100 text-gray-700';
    return (
        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
            {children}
        </span>
    );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-xl font-semibold leading-none text-gray-900">{value}</p>
                <p className="mt-1 truncate text-xs text-gray-500">{label}</p>
            </div>
        </div>
    );
}

export default function MarketPricesIndex({ marketPrices, speciesOptions, monthOptions }: Props) {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1);
    const monthEntries = Object.entries(monthOptions); // [["0","Whole Year"], ["1","January"], ...]
    const overrideMonthEntries = monthEntries.filter(([value]) => value !== '0');

    const { data, setData, post, processing, errors, reset } = useForm({
        species: speciesOptions[0] ?? '',
        year: String(currentYear),
        month: '0',
        price_per_bd_ft: '',
    });

    const [rateType, setRateType] = useState<RateType>('year');
    const [tab, setTab] = useState<RateType>('year');
    const [filterYear, setFilterYear] = useState('all');
    const [filterSpecies, setFilterSpecies] = useState('all');

    // ── Derived data ─────────────────────────────────────────────────────────

    const years = useMemo(
        () => Array.from(new Set(marketPrices.map((mp) => mp.year))).sort((a, b) => b - a),
        [marketPrices],
    );

    const wholeYearLookup = useMemo(() => {
        const map = new Map<string, string>();
        marketPrices
            .filter((mp) => mp.month === 0)
            .forEach((mp) => map.set(`${mp.species}|${mp.year}`, mp.price_per_bd_ft));
        return map;
    }, [marketPrices]);

    const filtered = marketPrices.filter(
        (mp) =>
            (filterYear === 'all' || String(mp.year) === filterYear) &&
            (filterSpecies === 'all' || mp.species === filterSpecies),
    );
    const wholeYear = filtered.filter((mp) => mp.month === 0);
    const overrides = filtered.filter((mp) => mp.month !== 0);
    const rows = tab === 'year' ? wholeYear : overrides;

    const totalWholeYear = marketPrices.filter((mp) => mp.month === 0).length;
    const totalOverrides = marketPrices.length - totalWholeYear;
    const speciesCovered = new Set(marketPrices.map((mp) => mp.species)).size;

    const existing = marketPrices.find(
        (mp) =>
            mp.species === data.species &&
            String(mp.year) === data.year &&
            String(mp.month) === data.month,
    );
    const wholeYearForForm = wholeYearLookup.get(`${data.species}|${data.year}`);
    const selectedMonthLabel = monthOptions[data.month] ?? 'Whole Year';

    // ── Actions ──────────────────────────────────────────────────────────────

    function chooseType(type: RateType) {
        setRateType(type);
        setData('month', type === 'year' ? '0' : data.month === '0' ? currentMonth : data.month);
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        post(route('market-prices.store'), {
            preserveScroll: true,
            onSuccess: () => reset('price_per_bd_ft'),
        });
    }

    function edit(mp: MarketPrice) {
        setRateType(mp.month === 0 ? 'year' : 'month');
        setData({
            species: mp.species,
            year: String(mp.year),
            month: String(mp.month),
            price_per_bd_ft: Number(mp.price_per_bd_ft).toFixed(2),
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function remove(mp: MarketPrice) {
        const what =
            mp.month === 0
                ? `${mp.species} ${mp.year} whole-year rate`
                : `${mp.species} ${mp.month_label} ${mp.year} override`;
        if (confirm(`Remove the ${what}?`)) {
            router.delete(route('market-prices.destroy', mp.id), { preserveScroll: true });
        }
    }

    function rowActions(mp: MarketPrice) {
        return (
            <div className="flex items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={() => edit(mp)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                >
                    <Pencil className="h-3.5 w-3.5" />Edit
                </button>
                <button
                    type="button"
                    onClick={() => remove(mp)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                >
                    <Trash2 className="h-3.5 w-3.5" />Remove
                </button>
            </div>
        );
    }

    function difference(mp: MarketPrice) {
        const base = wholeYearLookup.get(`${mp.species}|${mp.year}`);
        if (base === undefined) {
            return <span className="text-xs text-amber-700">No whole-year rate: other months have no rate</span>;
        }
        const baseNum = Number(base);
        const diff = Number(mp.price_per_bd_ft) - baseNum;
        if (baseNum <= 0 || diff === 0) {
            return <span className="text-sm text-gray-500">{peso(base)} (same)</span>;
        }
        const pct = (diff / baseNum) * 100;
        const up = diff > 0;
        const Icon = up ? TrendingUp : TrendingDown;
        return (
            <div className="text-sm text-gray-500">
                {peso(base)}
                <span className={`ml-2 inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-700' : 'text-red-600'}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {up ? '+' : ''}{pct.toFixed(1)}%
                </span>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Market Prices</h2>}>
            <Head title="Market Prices" />

            <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
                {/* Summary */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Stat icon={<Layers className="h-4 w-4" />} label="Whole-year rates" value={totalWholeYear} />
                    <Stat icon={<CalendarDays className="h-4 w-4" />} label="Monthly overrides" value={totalOverrides} />
                    <Stat icon={<Leaf className="h-4 w-4" />} label="Species with a rate" value={speciesCovered} />
                </div>

                {/* Form */}
                <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-lg">Set / Update Market Price</CardTitle>
                        <p className="text-sm text-gray-600">
                            Intake uses the month's override when one exists, otherwise the whole-year rate.
                            Saving an existing species, year and month updates it.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-6">
                        {/* Rate type */}
                        <div className="grid gap-2 sm:grid-cols-2">
                            {([
                                { value: 'year', title: 'Whole Year', hint: 'Default rate for the species and year' },
                                { value: 'month', title: 'Monthly Override', hint: 'Replaces the default for one month only' },
                            ] as const).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => chooseType(opt.value)}
                                    aria-pressed={rateType === opt.value}
                                    className={`rounded-lg border-2 px-4 py-3 text-left transition ${
                                        rateType === opt.value
                                            ? 'border-emerald-600 bg-emerald-50'
                                            : 'border-gray-200 bg-white hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="block text-sm font-semibold text-gray-900">{opt.title}</span>
                                    <span className="mt-0.5 block text-xs text-gray-500">{opt.hint}</span>
                                </button>
                            ))}
                        </div>

                        <form
                            onSubmit={submit}
                            className={`grid gap-4 sm:items-end ${
                                rateType === 'month'
                                    ? 'sm:grid-cols-[1fr_100px_140px_150px_auto]'
                                    : 'sm:grid-cols-[1fr_110px_160px_auto]'
                            }`}
                        >
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
                            {rateType === 'month' && (
                                <div className="space-y-2">
                                    <Label htmlFor="month">Month</Label>
                                    <select
                                        id="month"
                                        value={data.month}
                                        onChange={(e) => setData('month', e.target.value)}
                                        className={selectClass}
                                    >
                                        {overrideMonthEntries.map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                    <InputError message={errors.month} />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="price_per_bd_ft">Price per bd.ft (php)</Label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">₱</span>
                                    <Input
                                        id="price_per_bd_ft"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="pl-7"
                                        value={data.price_per_bd_ft}
                                        onChange={(e) => setData('price_per_bd_ft', e.target.value)}
                                        required
                                    />
                                </div>
                                <InputError message={errors.price_per_bd_ft} />
                            </div>
                            <Button type="submit" disabled={processing}>
                                {existing ? 'Update rate' : 'Save rate'}
                            </Button>
                        </form>

                        {/* Live preview of what this save will do */}
                        <div
                            className={`rounded-md border px-3 py-2 text-xs ${
                                existing
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-emerald-100 bg-emerald-50 text-emerald-800'
                            }`}
                        >
                            {existing ? (
                                <>
                                    This will update the existing {rateType === 'year' ? 'whole-year rate' : `${selectedMonthLabel} override`} for{' '}
                                    {data.species} {data.year} (currently <span className="font-semibold">{peso(existing.price_per_bd_ft)}</span>).
                                </>
                            ) : rateType === 'year' ? (
                                <>New default rate for {data.species} in {data.year}, used for any month without its own override.</>
                            ) : (
                                <>
                                    New override for {data.species} in {selectedMonthLabel} {data.year} only.{' '}
                                    {wholeYearForForm !== undefined
                                        ? `Other months keep using the whole-year rate (${peso(wholeYearForForm)}).`
                                        : 'No whole-year rate exists yet, so other months will have no rate.'}
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Rates */}
                <Card className="border-0 shadow-sm">
                    <CardHeader className="space-y-4 border-b border-gray-100">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-lg">Current Rates</CardTitle>
                            <div className="flex flex-wrap gap-2">
                                <select
                                    aria-label="Filter by year"
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value)}
                                    className={`${selectClass} h-9 w-auto`}
                                >
                                    <option value="all">All years</option>
                                    {years.map((y) => (
                                        <option key={y} value={String(y)}>{y}</option>
                                    ))}
                                </select>
                                <select
                                    aria-label="Filter by species"
                                    value={filterSpecies}
                                    onChange={(e) => setFilterSpecies(e.target.value)}
                                    className={`${selectClass} h-9 w-auto`}
                                >
                                    <option value="all">All species</option>
                                    {speciesOptions.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div role="tablist" className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-1">
                            {([
                                { value: 'year', label: 'Whole-Year Rates', count: wholeYear.length },
                                { value: 'month', label: 'Monthly Overrides', count: overrides.length },
                            ] as const).map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === t.value}
                                    onClick={() => setTab(t.value)}
                                    className={`rounded px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                                        tab === t.value
                                            ? 'bg-white text-emerald-800 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    {t.label}
                                    <span className="ml-1.5 text-xs text-gray-400">{t.count}</span>
                                </button>
                            ))}
                        </div>

                        <p className="text-sm text-gray-600">
                            {tab === 'year'
                                ? 'Default rate per species and year.'
                                : 'Apply only to the listed month and take priority over the whole-year rate.'}
                        </p>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {rows.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                    {tab === 'year' ? <Layers className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
                                </span>
                                <p className="text-sm text-gray-600">
                                    {marketPrices.length === 0
                                        ? 'No market prices set yet. Add a whole-year rate above to start.'
                                        : tab === 'year'
                                            ? 'No whole-year rates match these filters.'
                                            : 'No monthly overrides match these filters.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead>
                                        <tr>
                                            <th className={th}>Species</th>
                                            <th className={th}>Year</th>
                                            {tab === 'month' && <th className={th}>Month</th>}
                                            <th className={th}>{tab === 'year' ? 'Price / bd.ft' : 'Override / bd.ft'}</th>
                                            {tab === 'month' && <th className={th}>Whole-year rate</th>}
                                            <th className={`${th} text-right`}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {rows.map((mp) => (
                                            <tr key={mp.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2.5 text-sm font-medium text-gray-800">{mp.species}</td>
                                                <td className="px-3 py-2.5 text-sm text-gray-600">{mp.year}</td>
                                                {tab === 'month' && (
                                                    <td className="px-3 py-2.5">
                                                        <Badge tone="emerald">{mp.month_label}</Badge>
                                                    </td>
                                                )}
                                                <td className="px-3 py-2.5 text-sm tabular-nums text-gray-800">
                                                    {peso(mp.price_per_bd_ft)}
                                                    {tab === 'year' && (
                                                        <span className="ml-2 align-middle"><Badge tone="gray">Whole Year</Badge></span>
                                                    )}
                                                </td>
                                                {tab === 'month' && <td className="px-3 py-2.5">{difference(mp)}</td>}
                                                <td className="px-3 py-2.5">{rowActions(mp)}</td>
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