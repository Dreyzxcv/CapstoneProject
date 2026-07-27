import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';
import { Laptop, Smartphone } from 'lucide-react';

interface SessionEntry {
    id: string;
    ip_address: string | null;
    browser: string;
    platform: string;
    last_active: string;
    is_current_device: boolean;
}

// Brave (and other Chromium forks) send a Chrome-shaped User-Agent on
// purpose for site compatibility, so the server can never tell them apart
// from the request alone. The only reliable signal is this client-side
// API, which only exists in Brave itself — so it can only ever confirm
// the browser you're *currently* using, not other listed sessions.
function useIsBrave(): boolean | null {
    const [isBrave, setIsBrave] = useState<boolean | null>(null);

    useEffect(() => {
        const brave = (navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } }).brave;

        if (!brave?.isBrave) {
            setIsBrave(false);
            return;
        }

        brave.isBrave()
            .then((result) => setIsBrave(result))
            .catch(() => setIsBrave(false));
    }, []);

    return isBrave;
}

export default function ActiveSessionsForm({
    sessions,
    className = '',
}: {
    sessions: SessionEntry[];
    className?: string;
}) {
    const [confirmingLogout, setConfirmingLogout] = useState(false);
    const passwordInput = useRef<HTMLInputElement>(null);
    const isBrave = useIsBrave();

    const { data, setData, delete: destroy, processing, reset, errors, clearErrors } = useForm({
        password: '',
    });

    const confirmLogout = () => setConfirmingLogout(true);

    const logoutOtherSessions: FormEventHandler = (e) => {
        e.preventDefault();

        destroy(route('profile.sessions.destroy-others'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingLogout(false);
        clearErrors();
        reset();
    };

    const otherSessionsCount = sessions.filter((s) => !s.is_current_device).length;

    function displayBrowser(session: SessionEntry): string {
        if (session.is_current_device && isBrave && session.browser === 'Chrome') {
            return 'Brave';
        }
        return session.browser;
    }

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">Active Sessions</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Devices and browsers currently signed in to your account.
                </p>
            </header>

            <div className="mt-6 space-y-3">
                {sessions.map((session) => {
                    const Icon = session.platform === 'Android' || session.platform === 'iOS' ? Smartphone : Laptop;
                    return (
                        <div
                            key={session.id}
                            className="flex items-center gap-3 rounded-md border border-gray-200 px-4 py-3"
                        >
                            <Icon className="h-5 w-5 shrink-0 text-gray-400" />
                            <div>
                                <p className="text-sm font-medium text-gray-800">
                                    {displayBrowser(session)} on {session.platform}
                                    {session.is_current_device && (
                                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                            This device
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {session.ip_address ?? 'Unknown IP'} &middot; Last active{' '}
                                    {new Date(session.last_active).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {otherSessionsCount > 0 && (
                <div className="mt-6">
                    <PrimaryButton onClick={confirmLogout}>Log Out Other Browser Sessions</PrimaryButton>
                </div>
            )}

            <Modal show={confirmingLogout} onClose={closeModal}>
                <form onSubmit={logoutOtherSessions} className="p-6">
                    <h2 className="text-lg font-medium text-gray-900">Log Out Other Browser Sessions</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Enter your password to confirm you'd like to log out of your other browser sessions across
                        all devices.
                    </p>

                    <div className="mt-6">
                        <InputLabel htmlFor="logout_password" value="Password" className="sr-only" />
                        <TextInput
                            id="logout_password"
                            type="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            className="mt-1 block w-3/4"
                            isFocused
                            placeholder="Password"
                        />
                        <InputError message={errors.password} className="mt-2" />
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeModal}>Cancel</SecondaryButton>
                        <DangerButton className="ms-3" disabled={processing}>
                            Log Out Other Sessions
                        </DangerButton>
                    </div>
                </form>
            </Modal>
        </section>
    );
}