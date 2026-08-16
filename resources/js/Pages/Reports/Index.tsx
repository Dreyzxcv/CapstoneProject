import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Head, Link, router, usePoll } from '@inertiajs/react';
import AttributeTableModal from '@/Components/shared/AttributeTableModal';
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
import { Boxes, Download } from 'lucide-react';
import { IncidentsMap, IncidentLocation } from '@/Components/shared/IncidentsMap';
import { useMemo, useState } from 'react';


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
    chartFilters: { month: string; year: string };
    availableChartYears: number[];
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
    can: {
        export: boolean;
        viewAudit: boolean;
        viewDonations: boolean;
    };
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

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function parseCoordinatesForExport(value: string): { lat: number; lng: number } | null {
    const match = value.match(/(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[3]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export default function ReportsIndex({
    summary,
    byType,
    byMunicipality,
    trends,
    trendMonths,
    chartFilters,
    availableChartYears,
    typeLabels,
    statusLabels,
    recentActivity,
    incidentLocations,
    can,
}: ReportsIndexProps) {
    usePoll(10000, { only: ['summary', 'byType', 'byMunicipality', 'trends', 'recentActivity'] });

    const [chartMonth, setChartMonth] = useState<string>(chartFilters.month);
    const [chartYear, setChartYear] = useState<string>(chartFilters.year);
    const [showAttributeTable, setShowAttributeTable] = useState(false);

    function handleChartFilterChange(nextMonth: string, nextYear: string) {
        setChartMonth(nextMonth);
        setChartYear(nextYear);
        router.get(
            route('reports.index'),
            { month: nextMonth, year: nextYear, months: trendMonths },
            { preserveState: true, preserveScroll: true, only: ['byType', 'byMunicipality', 'chartFilters'] },
        );
    }

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

    const [mapMonth, setMapMonth] = useState<string>('all');
    const [mapYear, setMapYear] = useState<string>('all');

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        incidentLocations.forEach((incident) => {
            if (incident.date_of_apprehension) {
                years.add(new Date(incident.date_of_apprehension).getFullYear());
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [incidentLocations]);

    const filteredIncidentLocations = useMemo(() => {
        if (mapMonth === 'all' && mapYear === 'all') return incidentLocations;

        return incidentLocations.filter((incident) => {
            if (!incident.date_of_apprehension) return false;
            const date = new Date(incident.date_of_apprehension);
            if (mapYear !== 'all' && date.getFullYear() !== Number(mapYear)) return false;
            if (mapMonth !== 'all' && date.getMonth() !== Number(mapMonth)) return false;
            return true;
        });
    }, [incidentLocations, mapMonth, mapYear]);

    function handleExportKml() {
        const placemarks = filteredIncidentLocations
            .map((incident) => {
                const point = parseCoordinatesForExport(incident.coordinates);
                if (!point) return null;

                const dateLabel = incident.date_of_apprehension
                    ? new Date(incident.date_of_apprehension).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                      })
                    : 'Date not on file';

                const description = escapeXml(
                    `${incident.place_of_apprehension} — ${dateLabel} — ${incident.asset_count} asset(s)` +
                        (incident.is_abandoned ? ' — Abandoned' : ''),
                );

                return `    <Placemark>
      <name>${escapeXml(incident.incident_code)}</name>
      <description>${description}</description>
      <Point>
        <coordinates>${point.lng},${point.lat},0</coordinates>
      </Point>
    </Placemark>`;
            })
            .filter((entry): entry is string => entry !== null)
            .join('\n');

        const kml = `<?xml version="1.0" encoding="UTF-8"?>
            <kml xmlns="http://www.opengis.net/kml/2.2">
            <Document>
                <name>LogTrack Insight — Confiscation Locations</name>
            ${placemarks}
            </Document>
            </kml>`;

        const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const suffix =
            mapYear !== 'all' || mapMonth !== 'all'
                ? `-${mapYear !== 'all' ? mapYear : 'all-years'}${mapMonth !== 'all' ? `-${MONTH_NAMES[Number(mapMonth)]}` : ''}`
                : '';

        const link = document.createElement('a');
        link.href = url;
        link.download = `confiscation-locations${suffix}.kml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-gray-800">Reports & Trends</h2>
                    <div className="flex flex-wrap gap-2">
                        {can.viewDonations && (
                            <Link href={route('reports.donations')}>
                                <Button variant="outline">Donations</Button>
                            </Link>
                        )}
                        <Button variant="outline" onClick={() => setShowAttributeTable(true)}>
                            Attribute Table
                        </Button>
                    </div>
                </div>
            }
        >
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

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Filter breakdowns:</span>
                    <select
                        value={chartMonth}
                        onChange={(e) => handleChartFilterChange(e.target.value, chartYear)}
                        className="h-9 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                        <option value="all">All Months</option>
                        {MONTH_NAMES.map((name, index) => (
                            <option key={name} value={index}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={chartYear}
                        onChange={(e) => handleChartFilterChange(chartMonth, e.target.value)}
                        className="h-9 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                        <option value="all">All Years</option>
                        {availableChartYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    {(chartMonth !== 'all' || chartYear !== 'all') && (
                        <button
                            type="button"
                            onClick={() => handleChartFilterChange('all', 'all')}
                            className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                            Clear
                        </button>
                    )}
                </div>

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
                    <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold text-gray-900">Confiscation Locations</CardTitle>
                            <p className="text-sm text-gray-500">
                                Where each incident was apprehended, based on coordinates MES logged at intake. Click a marker for details.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={mapMonth}
                                onChange={(e) => setMapMonth(e.target.value)}
                                className="h-9 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            >
                                <option value="all">All Months</option>
                                {MONTH_NAMES.map((name, index) => (
                                    <option key={name} value={index}>{name}</option>
                                ))}
                            </select>
                            <select
                                value={mapYear}
                                onChange={(e) => setMapYear(e.target.value)}
                                className="h-9 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            >
                                <option value="all">All Years</option>
                                {availableYears.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleExportKml}
                                disabled={filteredIncidentLocations.length === 0}
                            >
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Export KML
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <p className="mb-2 text-xs text-gray-500">
                            Showing {filteredIncidentLocations.length} of {incidentLocations.length} incident
                            {incidentLocations.length === 1 ? '' : 's'} with coordinates.
                        </p>
                        <IncidentsMap incidents={filteredIncidentLocations} />
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
                        {can.viewDonations && (
                            <Link href={route('reports.donations')}>
                                <Button variant="secondary">View Donations</Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            </div>
            <AttributeTableModal show={showAttributeTable} onClose={() => setShowAttributeTable(false)} />
        </AuthenticatedLayout>
    );
}