import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent, CardTitle } from '@/Components/ui/card';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    Users,
    ChevronRight,
    SlidersHorizontal,
    Info,
    HardDrive,
    CheckCircle2,
    XCircle,
    Loader2,
} from 'lucide-react';
import { ComponentType, FormEvent } from 'react';

interface SettingsCard {
    key: string;
    title: string;
    description: string;
    href: string;
    icon: string;
}

interface BackupStatus {
    status: 'success' | 'failed';
    filename: string;
    size: string;
    completed_at: string | null;
    error_message: string | null;
}

interface Props {
    cards: SettingsCard[];
    backupStatus: BackupStatus | null;
    canRunBackup: boolean;
}

function PesoIcon({ className }: { className?: string }) {
    return <span className={`flex items-center justify-center font-bold ${className ?? ''}`}>₱</span>;
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
    Users,
    Peso: PesoIcon,
    Info,
};

function BackupStatusCard({ backupStatus, canRunBackup }: { backupStatus: BackupStatus | null; canRunBackup: boolean }) {
    const { post, processing } = useForm();

    function handleRunBackup(e: FormEvent) {
        e.preventDefault();
        post(route('backup.run'));
    }

    const succeeded = backupStatus?.status === 'success';
    const failed = backupStatus?.status === 'failed';

    const formattedDate = backupStatus?.completed_at
        ? new Intl.DateTimeFormat('en-PH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          }).format(new Date(backupStatus.completed_at))
        : null;

    return (
        <Card className="col-span-full border-0 shadow-sm">
            <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: icon + info */}
                    <div className="flex items-start gap-4">
                        <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                failed
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-emerald-50 text-emerald-700'
                            }`}
                        >
                            <HardDrive className="h-5 w-5" />
                        </span>

                        <div>
                            <CardTitle className="text-base">System Backup</CardTitle>

                            {backupStatus === null && (
                                <p className="mt-1 text-sm text-gray-500">No backups have been created yet.</p>
                            )}

                            {succeeded && (
                                <div className="mt-1 space-y-0.5">
                                    <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                                        Last backup succeeded
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {formattedDate} &middot; {backupStatus.size}
                                    </p>
                                    <p className="text-xs text-gray-400">{backupStatus.filename}</p>
                                </div>
                            )}

                            {failed && (
                                <div className="mt-1 space-y-0.5">
                                    <p className="flex items-center gap-1.5 text-sm text-red-600">
                                        <XCircle className="h-4 w-4 shrink-0" />
                                        Last backup failed
                                    </p>
                                    {formattedDate && (
                                        <p className="text-sm text-gray-500">{formattedDate}</p>
                                    )}
                                    {backupStatus.error_message && (
                                        <p className="max-w-prose text-xs text-red-500">
                                            {backupStatus.error_message}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: manual trigger button */}
                    {canRunBackup && (
                        <form onSubmit={handleRunBackup} className="shrink-0">
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
                            >
                                {processing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <HardDrive className="h-4 w-4" />
                                )}
                                {processing ? 'Running...' : 'Run Backup Now'}
                            </button>
                        </form>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function SettingsIndex({ cards, backupStatus, canRunBackup }: Props) {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Settings</h2>}>
            <Head title="Settings" />

            <div className="mx-auto max-w-4xl space-y-4 px-4 sm:px-6 lg:px-8">
                {cards.length === 0 && backupStatus === null ? (
                    <p className="py-10 text-center text-sm text-gray-500">
                        You don't have access to any settings sections.
                    </p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* Backup status card -- System Admin only, spans both columns */}
                        {(backupStatus !== null || canRunBackup) && (
                            <BackupStatusCard backupStatus={backupStatus} canRunBackup={canRunBackup} />
                        )}

                        {cards.map((card) => {
                            const Icon = ICONS[card.icon] ?? SlidersHorizontal;
                            return (
                                <Link key={card.key} href={card.href}>
                                    <Card className="h-full border-0 shadow-sm transition hover:shadow-md hover:ring-1 hover:ring-emerald-200">
                                        <CardContent className="flex items-start gap-4 pt-6">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <div className="flex-1">
                                                <CardTitle className="text-base">{card.title}</CardTitle>
                                                <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                                            </div>
                                            <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-gray-300" />
                                        </CardContent>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}