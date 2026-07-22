import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { Asset, PageProps } from '@/types';
import { documentUrl } from '@/lib/utils';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState, useRef, useEffect } from 'react';
import { FileText, MapPin } from 'lucide-react';
import { IncidentLocationMap } from '@/Components/shared/IncidentLocationMap';
import { EvidenceUploader } from '@/Components/shared/EvidenceUploader';
import { PdfBadge } from '@/Components/shared/PdfBadge';

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
        resolveCase: boolean;
        updateCaseDetails: boolean;
        uploadEvidence: boolean;
    };
}

export default function AssetsShow({ asset, qrPayload, qrSvg, can }: ShowProps) {
    const { auth } = usePage<PageProps>().props;
    const [confirmAction, setConfirmAction] = useState<string | null>(null);
    const [showJevModal, setShowJevModal] = useState(false);
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
    });

    const caseForm = useForm({
        case_number: asset.case_number ?? '',
        court_branch: asset.court_branch ?? '',
        next_hearing_date: asset.next_hearing_date ? asset.next_hearing_date.slice(0, 10) : '',
    });

    function submitCaseDetails(e: FormEvent) {
        e.preventDefault();
        caseForm.post(route('assets.case-details.update', asset.id), { preserveScroll: true });
    }

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

    function handleResolveTrial() {
        if (confirm('Confirm the case has been resolved and this asset can proceed to accounting?')) {
            router.post(route('assets.resolve-trial', asset.id));
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
            onSuccess: () => {
                jevForm.reset();
                setShowJevModal(false);
            },
        });
    }

    const releaseForm = useForm<{ photo: File | null }>({ photo: null });

    function submitRelease(e: FormEvent) {
        e.preventDefault();
        if (!asset.disposal) return;
        if (!confirm('Mark this donation as released to the requester?')) return;
        releaseForm.post(route('disposals.release-donation', asset.disposal.id), {
            forceFormData: true,
            preserveScroll: true,
        });
    }

    function closeJevModal() {
        setShowJevModal(false);
        jevForm.clearErrors();
        jevForm.reset();
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

            <div className="mx-auto max-w-7xl space-y-6 overflow-x-hidden px-4 sm:px-6 lg:px-8">
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
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">Overview</CardTitle>
                            {asset.incident && (
                                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                                    {asset.incident.incident_code}
                                </span>
                            )}
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm md:grid-cols-2 break-words">
                            <p><span className="font-medium">Types:</span> {asset.type}</p>
                            <p><span className="font-medium">Mode:</span> {asset.mode}</p>
                            <p><span className="font-medium">Species:</span> {asset.species ?? '—'}</p>
                            <p><span className="font-medium">Municipality:</span> {asset.municipality_of_origin}</p>
                            <p className="md:col-span-2"><span className="font-medium">Description:</span> {asset.description ?? '—'}</p>
                            <p><span className="font-medium">Location:</span> {asset.location_apprehended}</p>
                            <p><span className="font-medium">Agency:</span> {asset.apprehending_agency}</p>
                            <p><span className="font-medium">Ongoing case:</span> {asset.has_ongoing_case ? 'Yes' : 'No'}</p>
                            <p><span className="font-medium">Confiscation order:</span> {asset.has_confiscation_order ? 'Yes' : 'No'}</p>

                            {asset.incident && (
                                <>
                                    <div className="md:col-span-2 mt-1 border-t border-gray-100 pt-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            From Incident Report
                                        </p>
                                    </div>
                                    <p>
                                        <span className="font-medium">Date of Apprehension:</span>{' '}
                                        {new Date(asset.incident.date_of_apprehension).toLocaleDateString()}
                                    </p>
                                    <p>
                                        <span className="font-medium">Place of Apprehension:</span>{' '}
                                        {asset.incident.place_of_apprehension}
                                    </p>
                                    {asset.incident.area && (
                                        <p><span className="font-medium">Area:</span> {asset.incident.area}</p>
                                    )}
                                    {asset.incident.coordinates && (
                                        <p className="flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                            <span className="font-medium">Coordinates:</span> {asset.incident.coordinates}
                                        </p>
                                    )}
                                    <p>
                                        <span className="font-medium">
                                            {asset.incident.is_abandoned ? 'Status:' : 'Claimant / Offender:'}
                                        </span>{' '}
                                        {asset.incident.is_abandoned
                                            ? 'Abandoned (no known claimant)'
                                            : asset.incident.claimant_offender_name ?? '—'}
                                    </p>
                                    <p>
                                        <span className="font-medium">Apprehending Party:</span>{' '}
                                        {asset.incident.apprehending_party}
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Sidebar stack — single grid child so internal order is stable
                        and never reshuffled by grid auto-flow, regardless of which
                        conditional cards render */}
                    <div className="space-y-6">
                        {asset.incident?.coordinates && (
                            <Card>
                                <CardHeader><CardTitle className="text-base">Apprehension Location</CardTitle></CardHeader>
                                <CardContent>
                                    <IncidentLocationMap
                                        coordinates={asset.incident.coordinates}
                                        placeName={asset.incident.place_of_apprehension}
                                        areaName={asset.incident.area}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader><CardTitle className="text-base">Evidence & Documents</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {can.uploadEvidence && <EvidenceUploader assetId={asset.id} />}
                                {(asset.documents ?? []).length === 0 ? (
                                    <p className="text-sm text-gray-500">No supporting documents uploaded yet.</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3">
                                        {(asset.documents ?? []).map((doc) => {
                                            const url = documentUrl(doc.file_path);
                                            const isImage = doc.mime_type?.startsWith('image/');
                                            return (
                                                <a
                                                    key={doc.id}
                                                    href={url ?? '#'}
                                                    title={doc.original_name}
                                                    className="group block overflow-hidden rounded-md border border-gray-200"
                                                >
                                                    {isImage ? (
                                                        <img src={url ?? ''} className="h-24 w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-24 w-full flex-col items-center justify-center gap-1 overflow-hidden bg-gray-50 px-1 text-center">
                                                            <PdfBadge className="h-7 w-7 shrink-0" />
                                                            <p className="w-full truncate px-1 text-[10px] text-gray-500">
                                                                {doc.original_name}
                                                            </p>
                                                        </div>
                                                    )}
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
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
                                {can.resolveCase && (
                                    <Button className="w-full" variant="secondary" onClick={handleResolveTrial}>
                                        Resolve Case — Clear for Accounting
                                    </Button>
                                )}
                                {can.processDisposal && asset.current_status === 'for_disposal' && (
                                    <Link href={route('disposals.create', asset.id)}>
                                        <Button className="w-full" variant="outline">Process Disposal</Button>
                                    </Link>
                                )}
                                {!can.signReceipt && !can.markStored && !can.resolveCase && !(can.processDisposal && asset.current_status === 'for_disposal') && !receiptUrl && (
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
                </div>

                {qrSvg && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">QR Code Label</CardTitle></CardHeader>
                        <CardContent className="flex flex-col items-center gap-4">
                            <style>{`
                                @media print {
                                    body * { visibility: hidden; }
                                    #qr-print-area, #qr-print-area * { visibility: visible; }
                                    #qr-print-area {
                                        position: absolute;
                                        top: 0;
                                        left: 0;
                                        width: 100%;
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                        gap: 8px;
                                    }
                                }
                            `}</style>
                            <div id="qr-print-area" className="flex flex-col items-center gap-2">
                                <div ref={qrContainerRef} dangerouslySetInnerHTML={{ __html: qrSvg }} />
                                <p className="text-sm font-medium text-gray-700">{asset.asset_code}</p>
                            </div>
                            <Button variant="outline" onClick={() => window.print()}>Print Label</Button>
                        </CardContent>
                    </Card>
                )}

                {asset.current_status === 'cleared_for_accounting' && !asset.jev && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Create JEV</CardTitle>
                            <p className="text-sm text-gray-500">
                                This asset is cleared for accounting and needs a Journal Entry Voucher before
                                it can move to disposal processing.
                            </p>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => setShowJevModal(true)}>Fill Out JEV Form</Button>
                        </CardContent>
                    </Card>
                )}
                <Modal show={showJevModal} onClose={closeJevModal} maxWidth="md">
                    <form onSubmit={submitJev} className="p-6">
                        <h2 className="text-lg font-medium text-gray-900">Journal Entry Voucher</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Enter the JEV number issued by Accounting for{' '}
                            <span className="font-medium">{asset.asset_code}</span>.
                        </p>

                        <div className="mt-6 space-y-2">
                            <Label htmlFor="jev_number">JEV Number</Label>
                            <Input
                                id="jev_number"
                                placeholder="2026-05-000928"
                                value={jevForm.data.jev_number}
                                onChange={(e) => jevForm.setData('jev_number', e.target.value)}
                                required
                                autoFocus
                            />
                            <InputError message={jevForm.errors.jev_number} />
                        </div>

                        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                            <Button type="button" variant="outline" onClick={closeJevModal}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={jevForm.processing}>
                                Issue JEV
                            </Button>
                        </div>
                    </form>
                </Modal>

                {asset.jev && !asset.jev.uploaded_at && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">JEV Awaiting Upload</CardTitle>
                            <p className="text-sm text-gray-500">
                                Accounting issued this JEV. Confirm the upload to move the asset to disposal processing.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm">
                                <span className="font-medium">JEV Number:</span> {asset.jev.jev_number}
                            </p>

                            {can.uploadJev && (
                                <div className="border-t border-gray-100 pt-4">
                                    <Button onClick={handleUploadJev}>Confirm JEV Upload</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {asset.jev && asset.jev.uploaded_at && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">Journal Entry Voucher</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <p className="text-sm text-gray-600">
                                JEV <span className="font-medium">{asset.jev.jev_number}</span> uploaded by MES.
                            </p>
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
                        <CardContent className="space-y-3 break-words">
                            <p className="text-sm text-gray-600">
                                Deed of Donation is on file for <span className="font-medium">{asset.disposal.donation.requester_name}</span>.
                                Mark as released once the item has been handed over.
                            </p>
                            {(asset.disposal.details as { delivery_coordinates?: string })?.delivery_coordinates && (
                                <IncidentLocationMap
                                    coordinates={(asset.disposal.details as { delivery_coordinates?: string }).delivery_coordinates}
                                    placeName={asset.disposal.donation.requester_name}
                                    areaName="Delivery location"
                                />
                            )}
                            {can.releaseDonation && (
                                <form onSubmit={submitRelease} className="space-y-3">
                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
                                        {releaseForm.data.photo ? releaseForm.data.photo.name : 'Attach release photo (opens camera on mobile)'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => releaseForm.setData('photo', e.target.files?.[0] ?? null)}
                                        />
                                    </label>
                                    <Button type="submit" disabled={releaseForm.processing}>Mark Donation Released</Button>
                                </form>
                            )}
                        </CardContent>
                    </Card>
                )}

                {asset.disposal?.donation?.released_at && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">Donation Released</CardTitle></CardHeader>
                        <CardContent className="space-y-3 break-words">
                            <p className="text-sm text-gray-600">
                                Released to <span className="font-medium">{asset.disposal.donation.requester_name}</span>
                                {asset.disposal.donation.agency_name ? ` (${asset.disposal.donation.agency_name})` : ''}
                                {' '}on {new Date(asset.disposal.donation.released_at).toLocaleString()}.
                            </p>

                            {asset.disposal.donation.release_photo_path && (
                                <a
                                    href={documentUrl(asset.disposal.donation.release_photo_path) ?? '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-fit"
                                >
                                    <img
                                        src={documentUrl(asset.disposal.donation.release_photo_path) ?? ''}
                                        alt="Release confirmation"
                                        className="h-40 w-40 rounded-lg border border-gray-200 object-cover"
                                    />
                                </a>
                            )}

                            {documentUrl(asset.disposal.donation.deed_of_donation_path) && (
                                <a
                                    href={documentUrl(asset.disposal.donation.deed_of_donation_path) ?? '#'}
                                    className="block text-sm text-emerald-700 hover:underline"
                                >
                                    Download Deed of Donation
                                </a>
                            )}
                        </CardContent>
                    </Card>
                )}

                {asset.has_ongoing_case && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">Case Details</CardTitle></CardHeader>
                        <CardContent>
                            {can.updateCaseDetails ? (
                                <form onSubmit={submitCaseDetails} className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="case_number">Case Number</Label>
                                        <Input
                                            id="case_number"
                                            value={caseForm.data.case_number}
                                            onChange={(e) => caseForm.setData('case_number', e.target.value)}
                                        />
                                        <InputError message={caseForm.errors.case_number} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="court_branch">Court / Branch</Label>
                                        <Input
                                            id="court_branch"
                                            value={caseForm.data.court_branch}
                                            onChange={(e) => caseForm.setData('court_branch', e.target.value)}
                                        />
                                        <InputError message={caseForm.errors.court_branch} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="next_hearing_date">Next Hearing Date</Label>
                                        <Input
                                            id="next_hearing_date"
                                            type="date"
                                            value={caseForm.data.next_hearing_date}
                                            onChange={(e) => caseForm.setData('next_hearing_date', e.target.value)}
                                        />
                                        <InputError message={caseForm.errors.next_hearing_date} />
                                    </div>
                                    <div className="md:col-span-3">
                                        <Button type="submit" size="sm" disabled={caseForm.processing}>Save Case Details</Button>
                                    </div>
                                </form>
                            ) : (
                                <dl className="grid gap-3 text-sm md:grid-cols-3 break-words">
                                    <div><dt className="text-gray-500">Case Number</dt><dd>{asset.case_number ?? '—'}</dd></div>
                                    <div><dt className="text-gray-500">Court / Branch</dt><dd>{asset.court_branch ?? '—'}</dd></div>
                                    <div><dt className="text-gray-500">Next Hearing</dt><dd>{asset.next_hearing_date ? new Date(asset.next_hearing_date).toLocaleDateString() : '—'}</dd></div>
                                </dl>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader><CardTitle className="text-base">Status History</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {(asset.status_history ?? []).map((entry) => (
                                <div key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-gray-100 pb-2 text-sm">
                                    <div className="min-w-0 flex-1 break-words">
                                        <AssetStatusBadge status={entry.status} label={entry.status.replace(/_/g, ' ')} />
                                        <p className="mt-1 text-gray-600">{entry.notes}</p>
                                    </div>
                                    <div className="min-w-0 shrink-0 break-words text-right text-gray-500">
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