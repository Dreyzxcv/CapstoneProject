import { ShieldCheck } from 'lucide-react';

export default function TwoFactorAuthenticationForm({ className = '' }: { className?: string }) {
    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Add an extra layer of security to your account using an authenticator app.
                </p>
            </header>

            <div className="mt-6 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-gray-400" />
                    <div>
                        <p className="text-sm font-medium text-gray-700">Not yet enabled</p>
                        <p className="text-xs text-gray-500">This feature is coming soon.</p>
                    </div>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Coming Soon
                </span>
            </div>
        </section>
    );
}