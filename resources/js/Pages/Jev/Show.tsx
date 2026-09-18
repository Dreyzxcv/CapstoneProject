import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Asset, Jev, PageProps } from '@/types';
import { FormEventHandler } from 'react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import { Badge } from '@/Components/ui/badge';

interface Props extends PageProps {
    asset: Asset & {
        incident?: {
            incident_number: string;
        };
    };
    jev: Jev | null;
    can: {
        issue_jev: boolean;
    };
}

function StatusBadge({ jev }: { jev: Jev | null }) {
    if (!jev) {
        return <Badge variant="outline" className="text-gray-500">Not Yet Issued</Badge>;
    }
    return <Badge className="bg-green-600 text-white">Issued</Badge>;
}

export default function JevShow({ asset, jev, can }: Props) {
    const form = useForm({
        jev_number:  '',
        jev_date:    '',
        particulars: '',
        amount:      '',
    });

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        form.post(route('assets.jev.store', asset.id), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-3">
                    <Link
                        href={route('assets.show', asset.id)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        ← {asset.asset_code}
                    </Link>
                    <span className="text-gray-400">/</span>
                    <h2 className="text-xl font-semibold text-gray-800">
                        Journal Entry Voucher (IN)
                    </h2>
                    <StatusBadge jev={jev} />
                </div>
            }
        >
            <Head title={`JEV — ${asset.asset_code}`} />

            <div className="py-8">
                <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">

                    {/* Asset context */}
                    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Asset</p>
                        <p className="mt-1 text-lg font-semibold text-gray-800">{asset.asset_code}</p>
                        {asset.aap_number && (
                            <p className="text-sm text-gray-500">AAP No. {asset.aap_number}</p>
                        )}
                        {asset.incident && (
                            <p className="text-sm text-gray-500">Incident: {asset.incident.incident_number}</p>
                        )}
                    </div>

                    {/* Issue form -- only shown if no JEV yet and user can issue */}
                    {!jev && can.issue_jev && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 text-base font-semibold text-gray-700">Issue JEV</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <InputLabel htmlFor="jev_number" value="JEV Number" />
                                        <input
                                            id="jev_number"
                                            type="text"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                            value={form.data.jev_number}
                                            onChange={(e) => form.setData('jev_number', e.target.value)}
                                            placeholder="e.g. JEV-2026-00001"
                                        />
                                        <InputError message={form.errors.jev_number} className="mt-1" />
                                    </div>

                                    <div>
                                        <InputLabel htmlFor="jev_date" value="JEV Date" />
                                        <input
                                            id="jev_date"
                                            type="date"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                            value={form.data.jev_date}
                                            onChange={(e) => form.setData('jev_date', e.target.value)}
                                        />
                                        <InputError message={form.errors.jev_date} className="mt-1" />
                                    </div>
                                </div>

                                <div>
                                    <InputLabel htmlFor="particulars" value="Particulars" />
                                    <textarea
                                        id="particulars"
                                        rows={3}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        value={form.data.particulars}
                                        onChange={(e) => form.setData('particulars', e.target.value)}
                                    />
                                    <InputError message={form.errors.particulars} className="mt-1" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="amount" value="Amount (₱)" />
                                    <input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        value={form.data.amount}
                                        onChange={(e) => form.setData('amount', e.target.value)}
                                    />
                                    <InputError message={form.errors.amount} className="mt-1" />
                                </div>

                                <div className="flex justify-end">
                                    <PrimaryButton disabled={form.processing || !form.data.jev_number.trim() || !form.data.jev_date.trim()}>
                                        {form.processing ? 'Issuing…' : 'Issue JEV'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Read-only view once issued */}
                    {jev && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 text-base font-semibold text-gray-700">JEV Details</h3>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div>
                                    <dt className="text-gray-400 font-medium">JEV Number</dt>
                                    <dd className="text-gray-800">{jev.jev_number ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-400 font-medium">JEV Date</dt>
                                    <dd className="text-gray-800">{jev.jev_date ?? '—'}</dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-gray-400 font-medium">Particulars</dt>
                                    <dd className="text-gray-800 whitespace-pre-wrap">{jev.particulars ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-400 font-medium">Amount</dt>
                                    <dd className="text-gray-800">
                                        {jev.amount
                                            ? `₱ ${Number(jev.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                            : '—'}
                                    </dd>
                                </div>
                            </dl>

                            {/* Timestamps */}
                            <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
                                Issued on {jev.created_at
                                    ? new Date(jev.created_at).toLocaleDateString('en-PH')
                                    : '—'}
                            </div>
                        </div>
                    )}

                    {/* No JEV + no permission */}
                    {!jev && !can.issue_jev && (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-5 text-sm text-gray-500">
                            No JEV has been issued for this asset yet.
                        </div>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}