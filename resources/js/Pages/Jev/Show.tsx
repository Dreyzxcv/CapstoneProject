import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { Asset, Jev, PageProps } from '@/types';
import { FormEventHandler, useRef, useState } from 'react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { Badge } from '@/Components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props extends PageProps {
    asset: Asset & {
        incident?: {
            incident_number: string;
        };
    };
    jev: Jev | null;
    can: {
        issue_jev: boolean;
        upload_jev: boolean;
        store_jev: boolean; // fill in form fields
    };
    appeal_window_open: boolean;
    appeal_deadline: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ jev }: { jev: Jev | null }) {
    if (!jev) {
        return <Badge variant="outline" className="text-gray-500">Not Yet Issued</Badge>;
    }
    if (jev.uploaded_at) {
        return <Badge className="bg-green-600 text-white">Uploaded</Badge>;
    }
    if (jev.issued_at) {
        return <Badge className="bg-blue-600 text-white">Issued</Badge>;
    }
    return <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending</Badge>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function JevShow({ asset, jev, can, appeal_window_open, appeal_deadline }: Props) {

    // ── Issue JEV form ────────────────────────────────────────────────────────
    const issueForm = useForm({ jev_number: '' });
    const handleIssue: FormEventHandler = (e) => {
        e.preventDefault();
        issueForm.post(route('assets.jev.store', asset.id), {
            preserveScroll: true,
        });
    };

    // ── Upload JEV form ───────────────────────────────────────────────────────
    const uploadForm = useForm<{ jev_file: File | null }>({ jev_file: null });
    const fileRef = useRef<HTMLInputElement>(null);

    const handleUpload: FormEventHandler = (e) => {
        e.preventDefault();
        uploadForm.post(route('assets.jev.upload', asset.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                uploadForm.reset();
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    };

    // ── JEV form fields (store) ───────────────────────────────────────────────
    const storeForm = useForm({
        jev_number: jev?.jev_number ?? '',
        jev_date: jev?.jev_date ?? '',
        particulars: jev?.particulars ?? '',
        amount: jev?.amount ?? '',
    });

    const handleStore: FormEventHandler = (e) => {
        e.preventDefault();
        storeForm.post(route('assets.jev.store', asset.id), {
            preserveScroll: true,
        });
    };

    // ─────────────────────────────────────────────────────────────────────────

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
                        Journal Entry Voucher
                    </h2>
                    <StatusBadge jev={jev} />
                </div>
            }
        >
            <Head title={`JEV — ${asset.asset_code}`} />

            <div className="py-8">
                <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">

                    {/* ── Asset context card ── */}
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

                    {/* ── Appeal window banner ── */}
                    {appeal_window_open && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                            <strong>Appeal window is open.</strong>{' '}
                            {appeal_deadline
                                ? `Deadline: ${appeal_deadline}`
                                : 'No deadline set.'}
                        </div>
                    )}

                    {/* ── Issue JEV ── */}
                    {!jev && can.issue_jev && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-3 text-base font-semibold text-gray-700">Issue JEV</h3>
                            <p className="mb-4 text-sm text-gray-500">
                                No JEV has been issued for this asset yet. Enter the JEV number to begin.
                            </p>
                            <form onSubmit={handleIssue} className="space-y-4">
                                <div>
                                    <InputLabel htmlFor="jev_number" value="JEV Number" />
                                    <input
                                        id="jev_number"
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        value={issueForm.data.jev_number}
                                        onChange={(e) => issueForm.setData('jev_number', e.target.value)}
                                        placeholder="e.g. JEV-2026-00001"
                                    />
                                    <InputError message={issueForm.errors.jev_number} className="mt-1" />
                                </div>
                                <PrimaryButton disabled={issueForm.processing || !issueForm.data.jev_number.trim()}>
                                    {issueForm.processing ? 'Issuing…' : 'Issue JEV'}
                                </PrimaryButton>
                            </form>
                        </div>
                    )}

                    {/* ── JEV form fields ── */}
                    {jev && can.store_jev && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 text-base font-semibold text-gray-700">JEV Details</h3>
                            <form onSubmit={handleStore} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <InputLabel htmlFor="jev_number" value="JEV Number" />
                                        <input
                                            id="jev_number"
                                            type="text"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                            value={storeForm.data.jev_number}
                                            onChange={(e) => storeForm.setData('jev_number', e.target.value)}
                                        />
                                        <InputError message={storeForm.errors.jev_number} className="mt-1" />
                                    </div>

                                    <div>
                                        <InputLabel htmlFor="jev_date" value="JEV Date" />
                                        <input
                                            id="jev_date"
                                            type="date"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                            value={storeForm.data.jev_date}
                                            onChange={(e) => storeForm.setData('jev_date', e.target.value)}
                                        />
                                        <InputError message={storeForm.errors.jev_date} className="mt-1" />
                                    </div>
                                </div>

                                <div>
                                    <InputLabel htmlFor="particulars" value="Particulars" />
                                    <textarea
                                        id="particulars"
                                        rows={3}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        value={storeForm.data.particulars}
                                        onChange={(e) => storeForm.setData('particulars', e.target.value)}
                                    />
                                    <InputError message={storeForm.errors.particulars} className="mt-1" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="amount" value="Amount (₱)" />
                                    <input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        value={storeForm.data.amount}
                                        onChange={(e) => storeForm.setData('amount', e.target.value)}
                                    />
                                    <InputError message={storeForm.errors.amount} className="mt-1" />
                                </div>

                                <div className="flex justify-end">
                                    <PrimaryButton disabled={storeForm.processing}>
                                        {storeForm.processing ? 'Saving…' : 'Save Details'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ── Read-only JEV details (when can't edit) ── */}
                    {jev && !can.store_jev && (
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
                                        {jev.amount ? `₱ ${Number(jev.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    )}

                    {/* ── Upload JEV ── */}
                    {jev && can.upload_jev && (
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-3 text-base font-semibold text-gray-700">Upload Signed JEV</h3>
                            {jev.uploaded_at ? (
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-green-700">
                                        ✓ Uploaded on {new Date(jev.uploaded_at).toLocaleDateString('en-PH')}
                                    </p>
                                    {jev.file_path && (
                                        <a
                                            href={`/storage/${jev.file_path}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm text-indigo-600 hover:underline"
                                        >
                                            View File
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <form onSubmit={handleUpload} className="space-y-3">
                                    <div>
                                        <InputLabel htmlFor="jev_file" value="JEV File (PDF)" />
                                        <input
                                            id="jev_file"
                                            type="file"
                                            accept="application/pdf"
                                            ref={fileRef}
                                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                                            onChange={(e) =>
                                                uploadForm.setData('jev_file', e.target.files?.[0] ?? null)
                                            }
                                        />
                                        <InputError message={uploadForm.errors.jev_file} className="mt-1" />
                                    </div>
                                    <div className="flex justify-end">
                                        <PrimaryButton disabled={uploadForm.processing || !uploadForm.data.jev_file}>
                                            {uploadForm.processing ? 'Uploading…' : 'Upload'}
                                        </PrimaryButton>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {/* ── Issued / timestamps ── */}
                    {jev && (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 px-5 py-4 text-xs text-gray-400">
                            <div className="flex gap-6">
                                {jev.issued_at && (
                                    <span>Issued: {new Date(jev.issued_at).toLocaleDateString('en-PH')}</span>
                                )}
                                {jev.issued_by_name && (
                                    <span>By: {jev.issued_by_name}</span>
                                )}
                                {jev.uploaded_at && (
                                    <span>Uploaded: {new Date(jev.uploaded_at).toLocaleDateString('en-PH')}</span>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}