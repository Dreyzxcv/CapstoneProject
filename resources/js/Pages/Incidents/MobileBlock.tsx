import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Monitor } from 'lucide-react';

export default function MobileBlock() {
    return (
        <AuthenticatedLayout>
            <Head title="Desktop Required" />
            <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
                    <Monitor className="h-9 w-9 text-amber-500" />
                </div>

                <h1 className="text-xl font-semibold text-gray-900">
                    Open this on a desktop
                </h1>

                <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-500">
                    Incident encoding is desktop-only to prevent ghost touches and accidental data entry.
                </p>

                <div className="mt-8 flex flex-col items-center gap-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                        Go to this URL on your computer
                    </p>
                    <code className="rounded-md bg-gray-100 px-4 py-2 text-sm font-mono text-gray-700 select-all">
                        {window.location.href}
                    </code>
                </div>

                <Link href={route('assets.index')} className="mt-8">
                    <Button variant="outline" size="sm">Back to Assets</Button>
                </Link>
            </div>
        </AuthenticatedLayout>
    );
}