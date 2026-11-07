import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Same pulse style as Incidents/Create.tsx. */
export const NF_HIGHLIGHT_CSS = `
@keyframes nfPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.45); }
    50%      { box-shadow: 0 0 0 6px rgba(5, 150, 105, 0); }
}
.nf-highlight {
    border-color: #059669 !important;
    animation: nfPulse 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
    .nf-highlight { animation: none; box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.35); }
}
`;

export function cx(...parts: Array<string | false | null | undefined>): string | undefined {
    const out = parts.filter(Boolean).join(' ');
    return out || undefined;
}

interface StoredDraft<T> {
    data: Partial<T>;
    step: number;
    savedAt?: number;
}

interface UseWizardDraftOptions<T> {
    storageKey: string;
    data: T;
    step: number;
    /** Inertia's `isDirty`. A pristine form on step 0 is never stored. */
    isDirty: boolean;
    /** Strip non-serializable values (File objects) before saving. */
    serialize?: (data: T) => T;
    /** Apply a stored draft to the form. Must sanitize anything stale. */
    onRestore: (data: Partial<T>, step: number) => void;
}

export function useWizardDraft<T>(options: UseWizardDraftOptions<T>) {
    const { storageKey, data, step, isDirty } = options;
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const [saved, setSaved] = useState<StoredDraft<T> | null>(null);
    // Autosave stays off until the user has answered the restore prompt
    // (or there was no draft), so the stored draft is never overwritten
    // by the initial empty form.
    const [resolved, setResolved] = useState(false);
    const stopped = useRef(false);

    const remove = useCallback(() => {
        try {
            localStorage.removeItem(storageKey);
        } catch {}
    }, [storageKey]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') {
                    setSaved(parsed);
                    return;
                }
                localStorage.removeItem(storageKey);
            }
        } catch {}
        setResolved(true);
    }, [storageKey]);

    useEffect(() => {
        if (!resolved || stopped.current) return;
        try {
            if (!isDirty && step === 0) {
                localStorage.removeItem(storageKey);
                return;
            }
            const { serialize } = optionsRef.current;
            localStorage.setItem(
                storageKey,
                JSON.stringify({ data: serialize ? serialize(data) : data, step, savedAt: Date.now() }),
            );
        } catch {}
    }, [data, step, isDirty, resolved, storageKey]);

    const restore = useCallback(() => {
        if (saved) {
            try {
                const s = Number.isFinite(saved.step) ? Math.max(0, Math.floor(saved.step)) : 0;
                optionsRef.current.onRestore(saved.data, s);
            } catch {
                remove();
            }
        }
        setSaved(null);
        setResolved(true);
    }, [saved, remove]);

    const startFresh = useCallback(() => {
        remove();
        setSaved(null);
        setResolved(true);
    }, [remove]);

    /** Call after a successful submit: deletes the draft and stops autosave. */
    const clear = useCallback(() => {
        stopped.current = true;
        remove();
    }, [remove]);

    return { promptOpen: saved !== null && !resolved, restore, startFresh, discard: remove, clear };
}

export function DraftRestoreModal({
    show,
    onRestore,
    onStartFresh,
    note,
}: {
    show: boolean;
    onRestore: () => void;
    onStartFresh: () => void;
    note?: string;
}) {
    return (
        // Deliberately not dismissible: the user must pick one option.
        <Modal show={show} onClose={() => {}} maxWidth="sm">
            <div className="p-6">
                <h2 className="text-base font-semibold text-gray-900">Restore unsaved draft?</h2>
                <p className="mt-1 text-sm text-gray-600">
                    You have an unfinished form. Would you like to continue where you left off?
                </p>
                {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
                <div className="mt-5 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={onStartFresh}>
                        Start Fresh
                    </Button>
                    <Button type="button" onClick={onRestore}>
                        Restore Draft
                    </Button>
                </div>
            </div>
        </Modal>
    );
}