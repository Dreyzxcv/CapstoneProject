// resources/js/Components/shared/EvidenceUploader.tsx
import { useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import InputError from '@/Components/InputError';
import { ChangeEvent, FormEvent, useState } from 'react';
import { FileText, ImagePlus, X } from 'lucide-react';

interface FilePreview {
    file: File;
    url: string;
    isImage: boolean;
}

export function EvidenceUploader({ assetId }: { assetId: number }) {
    const { data, setData, post, processing, errors, reset } = useForm<{ photos: File[] }>({
        photos: [],
    });
    const [previews, setPreviews] = useState<FilePreview[]>([]);

    function buildPreviews(files: File[]): FilePreview[] {
        return files.map((file) => ({
            file,
            url: URL.createObjectURL(file),
            isImage: file.type.startsWith('image/'),
        }));
    }

    function handleFiles(e: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        setData('photos', files);
        setPreviews(buildPreviews(files));
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
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
                <ImagePlus className="h-5 w-5" />
                Add evidence photos or documents (Confiscation/Forfeiture Order, etc.)
                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    multiple
                    className="hidden"
                    onChange={handleFiles}
                />
            </label>
            <InputError message={errors.photos as string | undefined} />

            {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {previews.map((preview, i) => (
                        <div key={i} className="group relative">
                            {preview.isImage ? (
                                <img src={preview.url} className="h-20 w-full rounded-md object-cover" />
                            ) : (
                                <div className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1 text-center">
                                    <FileText className="h-5 w-5 text-gray-400" />
                                    <p className="line-clamp-2 text-[10px] leading-tight text-gray-600">
                                        {preview.file.name}
                                    </p>
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