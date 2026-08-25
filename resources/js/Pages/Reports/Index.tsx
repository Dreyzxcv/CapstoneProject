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
    Cell,
    LabelList,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    Boxes,
    Download,
    FileText,
    FileSpreadsheet,
    ClipboardList,
    Gift,
    Package,
    Archive,
    Gavel,
    LayoutGrid,
    Clock,
    ArrowRight,
    MapPin,
} from 'lucide-react';
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

// Bar colors keyed by the human-readable label returned from the backend
// (e.g. "Log / Lumber", "Equipment / Tools", "Conveyance / Vehicle")
const TYPE_LABEL_COLORS: Record<string, { fill: string; gradientId: string }> = {
    'Log / Lumber':          { fill: '#047857', gradientId: 'grad-log' },
    'Equipment / Tools':     { fill: '#d97706', gradientId: 'grad-equipment' },
    'Conveyance / Vehicle':  { fill: '#2563eb', gradientId: 'grad-vehicle' },
};
const FALLBACK_BAR_COLOR = '#6b7280';

// Municipality chart uses a single teal gradient cycling shade by index
const MUNI_SHADES = [
    '#047857', '#059669', '#0d9488', '#0891b2',
    '#1d4ed8', '#4f46e5', '#7c3aed', '#a21caf',
    '#be185d', '#be123c', '#b45309', '#4d7c0f',
];

