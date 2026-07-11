import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Head, Link, usePage } from '@inertiajs/react';
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
} from 'lucide-react';

interface DashboardAlert {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    asset_id: number;
}

interface DashboardProps {
    stats: {
        total: number;
        byType: Record<string, number>;
        byStatus: Record<string, number>;
    };
    statusLabels: Record<string, string>;
    typeLabels: Record<string, string>;
    roleContext: {
        title: string;
        description: string;
        cards: Array<{ label: string; value: number; description: string }>;
    };
    canViewAudit: boolean;
    alerts: DashboardAlert[];
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

const SEVERITY_STYLES: Record<DashboardAlert['severity'], { border: string; bg: string; icon: typeof AlertTriangle; iconColor: string }> = {
    critical: { border: 'border-red-200', bg: 'bg-red-50', icon: AlertTriangle, iconColor: 'text-red-600' },
    warning: { border: 'border-amber-200', bg: 'bg-amber-50', icon: AlertCircle, iconColor: 'text-amber-600' },
    info: { border: 'border-blue-200', bg: 'bg-blue-50', icon: Info, iconColor: 'text-blue-600' },
};

export default function DashboardIndex({
    stats,
    roleContext,
    alerts,
    typeLabels,
}: DashboardProps) {
    const { auth } = usePage<PageProps>().props;
    const permissions = auth.user?.permissions ?? [];

    const primaryAction = permissions.includes('incident.create')
        ? { label: 'New Intake', href: route('incident.create') }
        : permissions.includes('reports.view')
            ? { label: 'View Reports', href: route('reports.index') }
            : permissions.includes('disposals.view')
                ? { label: 'View Disposals', href: route('disposals.index') }
                : { label: 'View All Assets', href: route('assets.index') };

    const disposedCount = TERMINAL_STATUSES.reduce((sum, key) => sum + (stats.byStatus[key] ?? 0), 0);
    const underTrialCount = stats.byStatus['under_trial'] ?? 0;

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
                        <Link href={primaryAction.href}>
                            <Button variant="outline">{primaryAction.label}</Button>
                        </Link>
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