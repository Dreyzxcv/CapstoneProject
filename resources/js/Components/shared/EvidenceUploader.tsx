// resources/js/Components/shared/EvidenceUploader.tsx
import { useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import InputError from '@/Components/InputError';
import { PdfBadge } from '@/Components/shared/PdfBadge';
import { ChangeEvent, DragEvent, FormEvent, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

interface FilePreview {
    file: File;
    url: string;
    isImage: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

export function EvidenceUploader({ assetId }: { assetId: number }) {
    const { data, setData, post, processing, errors, reset } = useForm<{ photos: File[] }>({
        photos: [],
    });
    const [previews, setPreviews] = useState<FilePreview[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    // Errors for array fields come back keyed as "photos.0", "photos.1", etc.,
    // not "photos" itself — pull out any of those plus the top-level key.
    const photoErrors = Object.entries(errors)
        .filter(([key]) => key === 'photos' || key.startsWith('photos.'))
        .map(([, message]) => message)
        .filter(Boolean);

    function buildPreviews(files: File[]): FilePreview[] {
        return files.map((file) => ({
            file,
            url: URL.createObjectURL(file),
            isImage: file.type.startsWith('image/'),
        }));
    }

    function addFiles(incoming: File[]) {
        const accepted = incoming.filter((file) => ACCEPTED_TYPES.includes(file.type));
        if (accepted.length === 0) return;

        // Merge with what's already selected rather than replacing, so
        // repeated drag-and-drops (or drag then browse) stack up.
        const merged = [...data.photos, ...accepted].slice(0, 10);
        setData('photos', merged);
        setPreviews(buildPreviews(merged));
    }

    function handleFiles(e: ChangeEvent<HTMLInputElement>) {
        addFiles(Array.from(e.target.files ?? []));
        e.target.value = '';
    }

    function handleDragOver(e: DragEvent<HTMLLabelElement>) {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    }

    function handleDragLeave(e: DragEvent<HTMLLabelElement>) {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    }

    function handleDrop(e: DragEvent<HTMLLabelElement>) {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        addFiles(Array.from(e.dataTransfer.files ?? []));
    }

    function removeFile(index: number) {
        const next = data.photos.filter((_, i) => i !== index);
        setData('photos', next);
        setPreviews(buildPreviews(next));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        post(route('assets.documents.store', assetId), {
            forceFormData: true,
            onSuccess: () => {
                reset();
                setPreviews([]);
            },
        });
    }

    return (
        <form onSubmit={submit} className="space-y-3">
            <label
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={
                    'flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm transition ' +
                    (isDraggingOver
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600')
                }
            >
                <ImagePlus className="h-5 w-5" />
                {isDraggingOver
                    ? 'Drop files to add them'
                    : 'Add evidence photos or documents (Confiscation/Forfeiture Order, etc.) — or drag & drop here'}
                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    multiple
                    className="hidden"
                    onChange={handleFiles}
                />
            </label>
            {photoErrors.map((message, i) => (
                <InputError key={i} message={message as string} />
            ))}

            {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {previews.map((preview, i) => (
                        <div key={i} className="group relative" title={preview.file.name}>
                            {preview.isImage ? (
                                <img src={preview.url} className="h-20 w-full rounded-md object-cover" />
                            ) : (
                                <div className="flex h-20 w-full items-center justify-center rounded-md border border-gray-200 bg-gray-50">
                                    <PdfBadge className="h-9 w-9" />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => removeFile(i)}
                                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {data.photos.length > 0 && (
                <Button type="submit" disabled={processing} size="sm">
                    {processing ? 'Uploading…' : `Upload ${data.photos.length} file(s)`}
                </Button>
            )}
        </form>
    );
}