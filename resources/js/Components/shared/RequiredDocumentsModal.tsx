import { useState, FormEvent, ChangeEvent } from 'react';
import { useForm } from '@inertiajs/react';
import { DialogTitle } from '@headlessui/react';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { PdfBadge } from '@/Components/shared/PdfBadge';
import { documentUrl } from '@/lib/utils';
import { DocumentItem } from '@/types';
import {
    CheckCircle2,
    XCircle,
    UploadCloud,
    Clock,
    Circle,
    ChevronDown,
    ChevronUp,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface RequiredDocType {
    value: string;
    label: string;
}

interface RequiredDocumentsModalProps {
    show: boolean;
    onClose: () => void;
    assetId: number;
    requiredTypes: RequiredDocType[];
    documents: DocumentItem[];
    canUpload: boolean;
    canVerify: boolean;
}

type DocState = 'missing' | 'pending' | 'verified' | 'rejected';

const STATE_META: Record<DocState, { label: string; className: string; Icon: LucideIcon }> = {
    missing:  { label: 'Missing',        className: 'bg-gray-100 text-gray-600',     Icon: Circle },
    pending:  { label: 'Pending review', className: 'bg-amber-100 text-amber-800',   Icon: Clock },
    verified: { label: 'Verified',       className: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 },
    rejected: { label: 'Rejected',       className: 'bg-red-100 text-red-800',       Icon: XCircle },
};

function StatusPill({ state }: { state: DocState }) {
    const { label, className, Icon } = STATE_META[state];
    return (
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
            <Icon className="h-3 w-3" aria-hidden="true" />
            {label}
        </span>
    );
}

const stateOf = (doc?: DocumentItem): DocState => (doc ? (doc.status as DocState) : 'missing');

// Comfortable tap targets on touch screens, compact on larger ones.
const ACTION_BTN = 'min-h-[44px] flex-1 sm:min-h-0 sm:flex-none';
const FIELD = 'h-11 w-full rounded-md border border-gray-300 px-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:h-9 sm:text-sm';
const ICON_BTN = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:h-8 sm:w-8';
const LINK_BTN = 'inline-flex min-h-[44px] items-center text-xs font-medium text-emerald-700 hover:underline sm:min-h-0';
const DROPZONE = 'mt-3 flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 p-3 text-center text-xs text-gray-500 hover:border-emerald-400 hover:text-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600';
const SHORT = '[@media(max-height:500px)]:hidden';

const ADDITIONAL_TYPES = [
    { value: 'confiscation_order',          label: 'Confiscation Order',          description: 'Issued by PENRO for automatic confiscation.' },
    { value: 'forfeiture_order',            label: 'Forfeiture Order',            description: 'Court-issued forfeiture of the seized asset.' },
    { value: 'regional_confiscation_order', label: 'Regional Confiscation Order', description: 'Issued at the regional level for multi-area cases.' },
    { value: 'court_order',                 label: 'Court Order',                 description: 'Any court order related to the case.' },
    { value: 'certificate_of_finality',     label: 'Certificate of Finality',     description: 'Certifies that the decision is final and executory.' },
    { value: 'other',                       label: 'Other Supporting Document',   description: 'Any other relevant supporting document.' },
];

export default function RequiredDocumentsModal({
    show,
    onClose,
    assetId,
    requiredTypes,
    documents,
    canUpload,
    canVerify,
}: RequiredDocumentsModalProps) {
    const uploadForm = useForm<{ document_type: string; file: File | null; aap_number: string; stcp_number: string }>({
        document_type: '',
        file: null,
        aap_number: '',
        stcp_number: '',
    });

    const [aapNumber, setAapNumber] = useState('');
    const [stcpNumber, setStcpNumber] = useState('');
    const [evidenceType, setEvidenceType] = useState('');

    const verifyForm = useForm<{ decision: string; remarks: string }>({
        decision: '',
        remarks: '',
    });

    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [pendingUpload, setPendingUpload] = useState<{ type: string; file: File; previewUrl: string; isImage: boolean } | null>(null);
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

    function latestDocFor(type: string): DocumentItem | undefined {
        return documents
            .filter((d) => d.document_type === type)
            .sort((a, b) => b.id - a.id)[0];
    }

    function toggleExpanded(type: string) {
        setExpandedTypes((prev) => {
            const next = new Set(prev);
            next.has(type) ? next.delete(type) : next.add(type);
            return next;
        });
    }

    function handleFileSelected(type: string, e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (pendingUpload) URL.revokeObjectURL(pendingUpload.previewUrl);
        setPendingUpload({
            type,
            file,
            previewUrl: URL.createObjectURL(file),
            isImage: file.type.startsWith('image/'),
        });
    }

    function confirmUpload() {
        if (!pendingUpload) return;
        uploadForm.setData({
            document_type: pendingUpload.type,
            file: pendingUpload.file,
            aap_number: pendingUpload.type === 'aap_document' ? aapNumber : '',
            stcp_number: pendingUpload.type === 'stcp_document' ? stcpNumber : '',
        });
        uploadForm.post(route('assets.required-documents.store', assetId), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                uploadForm.reset();
                URL.revokeObjectURL(pendingUpload.previewUrl);
                setPendingUpload(null);
                setAapNumber('');
                setStcpNumber('');
                setEvidenceType('');
            },
        });
    }

    function cancelUpload() {
        if (pendingUpload) URL.revokeObjectURL(pendingUpload.previewUrl);
        setPendingUpload(null);
    }

    function approve(documentId: number) {
        if (!confirm('Mark this document as verified?')) return;
        verifyForm.transform(() => ({ decision: 'verified', remarks: '' }));
        verifyForm.post(route('documents.verify', documentId), { preserveScroll: true });
    }

    function submitRejection(e: FormEvent, documentId: number) {
        e.preventDefault();
        verifyForm.transform((data) => ({ decision: 'rejected', remarks: data.remarks }));
        verifyForm.post(route('documents.verify', documentId), {
            preserveScroll: true,
            onSuccess: () => {
                setRejectingId(null);
                verifyForm.reset();
            },
        });
    }

    // ── Derived progress ─────────────────────────────────────────────────────

    const requiredStates = requiredTypes.map((t) => stateOf(latestDocFor(t.value)));
    const totalRequired = requiredTypes.length;
    const countOf = (s: DocState) => requiredStates.filter((x) => x === s).length;
    const verifiedCount = countOf('verified');
    const allVerified = totalRequired > 0 && verifiedCount === totalRequired;
    const pct = totalRequired > 0 ? Math.round((verifiedCount / totalRequired) * 100) : 0;
    const breakdown = (['pending', 'rejected', 'missing'] as DocState[])
        .filter((s) => countOf(s) > 0)
        .map((s) => `${countOf(s)} ${STATE_META[s].label.toLowerCase()}`)
        .join(' · ');

    const REQUIRED_TYPE_VALUES = new Set(requiredTypes.map((t) => t.value));
    const generalEvidence = documents.filter((d) => !d.document_type || !REQUIRED_TYPE_VALUES.has(d.document_type));

    // ── Shared render helpers ────────────────────────────────────────────────

    function renderPendingUpload(withNumbers: boolean) {
        if (!pendingUpload) return null;
        const isAap = withNumbers && pendingUpload.type === 'aap_document';
        const isStcp = withNumbers && pendingUpload.type === 'stcp_document';

        return (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-medium text-emerald-800">Confirm this is the right file:</p>
                <div className="mt-2 flex min-w-0 items-center gap-3">
                    {pendingUpload.isImage ? (
                        <img src={pendingUpload.previewUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                    ) : (
                        <PdfBadge className="h-10 w-10 shrink-0" />
                    )}
                    <p className="min-w-0 flex-1 break-all text-xs text-gray-700">{pendingUpload.file.name}</p>
                </div>

                {isAap && (
                    <div className="mt-3">
                        <label htmlFor="aap-number" className="mb-1 block text-xs font-medium text-emerald-800">
                            AAP Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="aap-number"
                            type="text"
                            value={aapNumber}
                            onChange={(e) => setAapNumber(e.target.value)}
                            placeholder="e.g. AAP-FV-2026-00001"
                            className={FIELD}
                        />
                        {uploadForm.errors.aap_number && (
                            <p className="mt-1 text-xs text-red-600">{uploadForm.errors.aap_number}</p>
                        )}
                    </div>
                )}

                {isStcp && (
                    <div className="mt-3">
                        <label htmlFor="stcp-number" className="mb-1 block text-xs font-medium text-emerald-800">
                            STCP Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="stcp-number"
                            type="text"
                            value={stcpNumber}
                            onChange={(e) => setStcpNumber(e.target.value)}
                            placeholder="e.g. STCP-2026-0001"
                            className={FIELD}
                        />
                        {uploadForm.errors.stcp_number && (
                            <p className="mt-1 text-xs text-red-600">{uploadForm.errors.stcp_number}</p>
                        )}
                    </div>
                )}

                <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
                    <Button type="button" size="sm" variant="outline" className={ACTION_BTN} onClick={cancelUpload}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className={ACTION_BTN}
                        onClick={confirmUpload}
                        disabled={
                            uploadForm.processing ||
                            (isAap && !aapNumber.trim()) ||
                            (isStcp && !stcpNumber.trim())
                        }
                    >
                        {uploadForm.processing ? 'Uploading…' : 'Confirm Upload'}
                    </Button>
                </div>
            </div>
        );
    }

    function renderVerifyControls(doc: DocumentItem) {
        if (!canVerify) return null;
        return (
            <>
                {doc.status === 'pending' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button type="button" size="sm" className={ACTION_BTN} onClick={() => approve(doc.id)}>
                            Approve
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className={ACTION_BTN}
                            onClick={() => setRejectingId(rejectingId === doc.id ? null : doc.id)}
                        >
                            Reject
                        </Button>
                    </div>
                )}

                {rejectingId === doc.id && (
                    <form onSubmit={(e) => submitRejection(e, doc.id)} className="mt-3 space-y-2">
                        <textarea
                            value={verifyForm.data.remarks}
                            onChange={(e) => verifyForm.setData('remarks', e.target.value)}
                            placeholder="Explain what needs to be corrected before MES re-submits..."
                            aria-label="Rejection remarks"
                            className="w-full rounded-md border border-gray-300 p-2 text-base sm:text-sm"
                            rows={3}
                            required
                        />
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button type="button" size="sm" variant="outline" className={ACTION_BTN} onClick={() => setRejectingId(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" variant="destructive" className={ACTION_BTN} disabled={verifyForm.processing}>
                                Send Back to MES
                            </Button>
                        </div>
                    </form>
                )}
            </>
        );
    }

    function renderUploader(doc: DocumentItem) {
        if (!doc.uploaded_by) return null;
        return (
            <p className="mt-1.5 break-words text-xs text-gray-500">
                Uploaded by <span className="font-medium text-gray-700">{doc.uploaded_by.name}</span>
                {doc.verified_by && doc.status === 'verified' && (
                    <> · Verified by <span className="font-medium text-gray-700">{doc.verified_by.name}</span></>
                )}
            </p>
        );
    }

    function renderRemarks(doc: DocumentItem) {
        if (doc.status !== 'rejected' || !doc.remarks) return null;
        return (
            <p className="mt-2 break-words rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
                <span className="font-semibold">Remarks: </span>{doc.remarks}
            </p>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <Modal show={show} onClose={onClose} maxWidth="2xl">
            {/* 6rem = Modal container py-6 + panel mb-6 */}
            <div className="flex max-h-[calc(100dvh-6rem)] min-h-0 flex-col">
                {/* Header (always visible) */}
                <div className="shrink-0 border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <DialogTitle as="h2" className="text-base font-medium text-gray-900 sm:text-lg">
                                Upload Documents
                            </DialogTitle>
                            <p className={`mt-0.5 text-sm text-gray-600 ${SHORT}`}>
                                Upload required documents and any supporting evidence for this asset.
                            </p>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close" className={ICON_BTN}>
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>

                    {totalRequired > 0 && (
                        <div className="mt-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5" aria-live="polite">
                                <p className={`text-sm font-semibold ${allVerified ? 'text-emerald-700' : 'text-gray-900'}`}>
                                    {verifiedCount} of {totalRequired} verified
                                </p>
                                {breakdown && <p className="text-xs text-gray-500">{breakdown}</p>}
                            </div>
                            <div
                                role="progressbar"
                                aria-label="Required documents verified"
                                aria-valuemin={0}
                                aria-valuemax={totalRequired}
                                aria-valuenow={verifiedCount}
                                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
                            >
                                <div
                                    className="h-full rounded-full bg-emerald-500 transition-all"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Scrollable body */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                    {totalRequired > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Required Documents
                            </p>

                            {requiredTypes.map((type) => {
                                const doc = latestDocFor(type.value);
                                const state = stateOf(doc);
                                const url = doc ? documentUrl(doc.file_path) : null;
                                const isImage = doc?.mime_type?.startsWith('image/');
                                const isUploaded = !!doc && doc.status !== 'rejected';
                                const isExpanded = expandedTypes.has(type.value);

                                // Collapsed row: already uploaded (pending or verified)
                                if (doc && isUploaded && !isExpanded) {
                                    const expandable = canVerify || (canUpload && doc.status === 'pending');
                                    return (
                                        <div
                                            key={type.value}
                                            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 sm:px-4"
                                        >
                                            <div className="min-w-0 flex-1 basis-40">
                                                <p className="break-words text-sm font-medium text-gray-800">{type.label}</p>
                                                {doc.uploaded_by && (
                                                    <p className="break-words text-xs text-gray-500">by {doc.uploaded_by.name}</p>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-3">
                                                <StatusPill state={state} />
                                                {url && (
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_BTN}>
                                                        View<span className="sr-only"> {type.label}</span>
                                                    </a>
                                                )}
                                                {expandable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpanded(type.value)}
                                                        aria-expanded={false}
                                                        aria-label={`Show details and actions for ${type.label}`}
                                                        className={ICON_BTN}
                                                    >
                                                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                // Expanded / needs-action card
                                return (
                                    <div key={type.value} className="rounded-lg border border-gray-200 p-3 sm:p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <p className="break-words text-sm font-semibold text-gray-800">{type.label}</p>
                                                    <StatusPill state={state} />
                                                </div>

                                                {type.value === 'aap_document' && !doc && (
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        Upload the scanned copy once received.
                                                        The asset cannot be tagged until this is verified.
                                                    </p>
                                                )}

                                                {doc ? (
                                                    url && (
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_BTN}>
                                                            View file
                                                        </a>
                                                    )
                                                ) : (
                                                    <p className="mt-1 text-xs text-gray-500">Not yet uploaded.</p>
                                                )}

                                                {doc && renderRemarks(doc)}
                                                {doc && renderUploader(doc)}
                                            </div>

                                            <div className="flex shrink-0 items-center gap-1">
                                                {doc && !isImage && <PdfBadge className="h-9 w-9 shrink-0" />}
                                                {isUploaded && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpanded(type.value)}
                                                        aria-expanded={true}
                                                        aria-label={`Hide details and actions for ${type.label}`}
                                                        className={ICON_BTN}
                                                    >
                                                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {canUpload && (!doc || doc.status === 'rejected' || doc.status === 'pending') && (
                                            <label className={DROPZONE}>
                                                <UploadCloud className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                <span>
                                                    {doc?.status === 'rejected'
                                                        ? 'Re-upload corrected document'
                                                        : doc?.status === 'pending'
                                                        ? 'Re-upload document'
                                                        : 'Upload document'}
                                                </span>
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp,application/pdf"
                                                    className="sr-only"
                                                    onChange={(e) => handleFileSelected(type.value, e)}
                                                />
                                            </label>
                                        )}

                                        {pendingUpload?.type === type.value && renderPendingUpload(true)}

                                        {doc && renderVerifyControls(doc)}
                                    </div>
                                );
                            })}

                            <p className={`pt-1 text-sm font-medium ${allVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {allVerified
                                    ? 'All required documents verified. Ready for storage.'
                                    : 'Waiting on document upload/verification before this asset can be tagged.'}
                            </p>
                        </div>
                    )}

                    {/* Additional evidence */}
                    <div className={totalRequired > 0 ? 'mt-6 border-t border-gray-100 pt-6' : ''}>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Additional Evidence
                        </p>

                        {canUpload && (
                            <div className="space-y-3">
                                <div>
                                    <label htmlFor="evidence-type" className="mb-1 block text-xs font-medium text-gray-700">
                                        Document type
                                    </label>
                                    <select
                                        id="evidence-type"
                                        value={evidenceType}
                                        onChange={(e) => setEvidenceType(e.target.value)}
                                        className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 sm:h-9 sm:text-sm"
                                    >
                                        <option value="">Select type…</option>
                                        {ADDITIONAL_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                    {evidenceType && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            {ADDITIONAL_TYPES.find((t) => t.value === evidenceType)?.description}
                                        </p>
                                    )}
                                </div>

                                {evidenceType && (
                                    <label className={DROPZONE.replace('mt-3 ', '')}>
                                        <UploadCloud className="h-4 w-4 shrink-0" aria-hidden="true" />
                                        <span>Upload file</span>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,application/pdf"
                                            className="sr-only"
                                            onChange={(e) => handleFileSelected(evidenceType, e)}
                                        />
                                    </label>
                                )}

                                {pendingUpload && ADDITIONAL_TYPES.some((t) => t.value === pendingUpload.type) &&
                                    renderPendingUpload(false)}
                            </div>
                        )}

                        {generalEvidence.length > 0 ? (
                            <div className="mt-3 space-y-3">
                                {generalEvidence.map((doc) => {
                                    const url = documentUrl(doc.file_path);
                                    const isImage = doc.mime_type?.startsWith('image/');
                                    return (
                                        <div key={doc.id} className="rounded-lg border border-gray-200 p-3">
                                            <div className="flex items-start gap-3">
                                                <a
                                                    href={url ?? '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title={doc.original_name}
                                                    className="block h-14 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 sm:h-16 sm:w-16"
                                                >
                                                    {isImage ? (
                                                        <img src={url ?? ''} alt={doc.original_name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center bg-gray-50">
                                                            <PdfBadge className="h-7 w-7 shrink-0" />
                                                        </div>
                                                    )}
                                                </a>

                                                <div className="min-w-0 flex-1">
                                                    <p className="break-all text-xs font-medium text-gray-700">
                                                        {doc.original_name}
                                                    </p>
                                                    {doc.document_type && (
                                                        <p className="break-words text-xs text-gray-500">
                                                            {ADDITIONAL_TYPES.find((t) => t.value === doc.document_type)?.label ?? doc.document_type}
                                                        </p>
                                                    )}
                                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <StatusPill state={stateOf(doc)} />
                                                        {url && (
                                                            <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_BTN}>
                                                                View file
                                                            </a>
                                                        )}
                                                    </div>
                                                    {renderRemarks(doc)}
                                                    {renderUploader(doc)}
                                                </div>
                                            </div>

                                            {renderVerifyControls(doc)}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            !canUpload && <p className="mt-2 text-sm text-gray-500">No additional evidence uploaded yet.</p>
                        )}
                    </div>
                </div>

                {/* Footer (always visible, hidden on very short viewports; X in header remains) */}
                <div className={`flex shrink-0 items-center justify-end border-t border-gray-100 px-4 py-3 sm:px-6 ${SHORT}`}>
                    <Button type="button" variant="outline" className="min-h-[44px] w-full sm:min-h-0 sm:w-auto" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
}