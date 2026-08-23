import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Shield, Clock, Laptop, KeyRound, Trash2 } from 'lucide-react';
import AccountActivity from './Partials/AccountActivity';
import ActiveSessionsForm from './Partials/ActiveSessionsForm';
import DeleteUserForm from './Partials/DeleteUserForm';
import TwoFactorAuthenticationForm from './Partials/TwoFactorAuthenticationForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

interface RecentActivityEntry {
    id: number;
    action: string;
    model_type: string | null;
    model_id: number | null;
    created_at: string;
}

interface SessionEntry {
    id: string;
    ip_address: string | null;
    browser: string;
    platform: string;
    last_active: string;
    is_current_device: boolean;
}

function SectionCard({
    icon,
    title,
    description,
    danger,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    description?: string;
    danger?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className={`rounded-xl border bg-white shadow-sm ${danger ? 'border-red-200' : 'border-gray-200'}`}>
            <div className={`flex items-start gap-3 border-b px-5 py-3.5 ${danger ? 'border-red-100' : 'border-gray-100'}`}>
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${danger ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {icon}
                </span>
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                    {description && (
                        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
                    )}
                </div>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    );
}

export default function Edit({
    mustVerifyEmail,
    status,
    lastLoginAt,
    recentActivity,
    sessions,
}: PageProps<{
    mustVerifyEmail: boolean;
    status?: string;
    lastLoginAt: string | null;
    recentActivity: RecentActivityEntry[];
    sessions: SessionEntry[];
}>) {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user!;
    const role = user.roles?.[0] ?? 'User';

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Profile
                </h2>
            }
        >
            <Head title="Profile" />

            <div className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">

                {/* ── Identity Header — full width ── */}
                <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-800">
                        {user.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold text-gray-900">{user.name}</p>
                        <p className="truncate text-sm text-gray-500">{user.email}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 shrink-0">
                        <Shield className="h-3 w-3" />
                        {role}
                    </span>
                </div>

                {/* ── Two-column body ── */}
                <div className="grid gap-4 lg:grid-cols-2">

                    {/* Left column: forms */}
                    <div className="space-y-4">
                        <SectionCard
                            icon={<Shield className="h-4 w-4" />}
                            title="Profile Information"
                            description="Update your name and email address."
                        >
                            <UpdateProfileInformationForm
                                mustVerifyEmail={mustVerifyEmail}
                                status={status}
                            />
                        </SectionCard>

                        <SectionCard
                            icon={<KeyRound className="h-4 w-4" />}
                            title="Security"
                            description="Change your password and manage 2FA."
                        >
                            <div className="space-y-6">
                                <UpdatePasswordForm />
                                <div className="border-t border-gray-100 pt-5">
                                    <TwoFactorAuthenticationForm />
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    {/* Right column: activity & sessions */}
                    <div className="space-y-4">
                        <SectionCard
                            icon={<Clock className="h-4 w-4" />}
                            title="Recent Activity"
                            description="Your latest actions in the system."
                        >
                            <AccountActivity
                                lastLoginAt={lastLoginAt}
                                recentActivity={recentActivity}
                            />
                        </SectionCard>

                        <SectionCard
                            icon={<Laptop className="h-4 w-4" />}
                            title="Active Sessions"
                            description="Devices currently logged into your account."
                        >
                            <ActiveSessionsForm sessions={sessions} />
                        </SectionCard>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}