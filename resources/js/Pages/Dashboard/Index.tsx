import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Head, Link, usePage, usePoll } from '@inertiajs/react';
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
    AlertTriangle,
    AlertCircle,
    Info,
    PartyPopper,
    FileBarChart2,
    FileCheck,
    QrCode,
    TrendingUp,
    Layers,
    ShieldAlert,
    Archive,
    ArrowRight,
} from 'lucide-react';

interface DashboardAlert {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    asset_id: number;
}

interface PipelineStage {
    key: string;
    label: string;
    value: number;
}

interface DispositionItem {
    key: string;
    label: string;
    value: number;
}

interface RoleContext {
    title: string;
    description: string;
    cards: Array<{ label: string; value: number; description: string; delta?: number }>;
    pipeline?: PipelineStage[];
    dispositionBreakdown?: DispositionItem[];
}

interface DashboardProps {
    stats: {
        total: number;
        byType: Record<string, number>;
        byStatus: Record<string, number>;
    };
    statusLabels: Record<string, string>;
    typeLabels: Record<string, string>;
    roleContext: RoleContext;
    canViewAudit: boolean;
    alerts: DashboardAlert[];
}

const TYPE_ICONS: Record<string, typeof TreePine> = {
    log: TreePine,
    equipment: Wrench,
    vehicle: Car,
};

const PIPELINE_STAGES: Array<{ key: string; label: string; icon: typeof PackagePlus }> = [
    { key: 'stored', label: 'Stored', icon: Boxes },
    { key: 'receipt_signed', label: 'Document Verified', icon: FileCheck },
    { key: 'pending_custody_review', label: 'Custody Review', icon: ClipboardCheck },
    { key: 'cleared_for_accounting', label: 'Tagged', icon: QrCode },
    { key: 'for_disposal', label: 'For Disposal', icon: Recycle },
];

const TERMINAL_STATUSES = ['donated', 'decayed', 'fabricated', 'released', 'forfeited', 'damaged'];

const SEVERITY_STYLES: Record<DashboardAlert['severity'], { border: string; bg: string; icon: typeof AlertTriangle; iconColor: string }> = {
    critical: { border: 'border-red-200', bg: 'bg-red-50', icon: AlertTriangle, iconColor: 'text-red-600' },
    warning: { border: 'border-amber-200', bg: 'bg-amber-50', icon: AlertCircle, iconColor: 'text-amber-600' },
    info: { border: 'border-blue-200', bg: 'bg-blue-50', icon: Info, iconColor: 'text-blue-600' },
};

