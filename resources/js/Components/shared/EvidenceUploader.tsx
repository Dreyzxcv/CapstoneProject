// resources/js/Components/shared/EvidenceUploader.tsx
import { useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import InputError from '@/Components/InputError';
import { ChangeEvent, FormEvent, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

export function EvidenceUploader({ assetId }: { assetId: number }) {
    const { data, setData, post, processing, errors, reset } = useForm<{ photos: File[] }>({
        photos: [],
    });
    const [previews, setPreviews] = useState<string[]>([]);

    function handleFiles(e: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        setData('photos', files);
        setPreviews(files.map((f) => URL.createObjectURL(f)));
    }

    function removeFile(index: number) {
        const next = data.photos.filter((_, i) => i !== index);
        setData('photos', next);
        setPreviews(next.map((f) => URL.createObjectURL(f)));
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
                Add evidence photos
                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFiles}
                />
            </label>
            <InputError message={errors.photos as string | undefined} />

            {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {previews.map((src, i) => (
                        <div key={i} className="group relative">
                            <img src={src} className="h-20 w-full rounded-md object-cover" />
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
                    {processing ? 'Uploading…' : `Upload ${data.photos.length} photo(s)`}
                </Button>
            )}
        </form>
    );
}