import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    BatchAssetsSection,
    DonationSummarySection,
    JevOutDetail,
    JevOutIssuanceSection,
    donationFacts,
} from '@/Components/Jev/JevOutSections';
import { JevStatusBadge } from '@/Components/Jev/shared';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

interface Props extends PageProps {
    disposal: JevOutDetail['disposal'];
    siblings: JevOutDetail['siblings'];
    can: JevOutDetail['can'];
}

/**
 * Standalone JEV OUT page. The JEV index now opens these details in a modal;
 * this page is kept only for direct links (see the note about removing it).
 */
export default function ShowDisposalJev({ disposal, siblings, can }: Props) {
    const [justIssued, setJustIssued] = useState(false);

    const { donation, disposal_jev } = disposal;
    const facts = donationFacts(donation);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Link href={route('jev.index')} className="text-sm text-gray-500 hover:text-gray-700">
                        ← JEV
                    </Link>
                    <span className="text-gray-400">/</span>
                    <h2 className="text-xl font-semibold text-gray-800">Journal Entry Voucher (OUT)</h2>
                    <JevStatusBadge issued={!!disposal_jev} jevType="OUT" />
                </div>
            }
        >
            <Head title={donation ? `JEV OUT — ${facts.donationId}` : 'JEV OUT'} />

            <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
                <DonationSummarySection facts={facts} assetCount={siblings.length} />
                <JevOutIssuanceSection
                    disposalId={disposal.id}
                    jev={disposal_jev}
                    facts={facts}
                    canIssue={can.issue_jev_out}
                    autoFocus
                    justIssued={justIssued}
                    onIssued={() => setJustIssued(true)}
                />
                <BatchAssetsSection siblings={siblings} />
            </div>
        </AuthenticatedLayout>
    );
}