import { useState, FormEvent, ChangeEvent } from 'react';
import { useForm } from '@inertiajs/react';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { PdfBadge } from '@/Components/shared/PdfBadge';
import { documentUrl } from '@/lib/utils';
import { DocumentItem } from '@/types';
import { CheckCircle2, XCircle, UploadCloud, Clock } from 'lucide-react';

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

export default function RequiredDocumentsModal({
    show,
    onClose,
    assetId,
    requiredTypes,
    documents,
    canUpload,
    canVerify,
}: RequiredDocumentsModalProps) {
    const uploadForm = useForm<{ document_type: string; file: File | null }>({
        document_type: '',
        file: null,
    });

    const verifyForm = useForm<{ decision: string; remarks: string }>({
        decision: '',
        remarks: '',
    });

    const [rejectingId, setRejectingId] = useState<number | null>(null);

    function latestDocFor(type: string): DocumentItem | undefined {
        return documents
            .filter((d) => d.document_type === type)
            .sort((a, b) => b.id - a.id)[0];
    }

    function handleUpload(type: string, e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        uploadForm.setData({ document_type: type, file });
        uploadForm.post(route('assets.required-documents.store', assetId), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => uploadForm.reset(),
        });
        e.target.value = '';
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

    const allVerified = requiredTypes.every((t) => latestDocFor(t.value)?.status === 'verified');

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900">Required Documents</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Upload and verify the documents required before this asset can be marked as stored.
                </p>

                <div className="mt-6 space-y-4">
                    {requiredTypes.length === 0 && (
                        <p className="text-sm text-gray-500">No additional documents are required for this asset.</p>
                    )}

                    {requiredTypes.map((type) => {
                        const doc = latestDocFor(type.value);
                        const url = doc ? documentUrl(doc.file_path) : null;
                        const isImage = doc?.mime_type?.startsWith('image/');

                        return (
                            <div key={type.value} className="rounded-lg border border-gray-200 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">{type.label}</p>
                                        {doc ? (
                                            <div className="mt-1 flex items-center gap-2">
                                                <Badge
                                                    variant={doc.status === 'verified' ? 'green' : 'amber'}
                                                    className={doc.status === 'rejected' ? 'bg-red-100 text-red-800' : undefined}
                                                >
                                                    {doc.status === 'pending' && <Clock className="mr-1 inline h-3 w-3" />}
                                                    {doc.status === 'verified' && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                                                    {doc.status === 'rejected' && <XCircle className="mr-1 inline h-3 w-3" />}
                                                    {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                                                </Badge>
                                                {url && (
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 hover:underline">
                                                        View file
                                                    </a>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="mt-1 text-xs text-gray-500">Not yet uploaded.</p>
                                        )}
                                        {doc?.status === 'rejected' && doc.remarks && (
                                            <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
                                                <span className="font-semibold">Remarks: </span>{doc.remarks}
                                            </p>
                                        )}
                                    </div>

                                    {doc && !isImage && <PdfBadge className="h-9 w-9 shrink-0" />}
                                </div>

                                {canUpload && (!doc || doc.status === 'rejected') && (
                                    <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 p-3 text-xs text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
                                        <UploadCloud className="h-4 w-4" />
                                        {doc?.status === 'rejected' ? 'Re-upload corrected document' : 'Upload document'}
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,application/pdf"
                                            className="hidden"
                                            onChange={(e) => handleUpload(type.value, e)}
                                        />
                                    </label>
                                )}

                                {canVerify && doc && doc.status === 'pending' && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Button type="button" size="sm" onClick={() => approve(doc.id)}>
                                            Approve
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => setRejectingId(rejectingId === doc.id ? null : doc.id)}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                )}

                                {canVerify && rejectingId === doc?.id && (
                                    <form onSubmit={(e) => submitRejection(e, doc!.id)} className="mt-3 space-y-2">
                                        <textarea
                                            value={verifyForm.data.remarks}
                                            onChange={(e) => verifyForm.setData('remarks', e.target.value)}
                                            placeholder="Explain what needs to be corrected before MES re-submits..."
                                            className="w-full rounded-md border border-gray-300 p-2 text-sm"
                                            rows={2}
                                            required
                                        />
                                        <div className="flex gap-2">
                                            <Button type="submit" size="sm" variant="destructive" disabled={verifyForm.processing}>
                                                Send Back to MES
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" onClick={() => setRejectingId(null)}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                    <p className={`text-sm font-medium ${allVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {allVerified
                            ? 'All required documents verified — ready for storage.'
                            : 'Waiting on document upload/verification before this asset can be stored.'}
                    </p>
                    <Button type="button" variant="outline" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
}