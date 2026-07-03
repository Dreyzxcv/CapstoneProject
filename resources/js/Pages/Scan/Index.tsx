import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { QrScanner } from '@/Components/shared/QrScanner';
import { Head } from '@inertiajs/react';

export default function ScanIndex() {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-gray-800">QR Scanner</h2>}
        >
            <Head title="Scan QR" />

            <div className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8">
                <QrScanner />
                <p className="mt-4 text-center text-xs text-gray-500">
                    You'll be redirected to the asset record once a code is recognized.
                </p>
            </div>
        </AuthenticatedLayout>
    );
}
