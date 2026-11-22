import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { FormEventHandler, useMemo, useState } from 'react';

// Mirrors Password::min(10)->letters()->mixedCase()->numbers()->symbols().
const RULES: { label: string; test: (p: string) => boolean }[] = [
    { label: 'At least 10 characters', test: (p) => p.length >= 10 },
    { label: 'Uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'Lowercase letter', test: (p) => /[a-z]/.test(p) },
    { label: 'Number', test: (p) => /\d/.test(p) },
    { label: 'Symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH = [
    { text: 'Too weak', bar: 'bg-red-500' },
    { text: 'Weak', bar: 'bg-red-500' },
    { text: 'Fair', bar: 'bg-amber-500' },
    { text: 'Good', bar: 'bg-emerald-500' },
    { text: 'Strong', bar: 'bg-emerald-600' },
    { text: 'Very strong', bar: 'bg-emerald-700' },
];

export default function ResetPassword({ token, email }: { token: string; email: string }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });
    const [show, setShow] = useState(false);

    const passed = useMemo(() => RULES.filter((r) => r.test(data.password)).length, [data.password]);
    const mismatch = data.password_confirmation !== '' && data.password !== data.password_confirmation;

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    const toggle = (
        <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide passwords' : 'Show passwords'}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
            {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
    );

    return (
        <GuestLayout>
            <Head title="Reset Password" />

            <form onSubmit={submit}>
                <div>
                    <InputLabel htmlFor="email" value="Email" />
                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full bg-gray-50"
                        autoComplete="username"
                        readOnly
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="password" value="New Password" />
                    <div className="relative">
                        <TextInput
                            id="password"
                            type={show ? 'text' : 'password'}
                            name="password"
                            value={data.password}
                            className="mt-1 block w-full pr-10"
                            autoComplete="new-password"
                            isFocused={true}
                            aria-describedby="password_rules"
                            onChange={(e) => setData('password', e.target.value)}
                        />
                        {toggle}
                    </div>

                    <div id="password_rules" aria-live="polite" className="mt-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                                className={'h-full transition-all ' + STRENGTH[passed].bar}
                                style={{ width: `${(passed / RULES.length) * 100}%` }}
                            />
                        </div>
                        {data.password && (
                            <p className="mt-1 text-xs text-gray-600">Strength: {STRENGTH[passed].text}</p>
                        )}
                        <ul className="mt-1 grid gap-x-4 text-xs sm:grid-cols-2">
                            {RULES.map((r) => (
                                <li key={r.label} className={r.test(data.password) ? 'text-emerald-700' : 'text-gray-500'}>
                                    {r.test(data.password) ? '✓' : '•'} {r.label}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="password_confirmation" value="Confirm Password" />
                    <div className="relative">
                        <TextInput
                            id="password_confirmation"
                            type={show ? 'text' : 'password'}
                            name="password_confirmation"
                            value={data.password_confirmation}
                            className="mt-1 block w-full pr-10"
                            autoComplete="new-password"
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                        />
                    </div>
                    {mismatch && !errors.password_confirmation && (
                        <p className="mt-2 text-sm text-red-600">Passwords do not match.</p>
                    )}
                    <InputError message={errors.password_confirmation} className="mt-2" />
                </div>

                <div className="mt-6 flex items-center justify-end">
                    <PrimaryButton disabled={processing || passed < RULES.length || mismatch || !data.password_confirmation}>
                        {processing ? 'Resetting…' : 'Reset Password'}
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}