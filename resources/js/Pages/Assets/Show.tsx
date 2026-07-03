import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import InputError from '@/Components/InputError';
import { Asset, PageProps } from '@/types';
import { documentUrl } from '@/lib/utils';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState, useRef, useEffect } from 'react';

interface ShowProps {
    asset: Asset;
    qrPayload: string | null;
    qrSvg: string | null;
    can: {
        signReceipt: boolean;
        markStored: boolean;
        generateQr: boolean;
        uploadJev: boolean;
        releaseDonation: boolean;
        processDisposal: boolean;
    };
}

export default function AssetsShow({ asset, qrPayload, qrSvg, can }: ShowProps) {
    const { auth } = usePage<PageProps>().props;
    const [confirmAction, setConfirmAction] = useState<string | null>(null);
    const qrContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!qrContainerRef.current) return;
        const svg = qrContainerRef.current.querySelector('svg');
        if (svg instanceof SVGElement) {
            // ensure SVG has visible dimensions when injected via innerHTML
            if (!svg.getAttribute('width')) svg.setAttribute('width', '160');
            if (!svg.getAttribute('height')) svg.setAttribute('height', '160');
            // some user-agents may treat injected SVG as inline; make it block for predictable layout
            svg.style.display = 'block';
        }
    }, [qrSvg]);
    
    const jevForm = useForm({
        jev_number: '',
        funding_source_code: '01101101',
        funding_source_label:
            'Regular Agency Fund - General Fund - New General Appropriations - Specific Budgets of National Government Agencies',
        transaction_type: 'Other Adjustments',
        transaction_code: '',
        responsibility_center: '10-001-05-00036',
        document_no: '',
        particulars: '',
        prepared_by_name: '',
        approved_by_name: '',
        line_items: [
            { account_title: 'Confiscated Property/Assets', account_code: '19999040', sub_object_code: '00', debit: '', credit: '' },
            { account_title: 'Accumulated Surplus/(Deficit)', account_code: '30101010', sub_object_code: '00', debit: '', credit: '' },
        ],
    });

    function updateLineItem(index: number, field: 'debit' | 'credit', value: string) {
        const items = [...jevForm.data.line_items];
        items[index] = { ...items[index], [field]: value };
        jevForm.setData('line_items', items);
    }

    const jevTotals = jevForm.data.line_items.reduce(
        (acc, line) => ({
            debit: acc.debit + (parseFloat(line.debit) || 0),
            credit: acc.credit + (parseFloat(line.credit) || 0),
        }),
        { debit: 0, credit: 0 },
    );

    const currentRole = auth.user?.roles?.[0] ?? 'User';

    function handleSignReceipt() {
        if (confirm('Sign acknowledgement receipt for this asset?')) {
            router.post(route('assets.sign-receipt', asset.id));
        }
    }

    function handleMarkStored() {
        if (confirm('Confirm asset is tagged and placed in storage?')) {
            router.post(route('assets.mark-stored', asset.id));
        }
    }

    function handleUploadJev() {
        if (confirm('Confirm the JEV has been uploaded? This will move the asset to disposal processing.')) {
            router.post(route('assets.jev.upload', asset.id));
        }
    }

    function handleReleaseDonation() {
        if (asset.disposal && confirm('Mark this donation as released to the requester?')) {
            router.post(route('disposals.release-donation', asset.disposal.id));
        }
    }

    function submitJev(e: FormEvent) {
        e.preventDefault();
        jevForm.post(route('assets.jev.store', asset.id), {
            onSuccess: () => jevForm.reset(),
        });
    }

    const receiptUrl = documentUrl(asset.acknowledgement_receipt?.pdf_path);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">Asset Detail</h2>
                        <p className="text-sm text-gray-500">{asset.asset_code}</p>
                    </div>
                    <AssetStatusBadge
                        status={asset.current_status}
                        label={asset.current_status.replace(/_/g, ' ')}
                    />
                </div>
            }
        >
            <Head title={`Asset ${asset.asset_code.slice(0, 8)}`} />

            <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Workflow Guidance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p className="text-sm font-medium text-emerald-700">{currentRole}</p>
                        <p className="text-sm text-gray-600">
                            The asset follows the documented MES → Property → Accounting → Disposal flow.
                        </p>
                        <p className="text-sm text-gray-700">
                            Current stage: <span className="font-semibold">{asset.current_status.replace(/_/g, ' ')}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                            Next step: {asset.current_status === 'for_disposal' ? 'Process the disposal action for this asset.' : 'Complete the next handoff in the workflow.'}
                        </p>
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
                        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                            <p><span className="font-medium">Type:</span> {asset.type}</p>
                            <p><span className="font-medium">Mode:</span> {asset.mode}</p>
                            <p><span className="font-medium">Species:</span> {asset.species ?? '—'}</p>
                            <p><span className="font-medium">Municipality:</span> {asset.municipality_of_origin}</p>
                            <p className="md:col-span-2"><span className="font-medium">Description:</span> {asset.description ?? '—'}</p>
                            <p><span className="font-medium">Location:</span> {asset.location_apprehended}</p>
                            <p><span className="font-medium">Agency:</span> {asset.apprehending_agency}</p>
                            <p><span className="font-medium">Ongoing case:</span> {asset.has_ongoing_case ? 'Yes' : 'No'}</p>
                            <p><span className="font-medium">Confiscation order:</span> {asset.has_confiscation_order ? 'Yes' : 'No'}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {can.signReceipt && (
                                <Button className="w-full" onClick={handleSignReceipt}>
                                    Sign Acknowledgement Receipt
                                </Button>
                            )}
                            {can.markStored && (
                                <Button className="w-full" variant="secondary" onClick={handleMarkStored}>
                                    Mark as Stored
                                </Button>
                            )}
                            {can.processDisposal && asset.current_status === 'for_disposal' && (
                                <Link href={route('disposals.create', asset.id)}>
                                    <Button className="w-full" variant="outline">Process Disposal</Button>
                                </Link>
                            )}
                            {!can.signReceipt && !can.markStored && !(can.processDisposal && asset.current_status === 'for_disposal') && !receiptUrl && (
                                <p className="text-sm text-gray-500">No actions available for your role at this stage.</p>
                            )}
                            {receiptUrl && (
                                <a href={receiptUrl} className="block text-center text-sm text-emerald-700 hover:underline">
                                    Download Acknowledgement Receipt
                                </a>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {qrSvg && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">QR Code Label</CardTitle></CardHeader>
                        <CardContent className="flex flex-col items-center gap-4">
                            <div ref={qrContainerRef} dangerouslySetInnerHTML={{ __html: qrSvg }} />
                            <p className="max-w-md break-all text-center text-xs text-gray-500">{qrPayload}</p>
                            <Button variant="outline" onClick={() => window.print()}>Print Label</Button>
                        </CardContent>
                    </Card>
                )}

                {asset.current_status === 'cleared_for_accounting' && !asset.jev && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Create JEV</CardTitle>
                            <p className="text-sm text-gray-500">
                                Fill out the Journal Entry Voucher matching the official DENR-PENRO form.
                            </p>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitJev} className="space-y-6">
                                {/* Header fields */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="jev_number">JEV Number</Label>
                                        <Input
                                            id="jev_number"
                                            placeholder="2026-05-000928"
                                            value={jevForm.data.jev_number}
                                            onChange={(e) => jevForm.setData('jev_number', e.target.value)}
                                            required
                                        />
                                        <InputError message={jevForm.errors.jev_number} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="document_no">Document No.</Label>
                                        <Input
                                            id="document_no"
                                            value={jevForm.data.document_no}
                                            onChange={(e) => jevForm.setData('document_no', e.target.value)}
                                        />
                                        <InputError message={jevForm.errors.document_no} />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-[140px_1fr]">
                                    <div className="space-y-2">
                                        <Label htmlFor="funding_source_code">Funding Source Code</Label>
                                        <Input
                                            id="funding_source_code"
                                            value={jevForm.data.funding_source_code}
                                            onChange={(e) => jevForm.setData('funding_source_code', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="funding_source_label">Funding Source</Label>
                                        <Input
                                            id="funding_source_label"
                                            value={jevForm.data.funding_source_label}
                                            onChange={(e) => jevForm.setData('funding_source_label', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="transaction_type">Transaction Type</Label>
                                        <Input
                                            id="transaction_type"
                                            value={jevForm.data.transaction_type}
                                            onChange={(e) => jevForm.setData('transaction_type', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="transaction_code">Transaction Code</Label>
                                        <Input
                                            id="transaction_code"
                                            placeholder="OADJ071"
                                            value={jevForm.data.transaction_code}
                                            onChange={(e) => jevForm.setData('transaction_code', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="responsibility_center">Responsibility Center</Label>
                                        <Input
                                            id="responsibility_center"
                                            value={jevForm.data.responsibility_center}
                                            onChange={(e) => jevForm.setData('responsibility_center', e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Account entries table */}
                                <div>
                                    <Label>Account Entries</Label>
                                    <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
                                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Account Title</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Account Code</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Sub-Object</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Debit</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Credit</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {jevForm.data.line_items.map((line, index) => (
                                                    <tr key={index}>
                                                        <td className="px-3 py-2">{line.account_title}</td>
                                                        <td className="px-3 py-2 text-gray-500">{line.account_code}</td>
                                                        <td className="px-3 py-2 text-gray-500">{line.sub_object_code}</td>
                                                        <td className="px-3 py-2">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                className="text-right"
                                                                value={line.debit}
                                                                onChange={(e) => updateLineItem(index, 'debit', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                className="text-right"
                                                                value={line.credit}
                                                                onChange={(e) => updateLineItem(index, 'credit', e.target.value)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-gray-50 font-semibold">
                                                    <td colSpan={3} className="px-3 py-2 text-right">TOTAL</td>
                                                    <td className="px-3 py-2 text-right">{jevTotals.debit.toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-right">{jevTotals.credit.toFixed(2)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    {jevTotals.debit !== jevTotals.credit && (
                                        <p className="mt-1 text-xs text-amber-600">
                                            Debit and credit totals do not match — double-check the entries before submitting.
                                        </p>
                                    )}
                                </div>

                                {/* Particulars */}
                                <div className="space-y-2">
                                    <Label htmlFor="particulars">Particulars</Label>
                                    <textarea
                                        id="particulars"
                                        rows={3}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        placeholder="Recording of forest products and conveyances with confiscation and forfeiture orders..."
                                        value={jevForm.data.particulars}
                                        onChange={(e) => jevForm.setData('particulars', e.target.value)}
                                    />
                                    <InputError message={jevForm.errors.particulars} />
                                </div>

                                {/* Signatories */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="prepared_by_name">Prepared By</Label>
                                        <Input
                                            id="prepared_by_name"
                                            placeholder="Accounting Officer name"
                                            value={jevForm.data.prepared_by_name}
                                            onChange={(e) => jevForm.setData('prepared_by_name', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="approved_by_name">Approved By</Label>
                                        <Input
                                            id="approved_by_name"
                                            placeholder="MES Officer name"
                                            value={jevForm.data.approved_by_name}
                                            onChange={(e) => jevForm.setData('approved_by_name', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end border-t border-gray-100 pt-4">
                                    <Button type="submit" disabled={jevForm.processing}>
                                        Issue JEV
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {asset.jev && !asset.jev.uploaded_at && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">JEV Awaiting Upload</CardTitle>
                            <p className="text-sm text-gray-500">
                                Accounting issued this JEV. Review the details below, then confirm the upload to
                                move the asset to disposal processing.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm md:grid-cols-2">
                                <p><span className="font-medium">JEV Number:</span> {asset.jev.jev_number}</p>
                                <p><span className="font-medium">Document No:</span> {asset.jev.document_no ?? '—'}</p>
                                <p className="md:col-span-2">
                                    <span className="font-medium">Funding Source:</span>{' '}
                                    {asset.jev.funding_source_code ? `(${asset.jev.funding_source_code}) ` : ''}
                                    {asset.jev.funding_source_label ?? '—'}
                                </p>
                                <p>
                                    <span className="font-medium">Transaction Type:</span>{' '}
                                    {asset.jev.transaction_type ?? '—'}
                                    {asset.jev.transaction_code ? ` - ${asset.jev.transaction_code}` : ''}
                                </p>
                                <p><span className="font-medium">Responsibility Center:</span> {asset.jev.responsibility_center ?? '—'}</p>
                            </div>

                            {asset.jev.line_items && asset.jev.line_items.length > 0 && (
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Account Title</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Account Code</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Sub-Object</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Debit</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Credit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {asset.jev.line_items.map((line, index) => (
                                                <tr key={index}>
                                                    <td className="px-3 py-2">{line.account_title}</td>
                                                    <td className="px-3 py-2 text-gray-500">{line.account_code}</td>
                                                    <td className="px-3 py-2 text-gray-500">{line.sub_object_code}</td>
                                                    <td className="px-3 py-2 text-right">
                                                        {line.debit ? Number(line.debit).toFixed(2) : '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {line.credit ? Number(line.credit).toFixed(2) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-50 font-semibold">
                                                <td colSpan={3} className="px-3 py-2 text-right">TOTAL</td>
                                                <td className="px-3 py-2 text-right">
                                                    {asset.jev.line_items
                                                        .reduce((sum, l) => sum + (Number(l.debit) || 0), 0)
                                                        .toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {asset.jev.line_items
                                                        .reduce((sum, l) => sum + (Number(l.credit) || 0), 0)
                                                        .toFixed(2)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {asset.jev.particulars && (
                                <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                                    <p className="font-medium text-gray-700">Particulars</p>
                                    <p className="mt-1 text-gray-600">{asset.jev.particulars}</p>
                                </div>
                            )}

                            <div className="grid gap-3 text-sm md:grid-cols-2">
                                <p><span className="font-medium">Prepared By:</span> {asset.jev.prepared_by_name ?? '—'}</p>
                                <p><span className="font-medium">Approved By:</span> {asset.jev.approved_by_name ?? '—'}</p>
                            </div>

                            {can.uploadJev && (
                                <div className="border-t border-gray-100 pt-4">
                                    <Button onClick={handleUploadJev}>Confirm JEV Upload</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {asset.type === 'vehicle' && asset.appeal_deadline && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">Appeal Window</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600">
                                Owner has until{' '}
                                <span className="font-medium">{new Date(asset.appeal_deadline).toLocaleDateString()}</span>
                                {' '}(15 days from JEV upload) to appeal to the court before release or forfeiture is decided.
                            </p>
                            <p className="mt-1 text-sm">
                                {new Date(asset.appeal_deadline) > new Date()
                                    ? 'Appeal window is still open.'
                                    : 'Appeal window has closed.'}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {asset.disposal?.donation && !asset.disposal.donation.released_at && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">Donation Release</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-gray-600">
                                Deed of Donation is on file for <span className="font-medium">{asset.disposal.donation.requester_name}</span>.
                                Mark as released once the item has been handed over.
                            </p>
                            {can.releaseDonation && (
                                <Button onClick={handleReleaseDonation}>Mark Donation Released</Button>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader><CardTitle className="text-base">Status History</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {(asset.status_history ?? []).map((entry) => (
                                <div key={entry.id} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                                    <div>
                                        <AssetStatusBadge status={entry.status} label={entry.status.replace(/_/g, ' ')} />
                                        <p className="mt-1 text-gray-600">{entry.notes}</p>
                                    </div>
                                    <div className="text-right text-gray-500">
                                        <p>{entry.changed_by?.name}</p>
                                        <p>{new Date(entry.changed_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