function ManagementStatCards({ cards }: { cards: RoleContext['cards'] }) {
    const colorMap: Record<number, { bg: string; text: string; border: string }> = {
        0: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
        1: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
        2: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
        3: { bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200' },
    };

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, i) => {
                const c = colorMap[i] ?? colorMap[3];
                return (
                    <Card key={card.label} className={`border ${c.border}`}>
                        <CardContent className="p-5">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                {card.label}
                            </p>
                            <p className={`mt-1 text-3xl font-bold ${c.text}`}>{card.value}</p>
                            {card.delta !== undefined && card.delta > 0 ? (
                                <p className="mt-1 text-xs font-medium text-emerald-600">
                                    +{card.delta} this week
                                </p>
                            ) : (
                                <p className="mt-1 text-xs text-gray-400">{card.description}</p>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

function PipelineHealthCard({ pipeline }: { pipeline: PipelineStage[] }) {
    const total = pipeline.reduce((s, p) => s + p.value, 0);

    // Flag stages with disproportionately high counts as bottlenecks
    const avg = total / (pipeline.length || 1);
    const BOTTLENECK_THRESHOLD = 1.8;

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-900">
                        Pipeline Health
                    </CardTitle>
                    <span className="text-xs text-gray-400">{total} assets in flow</span>
                </div>
                <p className="text-sm text-gray-500">
                    Distribution across active workflow stages. Highlighted stages may need attention.
                </p>
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
                {pipeline.map((stage) => {
                    const pct = total > 0 ? Math.round((stage.value / total) * 100) : 0;
                    const isBottleneck = stage.value > avg * BOTTLENECK_THRESHOLD && stage.value > 0;
                    const isTrialStage = stage.key === 'under_trial';

                    return (
                        <div key={stage.key}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-1.5 text-sm text-gray-700">
                                    {stage.label}
                                    {isBottleneck && !isTrialStage && (
                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                            <AlertTriangle className="h-2.5 w-2.5" />
                                            high
                                        </span>
                                    )}
                                    {isTrialStage && stage.value > 0 && (
                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                            <Scale className="h-2.5 w-2.5" />
                                            legal hold
                                        </span>
                                    )}
                                </span>
                                <span className="text-sm font-semibold text-gray-900">
                                    {stage.value}
                                    <span className="ml-1 text-xs font-normal text-gray-400">({pct}%)</span>
                                </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-100">
                                <div
                                    className={`h-2 rounded-full transition-all ${
                                        isTrialStage
                                            ? 'bg-blue-400'
                                            : isBottleneck
                                            ? 'bg-amber-400'
                                            : 'bg-emerald-400'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
                {total === 0 && (
                    <p className="py-4 text-center text-sm text-gray-400">No assets currently in the pipeline.</p>
                )}
            </CardContent>
        </Card>
    );
}

function DispositionOutcomesCard({ breakdown }: { breakdown: DispositionItem[] }) {
    const total = breakdown.reduce((s, d) => s + d.value, 0);

    const colorMap: Record<string, string> = {
        donated:    'bg-emerald-400',
        released:   'bg-blue-400',
        forfeited:  'bg-purple-400',
        decayed:    'bg-orange-400',
        fabricated: 'bg-yellow-400',
        damaged:    'bg-red-400',
    };

    const nonZero = breakdown.filter((d) => d.value > 0);

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-900">
                        Disposition Outcomes
                    </CardTitle>
                    <span className="text-xs text-gray-400">{total} total disposed</span>
                </div>
                <p className="text-sm text-gray-500">
                    Breakdown of how assets were closed out.
                </p>
            </CardHeader>
            <CardContent className="pt-2">
                {total === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-400">No disposals recorded yet.</p>
                ) : (
                    <>
                        {/* Stacked bar */}
                        <div className="flex h-3 w-full overflow-hidden rounded-full gap-0.5 mb-4">
                            {nonZero.map((d) => (
                                <div
                                    key={d.key}
                                    className={`h-full ${colorMap[d.key] ?? 'bg-gray-300'}`}
                                    style={{ width: `${(d.value / total) * 100}%` }}
                                    title={`${d.label}: ${d.value}`}
                                />
                            ))}
                        </div>
                        {/* Legend */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                            {breakdown.map((d) => (
                                <div key={d.key} className="flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorMap[d.key] ?? 'bg-gray-300'}`} />
                                    <span className="text-xs text-gray-600">{d.label}</span>
                                    <span className="ml-auto text-xs font-semibold text-gray-900">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function AssetTypeBreakdownCard({
    byType,
    typeLabels,
    total,
}: {
    byType: Record<string, number>;
    typeLabels: Record<string, string>;
    total: number;
}) {
    const colorMap: Record<string, string> = {
        log:       'bg-emerald-500',
        equipment: 'bg-blue-500',
        vehicle:   'bg-purple-500',
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900">Asset Composition</CardTitle>
                <p className="text-sm text-gray-500">Inventory split by type across all {total} recorded assets.</p>
            </CardHeader>
            <CardContent className="pt-2 space-y-3">
                {Object.entries(byType).map(([type, count]) => {
                    const Icon = TYPE_ICONS[type] ?? Boxes;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                        <div key={type}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-1.5 text-sm text-gray-700">
                                    <Icon className="h-3.5 w-3.5 text-gray-400" />
                                    {typeLabels[type] ?? type}
                                </span>
                                <span className="text-sm font-semibold text-gray-900">
                                    {count}
                                    <span className="ml-1 text-xs font-normal text-gray-400">({pct}%)</span>
                                </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-100">
                                <div
                                    className={`h-2 rounded-full ${colorMap[type] ?? 'bg-gray-400'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

// --- Main component ---

export default function DashboardIndex({
    stats,
    roleContext,
    alerts,
    typeLabels,
}: DashboardProps) {
    const { auth } = usePage<PageProps>().props;
    const permissions = auth.user?.permissions ?? [];
    const roleName = auth.user?.roles?.[0] ?? '';

    const isManagement = ['PENRO Management', 'PENRO Supervisor', 'Regional Supervisor'].includes(roleName);

    usePoll(8000, {
        only: ['stats', 'alerts', 'roleContext'],
    });

    const primaryAction = permissions.includes('incident.create')
        ? { label: 'New Intake', href: route('incident.create') }
        : permissions.includes('reports.view')
            ? { label: 'View Reports', href: route('reports.index') }
            : permissions.includes('disposals.view')
                ? { label: 'View Disposals', href: route('disposals.index') }
                : { label: 'View All Assets', href: route('assets.index') };

    const disposedCount = TERMINAL_STATUSES.reduce((sum, key) => sum + (stats.byStatus[key] ?? 0), 0);
    const underTrialCount = stats.byStatus['under_trial'] ?? 0;

    // ── MANAGEMENT LAYOUT ───────────────────────────────────────────────────
    if (isManagement) {
        return (
            <AuthenticatedLayout
                header={
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold leading-tight text-gray-900">
                                Management Dashboard
                            </h2>
                            <p className="text-sm text-gray-500">{roleContext.description}</p>
                        </div>
                        <div className="flex gap-2">
                            {permissions.includes('reports.view') && (
                                <Link href={route('reports.index')}>
                                    <Button>
                                        <FileBarChart2 className="mr-2 h-4 w-4" />
                                        Reports & Trends
                                    </Button>
                                </Link>
                            )}
                            <Link href={route('assets.index')}>
                                <Button variant="secondary">
                                    <Boxes className="mr-2 h-4 w-4" />
                                    View All Assets
                                </Button>
                            </Link>
                        </div>
                    </div>
                }
            >
                <Head title="Dashboard" />

                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">

                    {/* Top-line KPI cards */}
                    <ManagementStatCards cards={roleContext.cards} />

                    {/* Pipeline health + asset composition side by side on lg */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {roleContext.pipeline && (
                            <PipelineHealthCard pipeline={roleContext.pipeline} />
                        )}
                        <AssetTypeBreakdownCard
                            byType={stats.byType}
                            typeLabels={typeLabels}
                            total={stats.total}
                        />
                    </div>

                    {/* Disposition outcomes — full width */}
                    {roleContext.dispositionBreakdown && (
                        <DispositionOutcomesCard breakdown={roleContext.dispositionBreakdown} />
                    )}

                    {/* Critical alerts only — management doesn't need operational noise */}
                    {alerts.some((a) => a.severity === 'critical') && (
                        <Card className="border-red-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-red-700">
                                    <ShieldAlert className="h-4 w-4" />
                                    Critical Items
                                </CardTitle>
                                <p className="text-sm text-gray-500">
                                    High-severity issues that require executive awareness.
                                </p>
                            </CardHeader>
                            <CardContent className="pt-2 space-y-2">
                                {alerts
                                    .filter((a) => a.severity === 'critical')
                                    .map((alert) => (
                                        <Link
                                            key={alert.id}
                                            href={route('assets.show', alert.asset_id)}
                                            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 transition hover:opacity-80"
                                        >
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                                                <p className="text-sm text-gray-600">{alert.message}</p>
                                            </div>
                                            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                                        </Link>
                                    ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Quick links */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {permissions.includes('reports.view') && (
                            <Link href={route('reports.index')}>
                                <Card className="cursor-pointer transition hover:shadow-md hover:border-emerald-300">
                                    <CardContent className="flex items-center gap-3 p-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                            <FileBarChart2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">Reports & Trends</p>
                                            <p className="text-xs text-gray-500">Analytics and export</p>
                                        </div>
                                        <ArrowRight className="ml-auto h-4 w-4 text-gray-300" />
                                    </CardContent>
                                </Card>
                            </Link>
                        )}
                        {permissions.includes('disposals.view') && (
                            <Link href={route('disposals.index')}>
                                <Card className="cursor-pointer transition hover:shadow-md hover:border-blue-300">
                                    <CardContent className="flex items-center gap-3 p-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                            <Archive className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">Disposals</p>
                                            <p className="text-xs text-gray-500">Closed-out cases</p>
                                        </div>
                                        <ArrowRight className="ml-auto h-4 w-4 text-gray-300" />
                                    </CardContent>
                                </Card>
                            </Link>
                        )}
                        <Link href={route('assets.index')}>
                            <Card className="cursor-pointer transition hover:shadow-md hover:border-gray-300">
                                <CardContent className="flex items-center gap-3 p-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                                        <Boxes className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">All Assets</p>
                                        <p className="text-xs text-gray-500">Full inventory list</p>
                                    </div>
                                    <ArrowRight className="ml-auto h-4 w-4 text-gray-300" />
                                </CardContent>
                            </Card>
                        </Link>
                    </div>

                </div>
            </AuthenticatedLayout>
        );
    }

    // ── DEFAULT (non-management) LAYOUT — unchanged ─────────────────────────
    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-gray-900">
                            Dashboard
                        </h2>
                        <p className="text-sm text-gray-500">{roleContext.description}</p>
                    </div>
                    <div className="flex gap-2">
                        {permissions.includes('reports.view') && (
                            <Link href={route('reports.index')}>
                                <Button variant="secondary">
                                    <FileBarChart2 className="mr-2 h-4 w-4" />
                                    Reports & Trends
                                </Button>
                            </Link>
                        )}
                    </div>
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

                {/* Alerts */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-gray-900">Action Needed</CardTitle>
                        <p className="text-sm text-gray-500">
                            Deadlines, decay risk, and stalled paperwork that need follow-up.
                        </p>
                    </CardHeader>
                    <CardContent className="pt-2">
                        {alerts.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                                <PartyPopper className="h-8 w-8 text-emerald-300" />
                                <p className="text-sm text-gray-500">Nothing needs attention right now.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {alerts.map((alert) => {
                                    const style = SEVERITY_STYLES[alert.severity];
                                    const Icon = style.icon;
                                    return (
                                        <Link
                                            key={alert.id}
                                            href={route('assets.show', alert.asset_id)}
                                            className={`flex items-start gap-3 rounded-lg border ${style.border} ${style.bg} p-3 transition hover:opacity-80`}
                                        >
                                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconColor}`} />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                                                <p className="text-sm text-gray-600">{alert.message}</p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pipeline stepper */}
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
            </div>
        </AuthenticatedLayout>
    );
}