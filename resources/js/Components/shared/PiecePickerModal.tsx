import { useState, useEffect } from 'react';
import { Button } from '@/Components/ui/button';
import { Checkbox } from '@/Components/ui/checkbox';

export interface AssetPieceData {
    id: number;
    piece_number: number;
    species: string | null;
    description: string | null;
    length: number | null;
    width: number | null;
    height: number | null;
    volume_bd_ft: number | null;
    disposed_at: string | null;
}

interface PiecePickerModalProps {
    show: boolean;
    assetCode: string;
    totalPieces: number;
    pieces: AssetPieceData[];
    selectedIds: number[];
    onConfirm: (selectedIds: number[]) => void;
    onClose: () => void;
}

export default function PiecePickerModal({
    show,
    assetCode,
    totalPieces,
    pieces,
    selectedIds,
    onConfirm,
    onClose,
}: PiecePickerModalProps) {
    const [local, setLocal] = useState<Set<number>>(new Set(selectedIds));

    useEffect(() => {
        if (show) setLocal(new Set(selectedIds));
    }, [show]);

    if (!show) return null;

    const available = pieces.filter((p) => !p.disposed_at);

    function toggle(id: number) {
        setLocal((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleAll() {
        const availableIds = available.map((p) => p.id);
        const allSelected = availableIds.every((id) => local.has(id));
        setLocal(allSelected ? new Set() : new Set(availableIds));
    }

    const allChecked = available.length > 0 && available.every((p) => local.has(p.id));
    const someChecked = available.some((p) => local.has(p.id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal panel */}
            <div className="relative z-10 mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">
                            Select Pieces — {assetCode}
                        </h2>
                        <p className="mt-0.5 text-xs text-gray-500">
                            {totalPieces} piece{totalPieces !== 1 ? 's' : ''} total ·{' '}
                            {available.length} available
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {pieces.length === 0 ? (
                        <p className="py-10 text-center text-sm text-gray-500">
                            No individual pieces recorded for this asset.
                        </p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="pb-2 pr-3 w-8 text-left">
                                        <Checkbox
                                            checked={allChecked}
                                            // shadcn Checkbox doesn't have indeterminate natively,
                                            // so we just show unchecked when partial
                                            onCheckedChange={toggleAll}
                                            disabled={available.length === 0}
                                        />
                                    </th>
                                    <th className="pb-2 pr-3 text-left font-medium text-gray-600">#</th>
                                    <th className="pb-2 pr-3 text-left font-medium text-gray-600">Species</th>
                                    <th className="pb-2 pr-3 text-left font-medium text-gray-600">
                                        L × W × H
                                    </th>
                                    <th className="pb-2 pr-3 text-right font-medium text-gray-600">
                                        Vol (bd ft)
                                    </th>
                                    <th className="pb-2 text-left font-medium text-gray-600">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pieces.map((piece) => {
                                    const disposed = !!piece.disposed_at;
                                    const checked = local.has(piece.id);
                                    const dims = [piece.length, piece.width, piece.height]
                                        .map((v) => (v != null ? v : '—'))
                                        .join(' × ');

                                    return (
                                        <tr
                                            key={piece.id}
                                            onClick={() => !disposed && toggle(piece.id)}
                                            className={[
                                                'transition-colors',
                                                disposed
                                                    ? 'opacity-40 cursor-not-allowed'
                                                    : 'cursor-pointer hover:bg-gray-50',
                                                checked && !disposed ? 'bg-emerald-50' : '',
                                            ].join(' ')}
                                        >
                                            <td className="py-2.5 pr-3">
                                                <Checkbox
                                                    checked={checked}
                                                    disabled={disposed}
                                                    onCheckedChange={() => toggle(piece.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </td>
                                            <td className="py-2.5 pr-3 font-medium text-gray-900">
                                                {piece.piece_number}
                                            </td>
                                            <td className="py-2.5 pr-3 text-gray-700">
                                                {piece.species ?? piece.description ?? '—'}
                                            </td>
                                            <td className="py-2.5 pr-3 font-mono text-xs text-gray-500">
                                                {dims}
                                            </td>
                                            <td className="py-2.5 pr-3 text-right text-gray-700">
                                                {piece.volume_bd_ft != null
                                                    ? piece.volume_bd_ft.toFixed(2)
                                                    : '—'}
                                            </td>
                                            <td className="py-2.5">
                                                {disposed ? (
                                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                                                        Disposed
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                        Available
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                    <span className="text-sm text-gray-500">
                        {local.size} piece{local.size !== 1 ? 's' : ''} selected
                    </span>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={local.size === 0}
                            onClick={() => onConfirm(Array.from(local))}
                        >
                            Confirm Selection
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}