import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Head, Link, router } from '@inertiajs/react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Boxes } from 'lucide-react';
import { IncidentsMap, IncidentLocation } from '@/Components/shared/IncidentsMap';

interface TrendPoint {
    key: string;
    month: string;
    log: number;
    equipment: number;
    vehicle: number;
    total: number;
}

interface ReportsIndexProps {
    summary: {
        total: number;
        inStorage: number;
        forDisposal: number;
        underTrial: number;
    };
    byType: Array<{ type: string; label: string; count: number }>;
    byMunicipality: Array<{ municipality_of_origin: string; count: number }>;
    trends: TrendPoint[];
    trendMonths: number;
    typeLabels: Record<string, string>;
    statusLabels: Record<string, string>;
    recentActivity: Array<{
        id: number;
        status: string;
        notes: string | null;
        changed_at: string;
        asset?: { asset_code: string; id: number };
        changed_by?: { name: string };
    }>;
    incidentLocations: IncidentLocation[];
}

const TYPE_COLORS: Record<string, string> = {
    log: '#047857',
    equipment: '#d97706',
    vehicle: '#2563eb',
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
            <p className="font-medium text-gray-700">{label}</p>
            <p className="mt-0.5 text-emerald-700">{payload[0].value} asset{payload[0].value === 1 ? '' : 's'}</p>
        </div>
    );
}

function TrendTooltip({
    active,
    payload,
    label,
    typeLabels,
}: {
    active?: boolean;
    payload?: Array<{ dataKey: string; value: number; color: string }>;
    label?: string;
    typeLabels: Record<string, string>;
}) {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((sum, p) => sum + p.value, 0);
    return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
            <p className="font-medium text-gray-700">{label}</p>
            {payload.map((p) => (
                <p key={p.dataKey} style={{ color: p.color }} className="mt-0.5">
                    {typeLabels[p.dataKey] ?? p.dataKey}: {p.value}
                </p>
            ))}
            <p className="mt-1 border-t border-gray-100 pt-1 font-medium text-gray-700">Total: {total}</p>
        </div>
    );
}

