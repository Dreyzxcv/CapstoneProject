import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { QrScanner } from '@/Components/shared/QrScanner';
import { Head, Link } from '@inertiajs/react';

export default function ScanIndex() {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-gray-800">QR Scanner</h2>}
        >
            <Head title="Scan QR" />

            <div className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8">
                <QrScanner />
                <div className="mt-4 space-y-1.5 text-center">
                    <p className="text-xs text-gray-500">
                        You'll be redirected to the asset record once a code is recognized.
                    </p>
                    <Link
                        href={route('assets.index')}
                        className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                        Can't scan? Browse all assets
                    </Link>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}