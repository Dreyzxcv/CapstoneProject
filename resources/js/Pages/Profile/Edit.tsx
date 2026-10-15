import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import {
    BadgeCheck,
    Clock,
    KeyRound,
    Laptop,
    MailWarning,
    Shield,
    User as UserIcon,
} from 'lucide-react';
import AccountActivity from './Partials/AccountActivity';
import ActiveSessionsForm from './Partials/ActiveSessionsForm';
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

const SECTIONS = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'security', label: 'Security', icon: KeyRound },
    { id: 'activity', label: 'Recent Activity', icon: Clock },
    { id: 'sessions', label: 'Active Sessions', icon: Laptop },
] as const;

function SectionCard({
    id,
    icon,
    title,
    description,
    danger,
    children,
}: {
    id?: string;
    icon: React.ReactNode;
    title: string;
    description?: string;
    danger?: boolean;
    children: React.ReactNode;
}) {
    return (
        <section
            id={id}
            className={`scroll-mt-24 rounded-xl border bg-white shadow-sm ${danger ? 'border-red-200' : 'border-gray-200'}`}
        >
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
        </section>
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
    const emailVerified = Boolean(user.email_verified_at);
    const canEditProfile = user.roles?.includes('System Admin') ?? false;

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

                {/* ── Identity Header ── */}
                <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:px-6">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-2xl font-semibold text-emerald-800">
                        {user.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold text-gray-900">{user.name}</p>
                        <p className="truncate text-sm text-gray-500">{user.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                <Shield className="h-3 w-3" />
                                {role}
                            </span>
                            {emailVerified ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                    <BadgeCheck className="h-3 w-3" />
                                    Email verified
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                    <MailWarning className="h-3 w-3" />
                                    Email not verified
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Section links (scrollable on mobile) ── */}
                <nav
                    aria-label="Profile sections"
                    className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
                >
                    <ul className="flex gap-2 whitespace-nowrap">
                        {SECTIONS.map(({ id, label, icon: Icon }) => (
                            <li key={id}>
                                <a
                                    href={`#${id}`}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* ── Two-column body ── */}
                <div className="grid gap-4 lg:grid-cols-2">

                    {/* Left column: forms */}
                    <div className="space-y-4">
                        <SectionCard
                            id="profile"
                            icon={<UserIcon className="h-4 w-4" />}
                            title="Profile Information"
                            description={
                                canEditProfile
                                    ? 'Update your name and email address.'
                                    : 'Your account details. Contact a System Admin to change them.'
                            }
                        >
                            <UpdateProfileInformationForm
                                mustVerifyEmail={mustVerifyEmail}
                                status={status}
                            />
                        </SectionCard>

                        <SectionCard
                            id="security"
                            icon={<KeyRound className="h-4 w-4" />}
                            title="Security"
                            description="Change your password and manage two-factor authentication."
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
                            id="activity"
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
                            id="sessions"
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