export default function ReportsIndex({
    summary,
    byType,
    byMunicipality,
    trends,
    trendMonths,
    typeLabels,
    statusLabels,
    recentActivity,
    incidentLocations,
}: ReportsIndexProps) {
    const typeChartData = byType.map((row) => ({
        name: row.label,
        typeValue: row.type,
        count: row.count,
    }));

    const municipalityChartData = byMunicipality.map((row) => ({
        name: row.municipality_of_origin,
        count: row.count,
    }));

    function goToAssetsByType(typeValue: string) {
        router.visit(route('assets.index', { type: typeValue }));
    }

    function goToAssetsByMunicipality(municipality: string) {
        router.visit(route('assets.index', { search: municipality }));
    }

    function handleMonthsChange(months: number) {
        router.get(
            route('reports.index'),
            { months },
            { preserveState: true, preserveScroll: true, only: ['trends', 'trendMonths'] },
        );
    }

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Reports & Trends</h2>}>
            <Head title="Reports" />

            <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                <div className="grid gap-4 md:grid-cols-4">
                    {Object.entries(summary).map(([key, value]) => (
                        <Card key={key}>
                            <CardHeader><CardTitle className="text-base capitalize">{key.replace(/([A-Z])/g, ' $1')}</CardTitle></CardHeader>
                            <CardContent><p className="text-3xl font-bold">{value}</p></CardContent>
                        </Card>
                    ))}
                </div>

                {/* Trend chart */}
                <Card>
                    <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold text-gray-900">Confiscations Over Time</CardTitle>
                            <p className="text-sm text-gray-500">Monthly intake volume, broken down by asset type.</p>
                        </div>
                        <div className="flex gap-1.5">
                            {[3, 6, 12].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => handleMonthsChange(m)}
                                    className={
                                        'rounded-full px-3 py-1 text-xs font-semibold transition ' +
                                        (trendMonths === m
                                            ? 'bg-emerald-700 text-white'
                                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
                                    }
                                >
                                    {m}M
                                </button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent className="h-72 pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trends} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    axisLine={{ stroke: '#e5e7eb' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip content={<TrendTooltip typeLabels={typeLabels} />} cursor={{ fill: '#f3f4f6' }} />
                                <Legend
                                    formatter={(value) => typeLabels[value as string] ?? value}
                                    wrapperStyle={{ fontSize: 12 }}
                                />
                                <Bar dataKey="log" stackId="a" fill={TYPE_COLORS.log} maxBarSize={48} />
                                <Bar dataKey="equipment" stackId="a" fill={TYPE_COLORS.equipment} maxBarSize={48} />
                                <Bar dataKey="vehicle" stackId="a" fill={TYPE_COLORS.vehicle} radius={[6, 6, 0, 0]} maxBarSize={48} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Breakdown charts */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold text-gray-900">Assets by Type</CardTitle>
                            <p className="text-xs text-gray-500">Click a bar to view those assets.</p>
                        </CardHeader>
                        <CardContent className="h-72 pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={typeChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 12, fill: '#6b7280' }}
                                        axisLine={{ stroke: '#e5e7eb' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={{ fontSize: 12, fill: '#6b7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f3f4f6' }} />
                                    <Bar
                                        dataKey="count"
                                        fill="#047857"
                                        radius={[6, 6, 0, 0]}
                                        maxBarSize={56}
                                        cursor="pointer"
                                        onClick={(data) => goToAssetsByType((data as unknown as { typeValue: string }).typeValue)}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold text-gray-900">Confiscations by Municipality</CardTitle>
                            <p className="text-xs text-gray-500">Click a bar to view those assets.</p>
                        </CardHeader>
                        <CardContent className="h-72 pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={municipalityChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        axisLine={{ stroke: '#e5e7eb' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={{ fontSize: 12, fill: '#6b7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f3f4f6' }} />
                                    <Bar
                                        dataKey="count"
                                        fill="#059669"
                                        radius={[6, 6, 0, 0]}
                                        maxBarSize={56}
                                        cursor="pointer"
                                        onClick={(data) => goToAssetsByMunicipality((data as unknown as { name: string }).name)}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
                {/* Incident map */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-gray-900">Confiscation Locations</CardTitle>
                        <p className="text-sm text-gray-500">
                            Where each incident was apprehended, based on coordinates MES logged at intake. Click a marker for details.
                        </p>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <IncidentsMap incidents={incidentLocations} />
                    </CardContent>
                </Card>

                {/* Recent activity */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-gray-900">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        {recentActivity.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center">
                                <Boxes className="h-8 w-8 text-gray-300" />
                                <p className="text-sm text-gray-500">No activity yet. New intakes will appear here.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {recentActivity.map((entry) => (
                                    <Link
                                        key={entry.id}
                                        href={route('assets.show', entry.asset?.id)}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-3 transition hover:bg-gray-50"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                            <div>
                                                <p className="font-medium text-gray-900">{entry.asset?.asset_code}</p>
                                                <p className="text-sm text-gray-500">
                                                    {entry.changed_by?.name} — {entry.notes}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <AssetStatusBadge
                                                status={entry.status}
                                                label={statusLabels[entry.status] ?? entry.status}
                                            />
                                            <p className="mt-1 text-xs text-gray-500">
                                                {new Date(entry.changed_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-base">Export</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        <a href={route('reports.inventory')}>
                            <Button variant="outline">Download Inventory CSV</Button>
                        </a>
                        <a href={route('reports.compliance')}>
                            <Button variant="outline">Download Compliance PDF</Button>
                        </a>
                        <Link href={route('audit-logs.index')}>
                            <Button variant="secondary">View Audit Logs</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}