import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent } from '@/Components/ui/card';
import { Head } from '@inertiajs/react';
import { Code2, Users2, FileText, QrCode, LayoutDashboard, GitBranch, BarChart3, ShieldCheck } from 'lucide-react';
import { ComponentType } from 'react';

interface CreditRole {
    role: string;
    names: string[];
    icon: ComponentType<{ className?: string }>;
}

const CREDITS: CreditRole[] = [
    { role: 'Programmer', names: ['Justine Tacorda'], icon: Code2 },
    { role: 'Leader', names: ['Mikko Bobier'], icon: Users2 },
    { role: 'Documentation', names: ['Khaliq Meshaal Aguilar', 'Lenard Gil Llorca'], icon: FileText },
];

interface FeatureItem {
    label: string;
    icon: ComponentType<{ className?: string }>;
}

const FEATURES: FeatureItem[] = [
    { label: 'QR code generation & tagging', icon: QrCode },
    { label: 'Real-time inventory dashboard', icon: LayoutDashboard },
    { label: 'Asset lifecycle tracking', icon: GitBranch },
    { label: 'Data analytics & reporting', icon: BarChart3 },
    { label: 'Role-Based Access Control (RBAC)', icon: ShieldCheck },
];

export default function About() {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">About</h2>}>
            <Head title="About" />

            <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6 text-center">
                        <h1 className="text-lg font-bold text-emerald-900">LogTrack Insight</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            A QR-Based Forest Asset Inventory System with Data Analytics
                        </p>
                        <p className="mt-4 text-sm leading-relaxed text-gray-600">
                            LogTrack Insight replaces the manual, paper-based tracking of confiscated forest
                            assets, logs, equipment, and vehicles at DENR-PENRO Catanduanes with a
                            centralized, QR-code-driven platform. Each confiscated asset is assigned a unique
                            QR code linking to its live digital profile, letting authorized personnel instantly
                            retrieve confiscation details, legal status, and supporting documents, track its
                            lifecycle from intake to final disposition, and generate compliance reports for
                            DAO 97-32 submissions.
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Core Features</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {FEATURES.map(({ label, icon: Icon }) => (
                                <div key={label} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
                                    <Icon className="h-4 w-4 shrink-0 text-emerald-700" />
                                    <span className="text-sm text-gray-700">{label}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardContent className="divide-y divide-gray-100 pt-6">
                        {CREDITS.map(({ role, names, icon: Icon }) => (
                            <div key={role} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{role}</p>
                                    <p className="mt-1 text-sm font-medium text-gray-900">{names.join(', ')}</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <p className="pb-4 text-center text-xs text-gray-400">
                    Developed for DENR-PENRO Catanduanes as a capstone project under the College of Information
                    and Communications Technology (CICT), Catanduanes State University.
                </p>
            </div>
        </AuthenticatedLayout>
    );
}