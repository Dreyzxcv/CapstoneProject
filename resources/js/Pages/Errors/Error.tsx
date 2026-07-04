import ApplicationLogo from '@/Components/ApplicationLogo';
import { Button } from '@/Components/ui/button';
import { Head, Link, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';

const COPY: Record<number, { title: string; message: string }> = {
    404: {
        title: 'Page not found',
        message: "The page you're looking for doesn't exist, or has moved.",
    },
    403: {
        title: 'Access denied',
        message: "Your account doesn't have permission to view this page.",
    },
    500: {
        title: 'Something went wrong',
        message: 'An unexpected error occurred on our end. Please try again shortly.',
    },
    503: {
        title: 'Temporarily unavailable',
        message: 'The system is undergoing maintenance. Please check back soon.',
    },
};

export default function Error({ status }: { status: number }) {
    const { auth } = usePage<PageProps>().props;
    const copy = COPY[status] ?? COPY[500];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EC] px-6">
            <Head title={copy.title} />

            <svg className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]" viewBox="0 0 400 400" fill="none" aria-hidden="true">
                {[60, 120, 180, 240].map((r) => (
                    <circle key={r} cx="200" cy="200" r={r} stroke="#1F5C43" strokeWidth="1" />
                ))}
            </svg>

            <Link href="/" className="mb-8 flex items-center gap-3">
                <ApplicationLogo className="h-9 w-auto fill-current text-[#1F5C43]" />
                <span className="flex flex-col leading-tight">
                    <span className="font-serif text-base font-semibold text-[#123B2C]">LogTrack Insight</span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5B7A69]">
                        DENR-PENRO Catanduanes
                    </span>
                </span>
            </Link>

            <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-10 text-center shadow-[0_1px_2px_rgba(16,24,17,0.04),0_20px_40px_-16px_rgba(16,24,17,0.18)]">
                <p className="font-serif text-6xl font-semibold text-[#C9A24B]">{status}</p>
                <h1 className="mt-4 text-xl font-semibold text-[#14201B]">{copy.title}</h1>
                <p className="mt-2 text-sm text-gray-500">{copy.message}</p>

                <Button asChild className="mt-8 w-full">
                    <Link href={auth.user ? route('dashboard') : route('login')}>
                        {auth.user ? 'Return to dashboard' : 'Return to sign in'}
                    </Link>
                </Button>
            </div>
        </div>
    );
}