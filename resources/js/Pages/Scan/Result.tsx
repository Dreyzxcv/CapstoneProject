import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import { Asset } from '@/types';
import { Head, Link } from '@inertiajs/react';

interface AssetPiece {
    id: number;
    piece_number: number;
    species?: string | null;
    equipment_type?: string | null;
    vehicle_type?: string | null;
    description?: string | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    volume_bd_ft?: number | null;
    volume_cu_m?: number | null;
    estimated_value?: number | null;
    plate_number?: string | null;
    serial_number?: string | null;
    disposed_at?: string | null;
}

interface ScanResultProps {
    asset: Asset;
    token: string;
    piece?: AssetPiece | null;
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="flex justify-between gap-2 py-1.5 text-sm border-b border-gray-100 last:border-0">
            <span className="text-gray-500 shrink-0">{label}</span>
            <span className="text-gray-900 font-medium text-right">{value}</span>
        </div>
    );
}

export default function ScanResult({ asset, token, piece }: ScanResultProps) {
    const isPiece = piece !== null && piece !== undefined;

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Scan Result</h2>}>
            <Head title="Scan Result" />

            <div className="mx-auto max-w-lg space-y-4 px-4 sm:px-6 lg:px-8">

                {/* Valid QR banner */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-medium text-emerald-900">Valid QR code — scan logged</p>
                    <div className="flex items-baseline gap-3 mt-1">
                        <p className="text-sm text-emerald-800">{asset.asset_code}</p>
                        {isPiece && (
                            <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                                Piece {piece.piece_number} / {asset.quantity ?? 1}
                            </span>
                        )}
                    </div>
                    <div className="mt-2">
                        <AssetStatusBadge
                            status={asset.current_status}
                            label={asset.current_status.replace(/_/g, ' ')}
                        />
                    </div>
                </div>

                {/* Piece details -- only when scanned via piece QR */}
                {isPiece && (
                    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                            Piece Details
                        </p>
                        <DetailRow label="Piece No." value={piece.piece_number} />
                        <DetailRow label="Species" value={piece.species} />
                        <DetailRow label="Equipment Type" value={piece.equipment_type} />
                        <DetailRow label="Vehicle Type" value={piece.vehicle_type} />
                        <DetailRow label="Description" value={piece.description} />
                        <DetailRow label="Length" value={piece.length != null ? `${piece.length} m` : null} />
                        <DetailRow label="Width" value={piece.width != null ? `${piece.width} m` : null} />
                        <DetailRow label="Height" value={piece.height != null ? `${piece.height} m` : null} />
                        <DetailRow label="Volume (bd ft)" value={piece.volume_bd_ft} />
                        <DetailRow label="Volume (cu m)" value={piece.volume_cu_m} />
                        <DetailRow label="Est. Value" value={piece.estimated_value != null ? `₱${piece.estimated_value.toLocaleString()}` : null} />
                        <DetailRow label="Plate No." value={piece.plate_number} />
                        <DetailRow label="Serial No." value={piece.serial_number} />
                        {piece.disposed_at && (
                            <DetailRow label="Disposed At" value={new Date(piece.disposed_at).toLocaleDateString()} />
                        )}
                    </div>
                )}

                {/* Show full record button only for asset-level scans */}
                {!isPiece && (
                    <Link href={route('assets.show', asset.id)}>
                        <Button variant="outline" className="w-full">
                            View Full Asset Record
                        </Button>
                    </Link>
                )}
            </div>
        </AuthenticatedLayout>
    );
}