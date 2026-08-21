import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { Asset, Disposal, PageProps } from '@/types';
import { documentUrl } from '@/lib/utils';
import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/react';
import { FormEvent, useState} from 'react';
import { FileText, MapPin, Pencil, Upload } from 'lucide-react';
import { IncidentLocationMap } from '@/Components/shared/IncidentLocationMap';
import { PdfBadge } from '@/Components/shared/PdfBadge';
import RequiredDocumentsModal from '@/Components/shared/RequiredDocumentsModal';

interface ShowProps {
    asset: Asset;
    qrPayload: string | null;
    qrSvg: string | null;
    requiredDocumentTypes: Array<{ value: string; label: string }>;
    modes: Array<{ value: string; label: string }>;
    can: {
        signReceipt: boolean;
        markStored: boolean;
        updateAap: boolean
        generateQr: boolean;
        edit: boolean;
        createJev: boolean;
        uploadJev: boolean;
        releaseDonation: boolean;
        processDisposal: boolean;
        resolveCase: boolean;
        updateCaseDetails: boolean;
        uploadEvidence: boolean;
        issueJevOut: boolean;
        verifyDocuments: boolean;
        uploadJevOut: boolean;
        submitForCustodyReview: boolean;
    };
}

export default function AssetsShow({ asset, qrPayload, qrSvg, requiredDocumentTypes, modes, can }: ShowProps) {
    usePoll(6000, { only: ['asset'] });

    const { auth } = usePage<PageProps>().props;
    const [confirmAction, setConfirmAction] = useState<string | null>(null);
    const [showJevModal, setShowJevModal] = useState(false);
    const [selectedPiece, setSelectedPiece] = useState<import('@/types').AssetPiece | null>(null);
    const [showRequiredDocsModal, setShowRequiredDocsModal] = useState(false);
    const [viewingDisposal, setViewingDisposal] = useState<Disposal | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const editForm = useForm({
        species: asset.species ?? '',
        description: asset.description ?? '',
        quantity: asset.quantity != null ? String(asset.quantity) : '',
        quantity_unit: asset.quantity_unit ?? '',
        length: asset.length != null ? String(asset.length) : '',
        width: asset.width != null ? String(asset.width) : '',
        height: asset.height != null ? String(asset.height) : '',
        volume_bd_ft: asset.volume_bd_ft != null ? String(asset.volume_bd_ft) : '',
        volume_cu_m: asset.volume_cu_m != null ? String(asset.volume_cu_m) : '',
        estimated_value: asset.estimated_value != null ? String(asset.estimated_value) : '',
        plate_number: asset.plate_number ?? '',
        location_apprehended: asset.location_apprehended ?? '',
        apprehending_agency: asset.apprehending_agency ?? '',
        mode: asset.mode ?? '',
        has_ongoing_case: asset.has_ongoing_case ?? false,
        has_confiscation_order: asset.has_confiscation_order ?? false,
    });

    function submitEdit(e: FormEvent) {
        e.preventDefault();
        editForm.put(route('assets.update', asset.id), {
            preserveScroll: true,
            onSuccess: () => setShowEditModal(false),
        });
    }


    const jevForm = useForm({
        jev_number: '',
    });

    const caseForm = useForm({
        case_number: asset.case_number ?? '',
        court_branch: asset.court_branch ?? '',
        next_hearing_date: asset.next_hearing_date ? asset.next_hearing_date.slice(0, 10) : '',
    });

    const jevOutForm = useForm({ jev_number: '' });

    function submitJevOut(e: FormEvent, disposalId: number) {
        e.preventDefault();
        jevOutForm.post(route('disposals.jev-out.store', disposalId), {
            preserveScroll: true,
            onSuccess: () => jevOutForm.reset(),
        });
    }

    function submitCaseDetails(e: FormEvent) {
        e.preventDefault();
        caseForm.post(route('assets.case-details.update', asset.id), { preserveScroll: true });
    }

    const [editingAap, setEditingAap] = useState(false);
    const aapForm = useForm({ aap_number: asset.aap_number ?? '' });

    function submitAap(e: FormEvent) {
        e.preventDefault();
        aapForm.post(route('assets.aap-number.update', asset.id), {
            preserveScroll: true,
            onSuccess: () => setEditingAap(false),
        });
    }

    const currentRole = auth.user?.roles?.[0] ?? 'User';

    function handleSignReceipt() {
        if (confirm('Sign acknowledgement receipt for this asset?')) {
            router.post(route('assets.sign-receipt', asset.id));
        }
    }

    function handleMarkStored() {
        if (confirm('Confirm documents are verified and asset has been physically tagged with its QR sticker?')) {
            router.post(route('assets.mark-stored', asset.id));
        }
    }

    function handleSubmitForCustodyReview() {
        if (confirm('Submit documents for custody review? The Property Custodian will be notified.')) {
            router.post(route('assets.submit-for-custody-review', asset.id));
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

    function handleUploadJevOut(disposalId: number) {
        if (confirm('Confirm the JEV Out has been uploaded? This will generate the Release Order and Waybill.')) {
            router.post(route('disposals.jev-out.upload', disposalId));
        }
    }

    function handleReleaseDonation() {
        if (pendingDonationDisposal && confirm('Mark this donation as released to the requester?')) {
            router.post(route('disposals.release-donation', pendingDonationDisposal.id));
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
        if (!pendingDonationDisposal) return;
        if (!confirm('Mark this donation as released to the requester?')) return;
        releaseForm.post(route('disposals.release-donation', pendingDonationDisposal.id), {
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
    const disposals = asset.disposals ?? [];
    const totalDisposed = disposals.reduce((sum, d) => sum + d.quantity, 0);
    const remainingQuantity = Math.max(0, (asset.quantity ?? 1) - totalDisposed);
    const showDisposalHistory =
        disposals.length > 0 ||
        asset.current_status === 'for_disposal' ||
        ['pending_release', 'donated', 'decayed', 'fabricated', 'released', 'forfeited', 'damaged'].includes(asset.current_status);
    const isPartiallyDisposed =
        asset.current_status === 'for_disposal' &&
        (asset.disposed_quantity ?? 0) > 0 &&
        (asset.disposed_quantity ?? 0) < (asset.quantity ?? 1);
    // A donation disposal still awaiting physical release/confirmation, if any.
    const pendingDonationDisposal = disposals.find((d) => d.disposal_type === 'donation' && d.donation && !d.donation.released_at);
    // The Donation Release card should only appear once JEV Out has been
    // issued for this donation — the Release Order / Waybill (and the act of
    // physically releasing the item) only make sense after that step.
    const donationReadyForRelease = Boolean(
        pendingDonationDisposal?.donation && pendingDonationDisposal.disposal_jev?.uploaded_at,
    );
    const dateOfApprehension = asset.incident?.date_of_apprehension
        ? new Date(asset.incident.date_of_apprehension).toLocaleDateString()
        : '—';
    const placeOfApprehension = asset.incident?.place_of_apprehension ?? asset.location_apprehended ?? '—';
    const stickerSpecies = asset.species ?? '—';
    const stickerPcs = asset.quantity ?? 1;

    const donationAwaitingJevOut = disposals.find(
        (d) => d.disposal_type === 'donation' && d.donation && !d.disposal_jev,
    );

    const donationAwaitingJevOutUpload = disposals.find(
        (d) => d.disposal_type === 'donation' && d.donation && d.disposal_jev && !d.disposal_jev.uploaded_at,
    );

    const donationsWithJevOut = disposals.filter(
        (d) => d.disposal_type === 'donation' && d.donation && d.disposal_jev && d.disposal_jev.uploaded_at,
    );
    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">Asset Detail</h2>
                        <p className="text-sm text-gray-500">
                            {asset.asset_code}
                            {asset.incident && <span className="ml-1 text-gray-400">— Item {asset.item_number}</span>}
                        </p>
                    </div>
                    <AssetStatusBadge
                        status={asset.current_status}
                        label={asset.current_status.replace(/_/g, ' ')}
                        disposedQuantity={asset.disposed_quantity}
                        quantity={asset.quantity}
                        className="px-3 py-1.5 text-sm"
                    />
                </div>
            }
        >
            <Head title={`Asset ${asset.asset_code.slice(0, 8)}`} />

            <div className="mx-auto max-w-7xl space-y-6 overflow-x-hidden px-4 sm:px-6 lg:px-8">
                <div className="grid items-start gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">Overview</CardTitle>
                            <div className="flex items-center gap-2">
                                {asset.incident && (
                                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                                        {asset.asset_code}
                                    </span>
                                )}
                                {can.edit && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowEditModal(true)}
                                        className="gap-1.5"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm md:grid-cols-2 break-words">
                            <p><span className="font-medium">Types:</span> {asset.type}</p>
                            <p><span className="font-medium">Mode:</span> {asset.mode}</p>
                            <div className="md:col-span-2">
                            <span className="font-medium">AAP No.:</span>{' '}
                            {editingAap ? (
                                <form onSubmit={submitAap} className="mt-1 flex items-center gap-2">
                                    <Input
                                        value={aapForm.data.aap_number}
                                        onChange={(e) => aapForm.setData('aap_number', e.target.value)}
                                        placeholder="e.g. AAP-2026-0042"
                                        className="max-w-xs"
                                        autoFocus
                                    />
                                    <Button type="submit" size="sm" disabled={aapForm.processing}>Save</Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingAap(false)}>Cancel</Button>
                                </form>
                            ) : (
                                <>
                                    {asset.aap_number ?? <span className="text-gray-400">Not yet received</span>}
                                    {can.updateAap && (
                                        <button
                                            type="button"
                                            onClick={() => setEditingAap(true)}
                                            className="ml-2 text-xs font-medium text-emerald-700 hover:underline"
                                        >
                                            {asset.aap_number ? 'Edit' : 'Add'}
                                        </button>
                                    )}
                                </>
                            )}
                            <InputError message={aapForm.errors.aap_number} className="mt-1" />
                        </div>
                            {/* Pieces breakdown */}
                            {asset.pieces && asset.pieces.length > 0 && (
                                <div className="md:col-span-2 mt-2 border-t border-b border-gray-100 pt-4 pb-4">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                        Pieces ({asset.pieces.length})
                                    </p>

                                    {/* Mobile: stacked cards */}
                                    <div className="space-y-2 sm:hidden">
                                        {asset.pieces.map((piece) => (
                                            <button
                                                key={piece.id}
                                                type="button"
                                                onClick={() => setSelectedPiece(piece)}
                                                className="w-full rounded-md border border-gray-200 p-3 text-left active:bg-gray-50"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        Piece {piece.piece_number} — {piece.species ?? '—'}
                                                    </span>
                                                    <span className="text-xs font-medium text-emerald-700">View</span>
                                                </div>

                                                {asset.type === 'log' && (
                                                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                                                        <div>
                                                            <dt className="text-gray-400">Dimensions</dt>
                                                            <dd>{piece.length ?? '—'} × {piece.width ?? '—'} × {piece.height ?? '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-gray-400">Vol. (bd.ft)</dt>
                                                            <dd>{piece.volume_bd_ft ?? '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-gray-400">Vol. (cu.m)</dt>
                                                            <dd>{piece.volume_cu_m ?? '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-gray-400">Est. Value (₱)</dt>
                                                            <dd>
                                                                {piece.estimated_value != null
                                                                    ? Number(piece.estimated_value).toLocaleString()
                                                                    : '—'}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                )}

                                                {asset.type === 'vehicle' && (
                                                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                                                        <div>
                                                            <dt className="text-gray-400">Plate No.</dt>
                                                            <dd>{piece.plate_number ?? '—'}</dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-gray-400">Est. Value (₱)</dt>
                                                            <dd>
                                                                {piece.estimated_value != null
                                                                    ? Number(piece.estimated_value).toLocaleString()
                                                                    : '—'}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                )}

                                                {asset.type === 'equipment' && (
                                                    <dl className="mt-2 grid grid-cols-1 gap-y-1 text-xs text-gray-600">
                                                        <div>
                                                            <dt className="text-gray-400">Est. Value (₱)</dt>
                                                            <dd>
                                                                {piece.estimated_value != null
                                                                    ? Number(piece.estimated_value).toLocaleString()
                                                                    : '—'}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Desktop: table */}
                                    <div className="hidden overflow-x-auto rounded-md border border-gray-200 sm:block">
                                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500">Species</th>
                                                    {asset.type === 'log' && (
                                                        <>
                                                            <th className="px-3 py-2 text-left font-medium text-gray-500">Dimensions (L×W×H)</th>
                                                            <th className="px-3 py-2 text-left font-medium text-gray-500">Vol. (bd.ft)</th>
                                                            <th className="px-3 py-2 text-left font-medium text-gray-500">Vol. (cu.m)</th>
                                                        </>
                                                    )}
                                                    {asset.type === 'vehicle' && (
                                                        <th className="px-3 py-2 text-left font-medium text-gray-500">Plate No.</th>
                                                    )}
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500">Est. Value (₱)</th>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {asset.pieces.map((piece) => (
                                                    <tr key={piece.id} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 text-gray-600">{piece.piece_number}</td>
                                                        <td className="px-3 py-2 text-gray-900">{piece.species ?? '—'}</td>
                                                        {asset.type === 'log' && (
                                                            <>
                                                                <td className="px-3 py-2 text-gray-900">
                                                                    {piece.length ?? '—'} × {piece.width ?? '—'} × {piece.height ?? '—'}
                                                                </td>
                                                                <td className="px-3 py-2 text-gray-900">{piece.volume_bd_ft ?? '—'}</td>
                                                                <td className="px-3 py-2 text-gray-900">{piece.volume_cu_m ?? '—'}</td>
                                                            </>
                                                        )}
                                                        {asset.type === 'vehicle' && (
                                                            <td className="px-3 py-2 text-gray-900">{piece.plate_number ?? '—'}</td>
                                                        )}
                                                        <td className="px-3 py-2 text-gray-900">
                                                            {piece.estimated_value != null
                                                                ? Number(piece.estimated_value).toLocaleString()
                                                                : '—'}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedPiece(piece)}
                                                                className="text-xs font-medium text-emerald-700 hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <p><span className="font-medium">Location:</span> {asset.location_apprehended}</p>
                            <p><span className="font-medium">Agency:</span> {asset.apprehending_agency}</p>
                            <p><span className="font-medium">Estimated Value (php):</span> {asset.estimated_value != null ? Number(asset.estimated_value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</p>
                            {asset.type === 'log' && (
                                <>
                                    <p><span className="font-medium">Volume (bd.ft):</span> {asset.volume_bd_ft ?? '—'}</p>
                                    <p><span className="font-medium">Volume (cu.m):</span> {asset.volume_cu_m ?? '—'}</p>
                                </>
                            )}
                            {asset.type === 'vehicle' && (
                                <p><span className="font-medium">Plate / Conveyance No.:</span> {asset.plate_number ?? '—'}</p>
                            )}
                            <p><span className="font-medium">Ongoing case:</span> {asset.has_ongoing_case ? 'Yes' : 'No'}</p>
                            <p><span className="font-medium">Confiscation order:</span> {asset.has_confiscation_order ? 'Yes' : 'No'}</p>
                            {asset.case_number && (
                                <p><span className="font-medium">Case Number:</span> {asset.case_number}</p>
                            )}
                            {asset.court_branch && (
                                <p><span className="font-medium">Court / Branch:</span> {asset.court_branch}</p>
                            )}
                            {asset.next_hearing_date && (
                                <p><span className="font-medium">Next Hearing Date:</span> {new Date(asset.next_hearing_date).toLocaleDateString()}</p>
                            )}

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

                    {/* Sidebar — map only. Evidence/Actions/JEV moved to the
                        dedicated three-column row below. */}
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
                    </div>
                </div>

                {/* Evidence, Actions, JEV — side by side on desktop, stacked on mobile */}
                <div className="grid items-start gap-6 lg:grid-cols-3">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Evidence & Documents</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {requiredDocumentTypes.length > 0 && (
                                <p className="text-xs text-amber-700">
                                    {requiredDocumentTypes.length} document{requiredDocumentTypes.length === 1 ? '' : 's'} required before storage.
                                </p>
                            )}

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={() => setShowRequiredDocsModal(true)}
                            >
                                Upload Documents
                            </Button>

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
                                                className="group relative block overflow-hidden rounded-md border border-gray-200"
                                            >
                                                {doc.document_type && (
                                                    <span
                                                        className={
                                                            'absolute right-1 top-1 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ' +
                                                            (doc.status === 'verified'
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : doc.status === 'rejected'
                                                                    ? 'bg-red-100 text-red-800'
                                                                    : 'bg-amber-100 text-amber-800')
                                                        }
                                                    >
                                                        {doc.status}
                                                    </span>
                                                )}
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
                            {can.submitForCustodyReview && (
                                <Button className="w-full" variant="secondary" onClick={handleSubmitForCustodyReview}>
                                    Submit for Custody Review
                                </Button>
                            )}
                            {can.markStored && (
                                <Button className="w-full" variant="secondary" onClick={handleMarkStored}>
                                    Mark as Tagged
                                </Button>
                            )}
                            {asset.current_status === 'pending_custody_review' && !can.markStored && requiredDocumentTypes.length > 0 && (
                                <p className="text-xs text-amber-700">
                                    Waiting on required document verification before this asset can be tagged.
                                </p>
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
                            {!can.signReceipt && !can.markStored && !can.submitForCustodyReview && !can.resolveCase && !(can.processDisposal && asset.current_status === 'for_disposal') && !receiptUrl && (  
                                <p className="text-sm text-gray-500">No actions available for your role at this stage.</p>
                            )}
                            {receiptUrl && (
                                <a href={receiptUrl} className="block text-center text-sm text-emerald-700 hover:underline">
                                    Download Acknowledgement Receipt
                                </a>
                            )}
                        </CardContent>
                    </Card>

                    {/* Journal Entry Voucher — JEV In (asset-level) and JEV Out
                        (donation disposal-level) merged into a single card so
                        the accounting handoff reads as one continuous story. */}
                    <Card>
                        <CardHeader><CardTitle className="text-base">Journal Entry Voucher</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {/* JEV In: not yet created */}
                            {can.createJev && asset.current_status === 'cleared_for_accounting' && !asset.jev && (
                                <div>
                                    <p className="text-sm text-gray-500">
                                        This asset is cleared for accounting and needs a Journal Entry Voucher
                                        before it can move to disposal processing.
                                    </p>
                                    <div className="mt-3">
                                        <Button onClick={() => setShowJevModal(true)}>Fill Out JEV Form</Button>
                                    </div>
                                </div>
                            )}

                            {!can.createJev && asset.current_status === 'cleared_for_accounting' && !asset.jev && (
                                <p className="text-sm text-gray-500">
                                    Cleared for accounting — awaiting JEV creation by Accounting.
                                </p>
                            )}

                            {/* JEV In: created, not yet uploaded/confirmed by MES */}
                            {asset.jev && !asset.jev.uploaded_at && (
                                <div>
                                    <p className="text-sm text-gray-500">
                                        Accounting issued this JEV. Confirm the upload to move the asset to disposal processing.
                                    </p>
                                    <p className="mt-2 text-sm">
                                        <span className="font-medium">JEV Number:</span> {asset.jev.jev_number}
                                    </p>
                                    {can.uploadJev && (
                                        <div className="mt-3">
                                            <Button onClick={handleUploadJev}>Confirm JEV Upload</Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* JEV In: uploaded/confirmed */}
                            {asset.jev && asset.jev.uploaded_at && (
                                <p className="text-sm text-gray-600">
                                    JEV (IN): <span className="font-medium">{asset.jev.jev_number}</span> issued by{' '}
                                    {asset.jev.created_by_accounting?.name ?? 'Accounting'} and uploaded by{' '}
                                    {asset.jev.uploaded_by_mes?.name ?? 'MES'}.
                                </p>
                            )}

                            {asset.current_status !== 'cleared_for_accounting' && !asset.jev && (
                                <p className="text-sm text-gray-500">
                                    No JEV has been issued for this asset yet.
                                </p>
                            )}

                            {/* JEV Out: donation disposal awaiting its own JEV */}
                            {donationAwaitingJevOut && (
                                <div className="border-t border-gray-100 pt-4">
                                    <p className="text-sm font-semibold text-gray-700">Donation — Awaiting JEV Out</p>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Deed of Donation is on file. Issue JEV Out to generate the Release Order and Waybill.
                                    </p>

                                    {documentUrl(donationAwaitingJevOut.donation?.deed_of_donation_path) && (
                                        <a
                                            href={documentUrl(donationAwaitingJevOut.donation?.deed_of_donation_path) ?? '#'}
                                            className="mt-2 block text-sm text-emerald-700 hover:underline"
                                        >
                                            Download Deed of Donation
                                        </a>
                                    )}

                                    {can.issueJevOut ? (
                                        <form
                                            onSubmit={(e) => submitJevOut(e, donationAwaitingJevOut.id)}
                                            className="mt-3 space-y-3"
                                        >
                                            <div className="space-y-2">
                                                <Label htmlFor="jev_out_number">JEV Out Number</Label>
                                                <Input
                                                    id="jev_out_number"
                                                    placeholder="2026-05-000930"
                                                    value={jevOutForm.data.jev_number}
                                                    onChange={(e) => jevOutForm.setData('jev_number', e.target.value)}
                                                    required
                                                />
                                                <InputError message={jevOutForm.errors.jev_number} />
                                            </div>
                                            <Button type="submit" disabled={jevOutForm.processing}>
                                                Issue JEV Out
                                            </Button>
                                        </form>
                                    ) : (
                                        <p className="mt-3 text-sm text-gray-500">
                                            Awaiting Accounting to issue JEV Out for this donation.
                                        </p>
                                    )}
                                </div>
                            )}

                            {donationAwaitingJevOutUpload && (
                                <div className="border-t border-gray-100 pt-4">
                                    <p className="text-sm font-semibold text-gray-700">Donation — JEV Out Issued, Awaiting MES Upload</p>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Accounting recorded the JEV Out number. Confirm the upload to generate the Release Order and Waybill.
                                    </p>
                                    <p className="mt-2 text-sm">
                                        <span className="font-medium">JEV Out Number:</span> {donationAwaitingJevOutUpload.disposal_jev!.jev_number}
                                    </p>
                                    {can.uploadJevOut ? (
                                        <div className="mt-3">
                                            <Button onClick={() => handleUploadJevOut(donationAwaitingJevOutUpload.id)}>
                                                Confirm JEV Out Upload
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-sm text-gray-500">Awaiting MES to confirm JEV Out upload.</p>
                                    )}
                                </div>
                            )}

                            {donationsWithJevOut.map((d) => (
                                <div key={d.id} className="border-t border-gray-100 pt-4">
                                    <p className="text-sm text-gray-600">
                                        JEV (OUT): <span className="font-medium">{d.disposal_jev!.jev_number}</span> issued by{' '}
                                        {d.disposal_jev!.issued_by_accounting?.name ?? 'Accounting'}
                                        {d.disposal_jev!.uploaded_by_mes && (
                                            <> and uploaded by {d.disposal_jev!.uploaded_by_mes.name}</>
                                        )}.
                                    </p>
                                    {d.donation && (
                                        <p className="text-xs text-gray-500">
                                            {d.quantity} unit(s) to {d.donation.requester_name}
                                        </p>
                                    )}
                                    {documentUrl(d.disposal_jev!.pdf_path) && (
                                        <a
                                            href={documentUrl(d.disposal_jev!.pdf_path) ?? '#'}
                                            className="mt-1 block text-sm text-emerald-700 hover:underline"
                                        >
                                            Download JEV Out
                                        </a>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

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

                <Modal show={viewingDisposal !== null} onClose={() => setViewingDisposal(null)} maxWidth="lg">
                    {viewingDisposal && (
                        <div className="p-6">
                            <h2 className="text-lg font-medium capitalize text-gray-900">
                                {viewingDisposal.disposal_type.replace(/_/g, ' ')} Disposal
                            </h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Processed {new Date(viewingDisposal.processed_at).toLocaleString()}
                            </p>

                            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                                <div>
                                    <dt className="text-gray-500">Quantity</dt>
                                    <dd className="text-gray-900">{viewingDisposal.quantity} unit(s)</dd>
                                </div>
                                {viewingDisposal.volume_bd_ft && (
                                    <div>
                                        <dt className="text-gray-500">Volume (bd.ft)</dt>
                                        <dd className="text-gray-900">{viewingDisposal.volume_bd_ft}</dd>
                                    </div>
                                )}
                                {viewingDisposal.details && Object.entries(viewingDisposal.details).map(([key, value]) => (
                                    value ? (
                                        <div key={key}>
                                            <dt className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</dt>
                                            <dd className="text-gray-900">{String(value)}</dd>
                                        </div>
                                    ) : null
                                ))}
                            </dl>

                            {viewingDisposal.donation && (
                                <div className="mt-4 border-t border-gray-100 pt-4">
                                    <p className="text-sm font-semibold text-gray-700">Donation</p>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {viewingDisposal.donation.requester_name}
                                        {viewingDisposal.donation.agency_name ? ` (${viewingDisposal.donation.agency_name})` : ''}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {[viewingDisposal.donation.street, viewingDisposal.donation.barangay, viewingDisposal.donation.municipality]
                                            .filter(Boolean)
                                            .join(', ') || 'No address on file'}
                                    </p>
                                </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                                {documentUrl(viewingDisposal.report_pdf_path) && (
                                    <a href={documentUrl(viewingDisposal.report_pdf_path) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                        Download Report
                                    </a>
                                )}
                                {documentUrl(viewingDisposal.donation?.deed_of_donation_path) && (
                                    <a href={documentUrl(viewingDisposal.donation?.deed_of_donation_path) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                        Download Deed of Donation
                                    </a>
                                )}
                                {documentUrl(viewingDisposal.donation?.waybill_pdf_path) && (
                                    <a href={documentUrl(viewingDisposal.donation?.waybill_pdf_path) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                        Download Waybill
                                    </a>
                                )}
                                {documentUrl(viewingDisposal.ics_record?.pdf_path) && (
                                    <a href={documentUrl(viewingDisposal.ics_record?.pdf_path) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                        Download ICS
                                    </a>
                                )}
                                {documentUrl(viewingDisposal.par_record?.pdf_path) && (
                                    <a href={documentUrl(viewingDisposal.par_record?.pdf_path) ?? '#'} className="text-sm text-emerald-700 hover:underline">
                                        Download PAR
                                    </a>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                                <Button type="button" variant="outline" onClick={() => setViewingDisposal(null)}>Close</Button>
                            </div>
                        </div>
                    )}
                </Modal>

                <RequiredDocumentsModal
                    show={showRequiredDocsModal}
                    onClose={() => setShowRequiredDocsModal(false)}
                    assetId={asset.id}
                    requiredTypes={requiredDocumentTypes}
                    documents={asset.documents ?? []}
                    canUpload={can.uploadEvidence}
                    canVerify={can.verifyDocuments}
                />

                {/* QR + Donation */}
                {(qrSvg || donationReadyForRelease) && (
                    <div className="grid items-start gap-6 lg:grid-cols-3">

                        {donationReadyForRelease && pendingDonationDisposal?.donation && (
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {pendingDonationDisposal.donation.released_at
                                            ? 'Donation Released'
                                            : 'Donation Release'}
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="space-y-4">

                                    {!pendingDonationDisposal.donation.released_at && (
                                        <>
                                            <p className="text-sm text-gray-600">
                                                Deed of Donation is on file for{' '}
                                                <span className="font-medium">
                                                    {pendingDonationDisposal.donation.requester_name}
                                                </span>.
                                                {' '}Mark as released once the item has been handed over.
                                            </p>

                                            {documentUrl(pendingDonationDisposal.donation.waybill_pdf_path) && (
                                                <a
                                                    href={documentUrl(pendingDonationDisposal.donation.waybill_pdf_path) ?? '#'}
                                                    className="block text-sm text-emerald-700 hover:underline"
                                                >
                                                    Download Donation Waybill (
                                                    {pendingDonationDisposal.quantity}
                                                    {' '}
                                                    piece
                                                    {pendingDonationDisposal.quantity === 1 ? '' : 's'})
                                                </a>
                                            )}

                                            {(pendingDonationDisposal.details as { delivery_coordinates?: string })
                                                ?.delivery_coordinates && (
                                                <IncidentLocationMap
                                                    coordinates={
                                                        (
                                                            pendingDonationDisposal.details as {
                                                                delivery_coordinates?: string;
                                                            }
                                                        ).delivery_coordinates
                                                    }
                                                    placeName={pendingDonationDisposal.donation.requester_name}
                                                    areaName="Delivery location"
                                                />
                                            )}

                                            {can.releaseDonation && (
                                                <form onSubmit={submitRelease} className="space-y-3">
                                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
                                                        {releaseForm.data.photo
                                                            ? releaseForm.data.photo.name
                                                            : 'Attach release photo (opens camera on mobile)'}

                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            capture="environment"
                                                            className="hidden"
                                                            onChange={(e) =>
                                                                releaseForm.setData(
                                                                    'photo',
                                                                    e.target.files?.[0] ?? null,
                                                                )
                                                            }
                                                            required
                                                        />
                                                    </label>

                                                    <Button type="submit" disabled={releaseForm.processing}>
                                                        Mark Donation Released
                                                    </Button>
                                                </form>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {qrSvg && (
                            <Card className={donationReadyForRelease ? "" : "lg:col-span-3"}>
                                <CardHeader>
                                    <CardTitle className="text-base">Asset Tag Stickers</CardTitle>
                                    <p className="text-sm text-gray-500">
                                        {stickerPcs} label{stickerPcs === 1 ? '' : 's'} — one per physical piece, sized for sticker sheets.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <a href={route('assets.stickers.pdf', asset.id)} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline">Print Stickers</Button>
                                    </a>
                                </CardContent>
                            </Card>
                        )}
                    </div>
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

                {showDisposalHistory && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Disposal History</CardTitle>
                            <p className="text-sm text-gray-500">
                                {totalDisposed} of {asset.quantity ?? 1} unit(s) disposed
                                {remainingQuantity > 0 ? ` — ${remainingQuantity} remaining` : ' — fully disposed'}.
                            </p>
                        </CardHeader>
                        <CardContent>
                            {disposals.length === 0 ? (
                                <p className="text-sm text-gray-500">No disposal actions recorded yet.</p>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {disposals.map((d) => (
                                        <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                                            <div>
                                                <p className="font-medium capitalize text-gray-800">
                                                    {d.disposal_type.replace(/_/g, ' ')} — {d.quantity} unit(s)
                                                </p>
                                                {d.donation && (
                                                    <p className="text-gray-500">
                                                        {d.donation.requester_name}
                                                        {d.donation.released_at
                                                            ? ` — released ${new Date(d.donation.released_at).toLocaleDateString()}`
                                                            : ' — awaiting release'}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="text-xs text-gray-400">
                                                    {new Date(d.processed_at).toLocaleString()}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingDisposal(d)}
                                                    className="text-xs font-medium text-emerald-700 hover:underline"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {isPartiallyDisposed && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <span className="font-medium">
                            {asset.disposed_quantity}/{asset.quantity} units disposed so far
                        </span>
                        {' '}— see Disposal History above for partial actions. This AAP stays "For Disposal" until fully processed.
                    </div>
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
            {/* Piece detail modal */}
            <Modal show={selectedPiece !== null} onClose={() => setSelectedPiece(null)} maxWidth="lg">
                {selectedPiece && (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                Piece {selectedPiece.piece_number} — Detail
                            </h2>
                            <button
                                type="button"
                                onClick={() => setSelectedPiece(null)}
                                className="text-gray-400 hover:text-gray-600 text-sm"
                            >
                                ✕
                            </button>
                        </div>
                        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-gray-500">Piece #</dt>
                                <dd className="font-medium text-gray-900">{selectedPiece.piece_number}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Species</dt>
                                <dd className="font-medium text-gray-900">{selectedPiece.species ?? '—'}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-gray-500">Description</dt>
                                <dd className="font-medium text-gray-900">{selectedPiece.description ?? '—'}</dd>
                            </div>
                            {asset.type === 'log' && (
                                <>
                                    <div>
                                        <dt className="text-gray-500">Length</dt>
                                        <dd className="font-medium text-gray-900">{selectedPiece.length ?? '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500">Width</dt>
                                        <dd className="font-medium text-gray-900">{selectedPiece.width ?? '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500">Height</dt>
                                        <dd className="font-medium text-gray-900">{selectedPiece.height ?? '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500">Volume (bd.ft)</dt>
                                        <dd className="font-medium text-gray-900">{selectedPiece.volume_bd_ft ?? '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500">Volume (cu.m)</dt>
                                        <dd className="font-medium text-gray-900">{selectedPiece.volume_cu_m ?? '—'}</dd>
                                    </div>
                                </>
                            )}
                            {asset.type === 'vehicle' && (
                                <div>
                                    <dt className="text-gray-500">Plate / Conveyance No.</dt>
                                    <dd className="font-medium text-gray-900">{selectedPiece.plate_number ?? '—'}</dd>
                                </div>
                            )}
                            <div>
                                <dt className="text-gray-500">Estimated Value (₱)</dt>
                                <dd className="font-medium text-gray-900">
                                    {selectedPiece.estimated_value != null
                                        ? Number(selectedPiece.estimated_value).toLocaleString()
                                        : '—'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Encoded At</dt>
                                <dd className="font-medium text-gray-900">
                                    {new Date(selectedPiece.created_at).toLocaleString()}
                                </dd>
                            </div>
                        </dl>
                    </div>
                )}
            </Modal>

            <Modal show={showEditModal} onClose={() => setShowEditModal(false)} maxWidth="2xl">
                <form onSubmit={submitEdit} className="p-6 space-y-5">
                    <h2 className="text-lg font-semibold text-gray-800">Edit Asset</h2>

                    {/* Species / Description */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="edit-species">Species / Name</Label>
                            <Input
                                id="edit-species"
                                value={editForm.data.species}
                                onChange={(e) => editForm.setData('species', e.target.value)}
                            />
                            <InputError message={editForm.errors.species} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-mode">Mode</Label>
                            <select
                                id="edit-mode"
                                value={editForm.data.mode}
                                onChange={(e) => editForm.setData('mode', e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {modes.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <InputError message={editForm.errors.mode} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="edit-description">Description</Label>
                        <textarea
                            id="edit-description"
                            rows={3}
                            value={editForm.data.description}
                            onChange={(e) => editForm.setData('description', e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <InputError message={editForm.errors.description} />
                    </div>

                    {/* Quantity */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="edit-quantity">Quantity</Label>
                            <Input
                                id="edit-quantity"
                                type="number"
                                min={1}
                                value={editForm.data.quantity}
                                onChange={(e) => editForm.setData('quantity', e.target.value)}
                            />
                            <InputError message={editForm.errors.quantity} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-quantity-unit">Unit</Label>
                            <Input
                                id="edit-quantity-unit"
                                placeholder="e.g. pcs, bd.ft"
                                value={editForm.data.quantity_unit}
                                onChange={(e) => editForm.setData('quantity_unit', e.target.value)}
                            />
                            <InputError message={editForm.errors.quantity_unit} />
                        </div>
                    </div>

                    {/* Dimensions — only for logs */}
                    {asset.type === 'log' && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dimensions</p>
                            <div className="grid gap-4 sm:grid-cols-3">
                                {(['length', 'width', 'height'] as const).map((dim) => (
                                    <div key={dim} className="space-y-1">
                                        <Label htmlFor={`edit-${dim}`}>{dim.charAt(0).toUpperCase() + dim.slice(1)}</Label>
                                        <Input
                                            id={`edit-${dim}`}
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={(editForm.data as any)[dim]}
                                            onChange={(e) => editForm.setData(dim, e.target.value)}
                                        />
                                        <InputError message={(editForm.errors as any)[dim]} />
                                    </div>
                                ))}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="edit-volume-bd">Volume (bd.ft)</Label>
                                    <Input
                                        id="edit-volume-bd"
                                        type="number" min={0} step="0.01"
                                        value={editForm.data.volume_bd_ft}
                                        onChange={(e) => editForm.setData('volume_bd_ft', e.target.value)}
                                    />
                                    <InputError message={editForm.errors.volume_bd_ft} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-volume-cu">Volume (cu.m)</Label>
                                    <Input
                                        id="edit-volume-cu"
                                        type="number" min={0} step="0.0001"
                                        value={editForm.data.volume_cu_m}
                                        onChange={(e) => editForm.setData('volume_cu_m', e.target.value)}
                                    />
                                    <InputError message={editForm.errors.volume_cu_m} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Vehicle plate */}
                    {asset.type === 'vehicle' && (
                        <div className="space-y-1">
                            <Label htmlFor="edit-plate">Plate / Conveyance No.</Label>
                            <Input
                                id="edit-plate"
                                value={editForm.data.plate_number}
                                onChange={(e) => editForm.setData('plate_number', e.target.value)}
                            />
                            <InputError message={editForm.errors.plate_number} />
                        </div>
                    )}

                    {/* Estimated Value */}
                    <div className="space-y-1">
                        <Label htmlFor="edit-value">Estimated Value (₱)</Label>
                        <Input
                            id="edit-value"
                            type="number" min={0} step="0.01"
                            value={editForm.data.estimated_value}
                            onChange={(e) => editForm.setData('estimated_value', e.target.value)}
                        />
                        <InputError message={editForm.errors.estimated_value} />
                    </div>

                    {/* Location / Agency */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="edit-location">Location Apprehended</Label>
                            <Input
                                id="edit-location"
                                value={editForm.data.location_apprehended}
                                onChange={(e) => editForm.setData('location_apprehended', e.target.value)}
                            />
                            <InputError message={editForm.errors.location_apprehended} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-agency">Apprehending Agency</Label>
                            <Input
                                id="edit-agency"
                                value={editForm.data.apprehending_agency}
                                onChange={(e) => editForm.setData('apprehending_agency', e.target.value)}
                            />
                            <InputError message={editForm.errors.apprehending_agency} />
                        </div>
                    </div>

                    {/* Case Flags */}
                    <div className="flex flex-wrap gap-6">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={editForm.data.has_ongoing_case}
                                onChange={(e) => editForm.setData('has_ongoing_case', e.target.checked)}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Ongoing Case
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={editForm.data.has_confiscation_order}
                                onChange={(e) => editForm.setData('has_confiscation_order', e.target.checked)}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Has Confiscation Order
                        </label>
                    </div>

                    {/* Footer buttons */}
                    <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                        <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={editForm.processing}>
                            {editForm.processing ? 'Saving…' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}