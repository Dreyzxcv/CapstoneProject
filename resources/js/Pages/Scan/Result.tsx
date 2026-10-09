import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetStatusBadge } from '@/Components/shared/AssetStatusBadge';
import { Button } from '@/Components/ui/button';
import type { Asset, AssetPiece } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Box, CheckCircle2, FileText, Layers, MapPin, QrCode, Ruler, Tag } from 'lucide-react';
import { ReactNode } from 'react';

interface ScanResultProps {
    asset: Asset;
    token: string;
    piece?: AssetPiece | null;
}

type Value = string | number | null | undefined;

const isFilled = (value: unknown) => value !== null && value !== undefined && value !== '';

const humanize = (value?: string | null) => (value ? value.replace(/_/g, ' ') : '');

function DetailRow({ label, value }: { label: string; value?: Value }) {
    if (!isFilled(value)) return null;
    return (
        <div className="flex justify-between gap-4 border-b border-gray-100 py-2.5 text-sm last:border-0">
            <span className="shrink-0 text-gray-500">{label}</span>
            <span className="text-right font-medium text-gray-900">{value}</span>
        </div>
    );
}

function StatTile({ label, value, unit }: { label: string; value?: Value; unit: string }) {
    if (!isFilled(value)) return null;
    return (
        <div className="rounded-xl bg-gray-50 px-3 py-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-1 text-lg font-semibold leading-none text-gray-900">
                {Number(value).toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">{unit}</p>
        </div>
    );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-gray-400">
                {icon}
                <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
            </div>
            {children}
        </div>
    );
}

function ActionButtons({ assetId, className = '' }: { assetId: number; className?: string }) {
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <Link href={route('scan.index')}>
                <Button className="h-11 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                    <QrCode className="h-4 w-4" />
                    Scan Again
                </Button>
            </Link>
            <Link href={route('assets.show', assetId)}>
                <Button variant="outline" className="h-11 w-full gap-2">
                    <FileText className="h-4 w-4" />
                    View All Asset Details
                </Button>
            </Link>
        </div>
    );
}

export default function ScanResult({ asset, piece }: ScanResultProps) {
    const isPiece = piece !== null && piece !== undefined;

    // Piece scans show the piece's own measurements; asset scans show the asset's.
    const item = isPiece ? piece : asset;
    const serialNumber = isPiece ? piece.serial_number : null;

    const hasInfo = [item.species, item.equipment_type, item.vehicle_type, item.description].some(isFilled);
    const hasDimensions = [item.length, item.width, item.height].some(isFilled);
    const hasVolume = [item.volume_bd_ft, item.volume_cu_m].some(isFilled);
    const hasIdentifiers = [item.plate_number, serialNumber, item.estimated_value].some(isFilled);
    const hasSource = [asset.municipality_of_origin, asset.location_apprehended, asset.apprehending_agency, asset.mode].some(
        isFilled,
    );

    const quantityLabel = isFilled(asset.quantity)
        ? `${asset.quantity}${asset.quantity_unit ? ` ${asset.quantity_unit}` : ''}`
        : null;

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Scan Result</h2>}>
            <Head title="Scan Result" />

            {/* Mobile: single column + fixed action bar. Desktop: summary on the left, details on the right. */}
            <div className="mx-auto max-w-lg px-4 pb-32 sm:px-6 lg:max-w-5xl lg:px-8 lg:pb-8">
                <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
                    {/* Left column: summary + actions (desktop) */}
                    <div className="space-y-4 lg:sticky lg:top-6 lg:col-span-2">
                        {/* Hero card: green strip on top, white body so the status badge stays readable */}
                        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2 bg-emerald-600 px-4 py-2.5 text-white">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-sm font-medium">Valid QR code · scan logged</span>
                            </div>

                            <div className="p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Asset Code</p>
                                <p className="mt-0.5 break-all font-mono text-2xl font-bold tracking-tight text-gray-900">
                                    {asset.asset_code}
                                </p>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {isFilled(asset.type) && (
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-700">
                                            {humanize(asset.type)}
                                        </span>
                                    )}
                                    {isPiece && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                                            <Layers className="h-3.5 w-3.5" />
                                            Piece {piece.piece_number} of {asset.quantity ?? 1}
                                        </span>
                                    )}
                                    {isPiece && piece.disposed_at && (
                                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                                            Disposed {new Date(piece.disposed_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-3">
                                    <AssetStatusBadge
                                        status={asset.current_status}
                                        label={humanize(asset.current_status)}
                                        disposedQuantity={asset.disposed_quantity}
                                        quantity={asset.quantity}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Desktop actions live under the summary */}
                        <ActionButtons assetId={asset.id} className="hidden lg:flex" />
                    </div>

                    {/* Right column: details */}
                    <div className="space-y-4 lg:col-span-3">
                        {hasInfo || (!isPiece && quantityLabel) ? (
                            <Section
                                icon={<FileText className="h-4 w-4" />}
                                title={isPiece ? 'Piece Info' : 'Asset Info'}
                            >
                                {!isPiece && <DetailRow label="Quantity" value={quantityLabel} />}
                                <DetailRow label="Species" value={item.species} />
                                <DetailRow label="Equipment Type" value={item.equipment_type} />
                                <DetailRow label="Vehicle Type" value={item.vehicle_type} />
                                <DetailRow label="Description" value={item.description} />
                            </Section>
                        ) : null}

                        {hasDimensions && (
                            <Section icon={<Ruler className="h-4 w-4" />} title="Dimensions">
                                <div className="grid grid-cols-3 gap-2">
                                    <StatTile label="Length" value={item.length} unit="m" />
                                    <StatTile label="Width" value={item.width} unit="m" />
                                    <StatTile label="Height" value={item.height} unit="m" />
                                </div>
                            </Section>
                        )}

                        {hasVolume && (
                            <Section icon={<Box className="h-4 w-4" />} title="Volume">
                                <div className="grid grid-cols-2 gap-2">
                                    <StatTile label="Board Feet" value={item.volume_bd_ft} unit="bd ft" />
                                    <StatTile label="Cubic Meters" value={item.volume_cu_m} unit="cu m" />
                                </div>
                            </Section>
                        )}

                        {hasIdentifiers && (
                            <Section icon={<Tag className="h-4 w-4" />} title="Identifiers & Value">
                                <DetailRow label="Plate No." value={item.plate_number} />
                                <DetailRow label="Serial No." value={serialNumber} />
                                <DetailRow
                                    label="Est. Value"
                                    value={
                                        isFilled(item.estimated_value)
                                            ? `₱${Number(item.estimated_value).toLocaleString()}`
                                            : null
                                    }
                                />
                            </Section>
                        )}

                        {hasSource && (
                            <Section icon={<MapPin className="h-4 w-4" />} title="Origin & Apprehension">
                                <DetailRow label="Municipality of Origin" value={asset.municipality_of_origin} />
                                <DetailRow label="Location Apprehended" value={asset.location_apprehended} />
                                <DetailRow label="Apprehending Agency" value={asset.apprehending_agency} />
                                <DetailRow label="Mode" value={humanize(asset.mode)} />
                            </Section>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile action bar (hidden on desktop) */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
                <ActionButtons assetId={asset.id} className="mx-auto max-w-lg" />
            </div>
        </AuthenticatedLayout>
    );
}