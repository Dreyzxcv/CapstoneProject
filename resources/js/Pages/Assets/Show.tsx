import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Asset, PageProps } from '@/types';
import { documentUrl } from '@/lib/utils';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState, useRef, useEffect } from 'react';
import { usePage } from '@inertiajs/react';

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
    const jevForm = useForm({ jev_number: '' });
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
                        <CardHeader><CardTitle className="text-base">Create JEV</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={submitJev} className="flex flex-wrap gap-3">
                                <div>
                                    <Label htmlFor="jev_number">JEV Number</Label>
                                    <Input
                                        id="jev_number"
                                        value={jevForm.data.jev_number}
                                        onChange={(e) => jevForm.setData('jev_number', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="flex items-end">
                                    <Button type="submit" disabled={jevForm.processing}>Issue JEV</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {asset.jev && !asset.jev.uploaded_at && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">JEV Awaiting Upload</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-gray-600">
                                Accounting issued JEV <span className="font-medium">{asset.jev.jev_number}</span>. MES must upload it
                                before the asset can move to disposal processing.
                            </p>
                            {can.uploadJev && (
                                <Button onClick={handleUploadJev}>Confirm JEV Upload</Button>
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
