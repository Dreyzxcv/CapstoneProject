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
    { label: 'QR stickers & scanning', icon: QrCode },
    { label: 'Inventory dashboard & workflow alerts', icon: LayoutDashboard },
    { label: 'Custody, case & disposal workflow', icon: GitBranch },
    { label: 'Reports, charts & incident mapping', icon: BarChart3 },
    { label: 'Role-based access & audit logs', icon: ShieldCheck },
];

const ASSET_TYPES = ['Logs', 'Equipment', 'Vehicles'];

function SectionLabel({ children }: { children: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-emerald-600" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</p>
        </div>
    );
}

export default function About() {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">About</h2>}>
            <Head title="About" />

            <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
                {/* Hero */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="px-6 py-8 text-center sm:px-10">
                        <h1 className="sr-only">ForesTrack</h1>
                        <img
                            src="/images/foresttrack-logo.png"
                            alt="ForesTrack: A QR-Based Forest Asset Inventory and GIS Mapping System"
                            className="mx-auto h-auto w-full max-w-sm object-contain sm:max-w-md"
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                            {ASSET_TYPES.map((type) => (
                                <span
                                    key={type}
                                    className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100"
                                >
                                    {type}
                                </span>
                            ))}
                        </div>

                        <div className="mx-auto my-6 h-px max-w-2xl bg-gray-100" aria-hidden="true" />

                        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-gray-600">
                            ForesTrack is a web-based system for recording and monitoring forest assets
                            received by DENR-PENRO Catanduanes through apprehension or turn-over, including
                            apprehended items with no claimant. It keeps incident, claimant, asset, piece,
                            custody, case, and disposal information for logs, equipment, and vehicles in one
                            shared inventory. Printable QR stickers link to the current asset or piece
                            record, which authorized, signed-in staff can open to review details, documents,
                            and status history. The system supports document and custody review, case
                            details, JEV processing, type-specific dispositions, and reports with incident
                            location maps and CSV or PDF exports. It supports, but does not replace,
                            official paperwork and approvals.
                        </p>
                    </CardContent>
                </Card>

                {/* Core features */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="space-y-4 pt-6">
                        <SectionLabel>Core Features</SectionLabel>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {FEATURES.map(({ label, icon: Icon }, i) => (
                                <div
                                    key={label}
                                    className={
                                        'group flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3.5 py-3 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow ' +
                                        (i === FEATURES.length - 1 && FEATURES.length % 2 === 1 ? 'sm:col-span-2' : '')
                                    }
                                >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <span className="text-sm font-medium text-gray-800">{label}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Credits */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="space-y-4 pt-6">
                        <SectionLabel>Credits</SectionLabel>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {CREDITS.map(({ role, names, icon: Icon }) => (
                                <div
                                    key={role}
                                    className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"
                                >
                                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                        {role}
                                    </p>
                                    <ul className="mt-1 space-y-0.5">
                                        {names.map((name) => (
                                            <li key={name} className="text-sm font-medium text-gray-900">
                                                {name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <p className="pb-4 text-center text-xs leading-relaxed text-gray-400">
                    Developed for DENR-PENRO Catanduanes as a capstone project under the College of Information
                    and Communications Technology (CICT), Catanduanes State University.
                </p>
            </div>
        </AuthenticatedLayout>
    );
}