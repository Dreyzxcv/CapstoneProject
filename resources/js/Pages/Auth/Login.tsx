import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { FormEventHandler, useState } from 'react';
import { useEffect } from 'react';
import { router } from '@inertiajs/react';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    useEffect(() => {
        const handlePageShow = (e: PageTransitionEvent) => {
            if (e.persisted) {
                router.reload();
            }
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });
    const [showPassword, setShowPassword] = useState(false);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Log in" />

            <div className="mb-7">
                <h1 className="text-[18px] font-medium tracking-tight text-gray-900">Welcome back</h1>
                <p className="mt-1 text-[13px] text-gray-500">Enter your credentials to continue.</p>
            </div>

            {status && (
                <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-[12.5px] font-medium text-gray-500">
                        Email address
                    </label>
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-[11px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-gray-400" />
                        <input
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            autoComplete="username"
                            autoFocus
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="you@penro-catanduanes.gov.ph"
                            className="h-[38px] w-full rounded-[var(--radius,6px)] border border-gray-200 bg-gray-50 pl-[34px] pr-3 text-[13.5px] text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#2a7a52] focus:bg-white focus:ring-[3px] focus:ring-[#2a7a52]/10"
                        />
                    </div>
                    <InputError message={errors.email} />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-[12.5px] font-medium text-gray-500">
                        Password
                    </label>
                    <div className="relative">
                        <Lock className="pointer-events-none absolute left-[11px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-gray-400" />
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            value={data.password}
                            autoComplete="current-password"
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="••••••••"
                            className="h-[38px] w-full rounded-[var(--radius,6px)] border border-gray-200 bg-gray-50 pl-[34px] pr-10 text-[13.5px] text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#2a7a52] focus:bg-white focus:ring-[3px] focus:ring-[#2a7a52]/10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="absolute right-[10px] top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                            tabIndex={-1}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="h-[15px] w-[15px]" /> : <Eye className="h-[15px] w-[15px]" />}
                        </button>
                    </div>
                    <InputError message={errors.password} />
                </div>

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer select-none items-center gap-2 text-[12.5px] text-gray-500">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            onChange={(e) => setData('remember', (e.target.checked || false) as false)}
                        />
                        Keep me signed in
                    </label>
                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="text-[12px] text-[#2a7a52] hover:underline"
                        >
                            Forgot password?
                        </Link>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="h-[38px] w-full rounded-[var(--radius,6px)] bg-[#1a5c38] text-[13.5px] font-medium tracking-tight text-white transition hover:bg-[#154d30] disabled:opacity-60"
                >
                    {processing ? 'Signing in…' : 'Sign in'}
                </button>
            </form>

            <p className="mt-5 text-center text-[11.5px] leading-relaxed text-gray-400">
                Access is restricted to authorized DENR-PENRO Catanduanes personnel.
            </p>
        </GuestLayout>
    );
}