import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
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
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Profile
                </h2>
            }
        >
            <Head title="Profile" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="max-w-xl"
                        />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                            <AccountActivity lastLoginAt={lastLoginAt} recentActivity={recentActivity} />
                        </div>

                        <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                            <ActiveSessionsForm sessions={sessions} />
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                            <TwoFactorAuthenticationForm />
                        </div>

                        <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                            <UpdatePasswordForm />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}