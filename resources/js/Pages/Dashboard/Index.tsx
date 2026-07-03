import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { PageProps } from '@/types';
import {
    Boxes,
    Car,
    ClipboardCheck,
    FileSignature,
    Calculator,
    PackagePlus,
    Recycle,
    CheckCircle2,
    TreePine,
    Wrench,
    Scale,
} from 'lucide-react';

interface DashboardProps {
    stats: {
        total: number;
        byType: Record<string, number>;
        byStatus: Record<string, number>;
        byMunicipality: Array<{ municipality_of_origin: string; count: number }>;
    };
    recentActivity: Array<{
        id: number;
        status: string;
        notes: string | null;
        changed_at: string;
        asset?: { asset_code: string; id: number };
        changed_by?: { name: string };
    }>;
    statusLabels: Record<string, string>;
    typeLabels: Record<string, string>;
    roleContext: {
        title: string;
        description: string;
        cards: Array<{ label: string; value: number; description: string }>;
    };
    canViewAudit: boolean;
}

const TYPE_ICONS: Record<string, typeof TreePine> = {
    log: TreePine,
    equipment: Wrench,
    vehicle: Car,
};

const PIPELINE_STAGES: Array<{ key: string; label: string; icon: typeof PackagePlus }> = [
    { key: 'intake_recorded', label: 'Intake', icon: PackagePlus },
    { key: 'pending_custody_review', label: 'Custody Review', icon: ClipboardCheck },
    { key: 'receipt_signed', label: 'Signed', icon: FileSignature },
    { key: 'stored', label: 'Stored', icon: Boxes },
    { key: 'cleared_for_accounting', label: 'Accounting', icon: Calculator },
    { key: 'for_disposal', label: 'For Disposal', icon: Recycle },
];

const TERMINAL_STATUSES = ['donated', 'decayed', 'fabricated', 'released', 'forfeited', 'damaged'];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
            <p className="font-medium text-gray-700">{label}</p>
            <p className="mt-0.5 text-emerald-700">{payload[0].value} asset{payload[0].value === 1 ? '' : 's'}</p>
        </div>
    );
}

export default function DashboardIndex({
    stats,
    recentActivity,
    statusLabels,
    typeLabels,
    roleContext,
}: DashboardProps) {
    const { auth } = usePage<PageProps>().props;
    const permissions = auth.user?.permissions ?? [];

    const primaryAction = permissions.includes('assets.create')
        ? { label: 'New Intake', href: route('assets.create') }
        : permissions.includes('reports.view')
            ? { label: 'View Reports', href: route('reports.index') }
            : permissions.includes('disposals.view')
                ? { label: 'View Disposals', href: route('disposals.index') }
                : { label: 'View All Assets', href: route('assets.index') };

    const typeChartData = Object.entries(stats.byType).map(([type, count]) => ({
        name: typeLabels[type] ?? type,
        count,
    }));

    const municipalityChartData = stats.byMunicipality.map((row) => ({
        name: row.municipality_of_origin,
        count: row.count,
    }));

    const disposedCount = TERMINAL_STATUSES.reduce((sum, key) => sum + (stats.byStatus[key] ?? 0), 0);
    const underTrialCount = stats.byStatus['under_trial'] ?? 0;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-900">
                            Inventory Dashboard
                        </h2>
                        <p className="text-sm text-gray-500">{roleContext.description}</p>
                    </div>
                    <Link href={primaryAction.href}>
                        <Button variant="outline">{primaryAction.label}</Button>
                    </Link>
                </div>
            }
        >
            <Head title="Dashboard" />

            <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                {/* Role context */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold text-gray-900">{roleContext.title}</CardTitle>
                        <p className="text-sm text-gray-500">{roleContext.description}</p>
                    </CardHeader>
                    <CardContent className="grid gap-3 pt-0 md:grid-cols-3">
                        {roleContext.cards.map((card) => (
                            <div key={card.label} className="rounded-lg border border-gray-200 p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
                                <p className="mt-1.5 text-2xl font-semibold text-gray-900">{card.value}</p>
                                <p className="mt-1 text-xs text-gray-500">{card.description}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Pipeline stepper — signature element */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-gray-900">Custody Pipeline</CardTitle>
                        <p className="text-sm text-gray-500">
                            Live count of assets at each stage of the MES → Property → Accounting → Disposal flow.
                        </p>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="flex items-start gap-1 overflow-x-auto pb-2 sm:gap-0">
                            {PIPELINE_STAGES.map((stage, index) => {
                                const Icon = stage.icon;
                                const count = stats.byStatus[stage.key] ?? 0;
                                const isLast = index === PIPELINE_STAGES.length - 1;
                                return (
                                    <div key={stage.key} className="flex flex-1 items-start">
                                        <div className="flex min-w-[92px] flex-col items-center gap-2 px-1 text-center">
                                            <div
                                                className={
                                                    'flex h-11 w-11 items-center justify-center rounded-full border-2 ' +
                                                    (count > 0
                                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                                        : 'border-gray-200 bg-gray-50 text-gray-400')
                                                }
                                            >
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-semibold leading-none text-gray-900">{count}</p>
                                                <p className="mt-1 text-[11px] font-medium leading-tight text-gray-500">
                                                    {stage.label}
                                                </p>
                                            </div>
                                        </div>
                                        {!isLast && (
                                            <div className="mt-5 h-px flex-1 min-w-[16px] bg-gray-200" />
                                        )}
                                    </div>
                                );
                            })}
                            <div className="flex min-w-[92px] flex-col items-center gap-2 px-1 text-center">
                                <div
                                    className={
                                        'flex h-11 w-11 items-center justify-center rounded-full border-2 ' +
                                        (disposedCount > 0
                                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                            : 'border-gray-200 bg-gray-50 text-gray-400')
                                    }
                                >
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold leading-none text-gray-900">{disposedCount}</p>
                                    <p className="mt-1 text-[11px] font-medium leading-tight text-gray-500">Disposed</p>
                                </div>
                            </div>
                        </div>
                        {underTrialCount > 0 && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                                <Scale className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                    {underTrialCount} asset{underTrialCount === 1 ? '' : 's'} held under trial — pending case
                                    resolution before moving to accounting.
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Totals */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardContent className="flex items-center gap-3 p-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <Boxes className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Assets</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                            </div>
                        </CardContent>
                    </Card>
                    {Object.entries(stats.byType).map(([type, count]) => {
                        const Icon = TYPE_ICONS[type] ?? Boxes;
                        return (
                            <Card key={type}>
                                <CardContent className="flex items-center gap-3 p-5">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                            {typeLabels[type] ?? type}
                                        </p>
                                        <p className="text-2xl font-semibold text-gray-900">{count}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Charts */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold text-gray-900">Assets by Type</CardTitle>
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
                                    <Bar dataKey="count" fill="#047857" radius={[6, 6, 0, 0]} maxBarSize={56} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold text-gray-900">Confiscations by Municipality</CardTitle>
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
                                    <Bar dataKey="count" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={56} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

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
            </div>
        </AuthenticatedLayout>
    );
}