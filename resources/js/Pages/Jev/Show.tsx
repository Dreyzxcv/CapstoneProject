import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetPiecesSection, AssetSummarySection, JevInIssuanceSection } from '@/Components/Jev/JevInSections';
import { JevAsset, JevInRecord, JevStatusBadge } from '@/Components/Jev/shared';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

interface Props extends PageProps {
    asset: JevAsset;
    jev: JevInRecord | null;
    can: { issue_jev: boolean };
}

/**
 * Standalone JEV IN page. The JEV index now opens these details in a modal;
 * this page is kept only for direct links (see the note about removing it).
 */
export default function JevShow({ asset, jev, can }: Props) {
    const [justIssued, setJustIssued] = useState(false);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Link href={route('jev.index')} className="text-sm text-gray-500 hover:text-gray-700">
                        ← JEV
                    </Link>
                    <span className="text-gray-400">/</span>
                    <h2 className="text-xl font-semibold text-gray-800">Journal Entry Voucher (IN)</h2>
                    <JevStatusBadge issued={!!jev} jevType="IN" />
                </div>
            }
        >
            <Head title={`JEV IN — ${asset.asset_code}`} />

            <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
                <AssetSummarySection asset={asset} />
                <JevInIssuanceSection
                    asset={asset}
                    jev={jev}
                    canIssue={can.issue_jev}
                    autoFocus
                    justIssued={justIssued}
                    onIssued={() => setJustIssued(true)}
                />
                <AssetPiecesSection asset={asset} />
            </div>
        </AuthenticatedLayout>
    );
}