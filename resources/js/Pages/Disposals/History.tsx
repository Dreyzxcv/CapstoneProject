import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { documentUrl } from '@/lib/utils';
import { Disposal } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, FileText } from 'lucide-react';

interface HistoryProps {
    asset: {
        id: number;
        asset_code: string;
        aap_number: string | null;
        type: string;
        quantity: number;
        disposed_quantity: number;
        current_status: string;
    };
    disposals: Array<
        Disposal & {
            processed_by?: { id: number; name: string } | null;
        }
    >;
}

function label(value: string): string {
    return value.replace(/_/g, ' ');
}

function DocLink({ path, children }: { path: string | null | undefined; children: string }) {
    const url = documentUrl(path);
    if (!url) return null;
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
        >
            <FileText className="h-3.5 w-3.5" />
            {children}
        </a>
    );
}

export default function DisposalsHistory({ asset, disposals }: HistoryProps) {
    const totalDisposed = disposals.reduce((sum, d) => sum + d.quantity, 0);
    const remaining = Math.max(0, (asset.quantity ?? 1) - totalDisposed);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href={route('assets.show', asset.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-emerald-700"
                            aria-label="Back to asset"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">Disposal History</h2>
                            <p className="text-sm text-gray-500">
                                {asset.asset_code}
                                {asset.aap_number ? ` · ${asset.aap_number}` : ''}
                            </p>
                        </div>
                    </div>
                    <Link href={route('assets.show', asset.id)}>
                        <Button variant="outline">Back to asset</Button>
                    </Link>
                </div>
            }
        >
            <Head title={`Disposal History ${asset.asset_code}`} />

            <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                <p className="text-sm text-gray-500">
                    {totalDisposed} of {asset.quantity ?? 1} unit(s) disposed
                    {remaining > 0 ? ` — ${remaining} remaining` : ' — fully disposed'}.
                </p>

                {disposals.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <p className="text-sm font-medium text-gray-700">No disposal records yet</p>
                            <p className="mt-1 text-sm text-gray-500">
                                Nothing has been disposed for this asset. Records will appear here once a
                                disposal is processed.
                            </p>
                            <Link href={route('assets.show', asset.id)} className="mt-4 inline-block">
                                <Button variant="outline" size="sm">
                                    Back to asset
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    disposals.map((d) => {
                        const detailEntries = Object.entries(d.details ?? {}).filter(
                            ([, v]) => v !== null && v !== undefined && v !== '',
                        );
                        const jev = d.disposal_jev;

                        return (
                            <Card key={d.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <CardTitle className="text-base capitalize">
                                            {label(d.disposal_type)} — {d.quantity} unit(s)
                                        </CardTitle>
                                        <p className="text-xs text-gray-400">
                                            Processed {new Date(d.processed_at).toLocaleString()}
                                            {d.processed_by ? ` by ${d.processed_by.name}` : ''}
                                        </p>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <dl className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <dt className="text-gray-500">Quantity</dt>
                                            <dd className="text-gray-900">{d.quantity} unit(s)</dd>
                                        </div>
                                        {d.volume_bd_ft && (
                                            <div>
                                                <dt className="text-gray-500">Volume (bd.ft)</dt>
                                                <dd className="text-gray-900">{d.volume_bd_ft}</dd>
                                            </div>
                                        )}
                                    </dl>

                                    {d.donation && (
                                        <div className="border-t border-gray-100 pt-4">
                                            <p className="font-semibold text-gray-700">Donation</p>
                                            <p className="mt-1 text-gray-600">
                                                {d.donation.requester_name}
                                                {d.donation.agency_name ? ` (${d.donation.agency_name})` : ''}
                                            </p>
                                            <p className="text-gray-500">
                                                {[d.donation.street, d.donation.barangay, d.donation.municipality]
                                                    .filter(Boolean)
                                                    .join(', ') || 'No address on file'}
                                            </p>
                                            <p
                                                className={
                                                    'mt-1 text-xs font-medium ' +
                                                    (d.donation.released_at ? 'text-emerald-700' : 'text-amber-700')
                                                }
                                            >
                                                {d.donation.released_at
                                                    ? `Released ${new Date(d.donation.released_at).toLocaleDateString()}`
                                                    : 'Awaiting release'}
                                            </p>
                                        </div>
                                    )}

                                    {jev && (
                                        <div className="border-t border-gray-100 pt-4">
                                            <p className="font-semibold text-gray-700">JEV Out</p>
                                            <p className="mt-1 text-gray-600">{jev.jev_number}</p>
                                            <p className="text-xs text-gray-500">
                                                {jev.uploaded_at
                                                    ? `Uploaded ${new Date(jev.uploaded_at).toLocaleString()}`
                                                    : 'Issued, not yet uploaded'}
                                            </p>
                                        </div>
                                    )}

                                    {(d.ics_record || d.par_record) && (
                                        <div className="border-t border-gray-100 pt-4">
                                            <p className="font-semibold text-gray-700">Property records</p>
                                            <ul className="mt-1 space-y-0.5 text-gray-600">
                                                {d.ics_record && (
                                                    <li>
                                                        ICS {d.ics_record.document_number} · issued{' '}
                                                        {new Date(d.ics_record.issued_at).toLocaleDateString()}
                                                    </li>
                                                )}
                                                {d.par_record && (
                                                    <li>
                                                        PAR {d.par_record.document_number} · issued{' '}
                                                        {new Date(d.par_record.issued_at).toLocaleDateString()}
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    )}

                                    {detailEntries.length > 0 && (
                                        <div className="border-t border-gray-100 pt-4">
                                            <p className="font-semibold text-gray-700">Details</p>
                                            <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                                                {detailEntries.map(([key, value]) => (
                                                    <div key={key}>
                                                        <dt className="capitalize text-gray-500">{label(key)}</dt>
                                                        <dd className="break-words text-gray-900">{String(value)}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-4 border-t border-gray-100 pt-4">
                                        <DocLink path={d.report_pdf_path}>Report</DocLink>
                                        <DocLink path={d.donation?.deed_of_donation_path}>Deed of Donation</DocLink>
                                        <DocLink path={d.donation?.waybill_pdf_path}>Waybill</DocLink>
                                        <DocLink path={d.donation?.release_order_pdf_path}>Release Order</DocLink>
                                        <DocLink path={jev?.pdf_path}>JEV Out</DocLink>
                                        <DocLink path={d.ics_record?.pdf_path}>ICS</DocLink>
                                        <DocLink path={d.par_record?.pdf_path}>PAR</DocLink>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </AuthenticatedLayout>
    );
}