/** Gradient defs block — inject once inside the SVG via recharts customization */
function GradientDefs() {
    return (
        <defs>
            <linearGradient id="grad-log" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#047857" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="grad-equipment" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fcd34d" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#d97706" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="grad-vehicle" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
            </linearGradient>
            {MUNI_SHADES.map((color, i) => (
                <linearGradient key={i} id={`grad-muni-${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={color} stopOpacity={0.75} />
                    <stop offset="100%" stopColor={color} stopOpacity={1} />
                </linearGradient>
            ))}
        </defs>
    );
}

// Summary card config: icon, colors, description, link
const SUMMARY_CONFIG = {
    total: {
        label: 'Total Assets',
        description: 'All apprehended assets on record',
        icon: LayoutGrid,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-700',
        accent: 'border-l-emerald-500',
        valueColor: 'text-emerald-700',
    },
    inStorage: {
        label: 'In Storage',
        description: 'Currently held at the depot',
        icon: Archive,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-700',
        accent: 'border-l-blue-500',
        valueColor: 'text-blue-700',
    },
    forDisposal: {
        label: 'For Disposal',
        description: 'Cleared and awaiting disposal',
        icon: Package,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-700',
        accent: 'border-l-amber-500',
        valueColor: 'text-amber-700',
    },
    underTrial: {
        label: 'Under Trial',
        description: 'Active legal proceedings',
        icon: Gavel,
        iconBg: 'bg-rose-50',
        iconColor: 'text-rose-700',
        accent: 'border-l-rose-500',
        valueColor: 'text-rose-700',
    },
} as const;

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

/** Groups recent activity entries into Today / Yesterday / Earlier */
function groupActivity(entries: ReportsIndexProps['recentActivity']) {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const groups: { label: string; entries: typeof entries }[] = [
        { label: 'Today', entries: [] },
        { label: 'Yesterday', entries: [] },
        { label: 'Earlier', entries: [] },
    ];

    for (const entry of entries) {
        const d = new Date(entry.changed_at).toDateString();
        if (d === todayStr) groups[0].entries.push(entry);
        else if (d === yesterdayStr) groups[1].entries.push(entry);
        else groups[2].entries.push(entry);
    }

    return groups.filter((g) => g.entries.length > 0);
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
      <n>${escapeXml(incident.incident_code)}</n>
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
                <n>LogTrack Insight — Confiscation Locations</n>
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

    const activityGroups = useMemo(() => groupActivity(recentActivity), [recentActivity]);
    const hasChartFilter = chartMonth !== 'all' || chartYear !== 'all';
    const hasMapFilter = mapMonth !== 'all' || mapYear !== 'all';

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
                            Full Asset Table
                        </Button>
                    </div>
                </div>
            }
        >
            <Head title="Reports" />

            <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">

                {/* ── Summary cards ── */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {(Object.keys(SUMMARY_CONFIG) as Array<keyof typeof SUMMARY_CONFIG>).map((key) => {
                        const cfg = SUMMARY_CONFIG[key];
                        const Icon = cfg.icon;
                        const value = summary[key];
                        return (
                            <div
                                key={key}
                                className={`relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm border-l-4 ${cfg.accent}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            {cfg.label}
                                        </p>
                                        <p className={`mt-2 text-3xl font-bold tabular-nums ${cfg.valueColor}`}>
                                            {value.toLocaleString()}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-400">{cfg.description}</p>
                                    </div>
                                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}>
                                        <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Trend chart ── */}
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

                {/* ── Breakdown filter + charts ── */}
                <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">Filter breakdowns by:</span>
                        <select
                            value={chartMonth}
                            onChange={(e) => handleChartFilterChange(e.target.value, chartYear)}
                            className="h-8 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                            <option value="all">All Months</option>
                            {MONTH_NAMES.map((name, index) => (
                                <option key={name} value={index}>{name}</option>
                            ))}
                        </select>
                        <select
                            value={chartYear}
                            onChange={(e) => handleChartFilterChange(chartMonth, e.target.value)}
                            className="h-8 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                            <option value="all">All Years</option>
                            {availableChartYears.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        {hasChartFilter && (
                            <button
                                type="button"
                                onClick={() => handleChartFilterChange('all', 'all')}
                                className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                            >
                                Clear ×
                            </button>
                        )}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base font-semibold text-gray-900">Assets by Type</CardTitle>
                                        <p className="text-xs text-gray-500">Click a bar to filter the asset list.</p>
                                    </div>
                                    {typeChartData.some((d) => d.count > 0) && (
                                        <div className="text-right">
                                            <p className="text-2xl font-bold tabular-nums text-gray-900">
                                                {typeChartData.reduce((s, d) => s + d.count, 0).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-gray-400">total assets</p>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-2">
                                {typeChartData.every((d) => d.count === 0) ? (
                                    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                                        <Boxes className="h-8 w-8 text-gray-200" />
                                        <p className="text-sm text-gray-400">No data for this period.</p>
                                    </div>
                                ) : (
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={typeChartData} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                                                <GradientDefs />
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
                                                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                                                <Bar
                                                    dataKey="count"
                                                    radius={[6, 6, 0, 0]}
                                                    maxBarSize={64}
                                                    cursor="pointer"
                                                    onClick={(data) => goToAssetsByType((data as unknown as { typeValue: string }).typeValue)}
                                                >
                                                    <LabelList
                                                        dataKey="count"
                                                        position="top"
                                                        style={{ fontSize: 12, fontWeight: 700, fill: '#374151' }}
                                                    />
                                                    {typeChartData.map((entry) => {
                                                        const cfg = TYPE_LABEL_COLORS[entry.name];
                                                        return (
                                                            <Cell
                                                                key={entry.name}
                                                                fill={cfg ? `url(#${cfg.gradientId})` : FALLBACK_BAR_COLOR}
                                                            />
                                                        );
                                                    })}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base font-semibold text-gray-900">Confiscations by Municipality</CardTitle>
                                        <p className="text-xs text-gray-500">Click a bar to filter the asset list.</p>
                                    </div>
                                    {municipalityChartData.some((d) => d.count > 0) && (
                                        <div className="text-right">
                                            <p className="text-2xl font-bold tabular-nums text-gray-900">
                                                {municipalityChartData.reduce((s, d) => s + d.count, 0).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-gray-400">total assets</p>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-2">
                                {municipalityChartData.every((d) => d.count === 0) ? (
                                    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                                        <MapPin className="h-8 w-8 text-gray-200" />
                                        <p className="text-sm text-gray-400">No data for this period.</p>
                                    </div>
                                ) : (
                                    // Height grows with number of municipalities so bars never feel cramped
                                    <div style={{ height: Math.max(240, municipalityChartData.length * 36 + 16) }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={municipalityChartData}
                                                layout="vertical"
                                                margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                                            >
                                                <GradientDefs />
                                                <CartesianGrid horizontal={false} stroke="#e5e7eb" />
                                                <XAxis
                                                    type="number"
                                                    allowDecimals={false}
                                                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="name"
                                                    width={96}
                                                    tick={{ fontSize: 11, fill: '#374151' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                                                <Bar
                                                    dataKey="count"
                                                    radius={[0, 6, 6, 0]}
                                                    maxBarSize={28}
                                                    cursor="pointer"
                                                    onClick={(data) => goToAssetsByMunicipality((data as unknown as { name: string }).name)}
                                                >
                                                    <LabelList
                                                        dataKey="count"
                                                        position="right"
                                                        style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }}
                                                    />
                                                    {municipalityChartData.map((_, index) => (
                                                        <Cell
                                                            key={index}
                                                            fill={`url(#grad-muni-${index % MUNI_SHADES.length})`}
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* ── Incident map ── */}
                <Card>
                    <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold text-gray-900">Confiscation Locations</CardTitle>
                            <p className="text-xs text-gray-400">
                                {filteredIncidentLocations.length === incidentLocations.length
                                    ? `${incidentLocations.length} incident${incidentLocations.length === 1 ? '' : 's'} with coordinates`
                                    : `${filteredIncidentLocations.length} of ${incidentLocations.length} incidents`}
                                {hasMapFilter && (
                                    <button
                                        type="button"
                                        onClick={() => { setMapMonth('all'); setMapYear('all'); }}
                                        className="ml-2 font-medium text-emerald-600 hover:underline"
                                    >
                                        Clear filter
                                    </button>
                                )}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={mapMonth}
                                onChange={(e) => setMapMonth(e.target.value)}
                                className="h-8 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            >
                                <option value="all">All Months</option>
                                {MONTH_NAMES.map((name, index) => (
                                    <option key={name} value={index}>{name}</option>
                                ))}
                            </select>
                            <select
                                value={mapYear}
                                onChange={(e) => setMapYear(e.target.value)}
                                className="h-8 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                    <CardContent className="pt-0">
                        <IncidentsMap incidents={filteredIncidentLocations} />
                    </CardContent>
                </Card>

                {/* ── Recent Activity ── */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-gray-900">Recent Activity</CardTitle>
                                <p className="mt-0.5 text-xs text-gray-400">
                                    Auto-refreshes every 10 seconds · {recentActivity.length} recent event{recentActivity.length === 1 ? '' : 's'}
                                </p>
                            </div>
                            <Link href={route('audit-logs.index')} className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                                View all logs
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {recentActivity.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center">
                                <Boxes className="h-8 w-8 text-gray-300" />
                                <p className="text-sm text-gray-500">No activity yet. New intakes will appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activityGroups.map((group) => (
                                    <div key={group.label}>
                                        <div className="mb-1 flex items-center gap-2">
                                            <Clock className="h-3 w-3 text-gray-300" />
                                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                {group.label}
                                            </span>
                                            <span className="h-px flex-1 bg-gray-100" />
                                        </div>
                                        <div className="divide-y divide-gray-50">
                                            {group.entries.map((entry) => (
                                                <Link
                                                    key={entry.id}
                                                    href={route('assets.show', entry.asset?.id)}
                                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition hover:bg-gray-50"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400 ring-4 ring-emerald-50" />
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">{entry.asset?.asset_code}</p>
                                                            <p className="text-xs text-gray-500">
                                                                <span className="font-medium text-gray-700">{entry.changed_by?.name}</span>
                                                                {entry.notes ? ` — ${entry.notes}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <AssetStatusBadge
                                                            status={entry.status}
                                                            label={statusLabels[entry.status] ?? entry.status}
                                                        />
                                                        <p className="text-xs text-gray-400">
                                                            {new Date(entry.changed_at).toLocaleTimeString('en-US', {
                                                                hour: 'numeric',
                                                                minute: '2-digit',
                                                            })}
                                                        </p>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Export & Tools ── */}
                <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Exports & Tools</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                        <a href={route('reports.inventory')} className="group block">
                            <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-100">
                                    <FileSpreadsheet className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Inventory CSV</p>
                                    <p className="mt-0.5 text-xs text-gray-500">Full asset list with status, type, and custody details.</p>
                                </div>
                                <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                    Download <Download className="h-3 w-3" />
                                </span>
                            </div>
                        </a>

                        <a href={route('reports.compliance')} className="group block">
                            <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition group-hover:bg-blue-100">
                                    <FileText className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Compliance PDF</p>
                                    <p className="mt-0.5 text-xs text-gray-500">Document compliance summary for regulatory submission.</p>
                                </div>
                                <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                                    Download <Download className="h-3 w-3" />
                                </span>
                            </div>
                        </a>

                        {can.viewAudit && (
                            <Link href={route('audit-logs.index')} className="group block">
                                <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700 transition group-hover:bg-violet-100">
                                        <ClipboardList className="h-4.5 w-4.5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Audit Logs</p>
                                        <p className="mt-0.5 text-xs text-gray-500">Full history of all system changes and user actions.</p>
                                    </div>
                                    <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
                                        View <ArrowRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </Link>
                        )}

                        {can.viewDonations && (
                            <Link href={route('reports.donations')} className="group block">
                                <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700 transition group-hover:bg-amber-100">
                                        <Gift className="h-4.5 w-4.5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Donations</p>
                                        <p className="mt-0.5 text-xs text-gray-500">Batch donation records and release order history.</p>
                                    </div>
                                    <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                        View <ArrowRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </Link>
                        )}

                    </div>
                </div>

            </div>
            <AttributeTableModal show={showAttributeTable} onClose={() => setShowAttributeTable(false)} />
        </AuthenticatedLayout>
    );
}