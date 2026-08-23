// resources/js/Components/shared/AssetStatusBadge.tsx

import { Badge } from '@/Components/ui/badge';

const statusVariants: Record<string, string> = {
    intake_recorded:            'default',
    documents_uploaded:         'blue',
    pending_custody_review:     'amber',
    receipt_signed:             'cyan',
    stored:                     'teal',
    under_trial:                'purple',
    cleared_for_accounting:     'indigo',
    for_disposal:               'orange',
    donation_pending_jev_out:   'yellow',
    pending_release:            'yellow',
    donated:                    'green',
    fabricated:                 'green',
    released:                   'green',
    decayed:                    'red',
    forfeited:                  'rose',
    damaged:                    'red',
};

const statusLabels: Record<string, string> = {
    intake_recorded:            'Intake Recorded',
    documents_uploaded:         'Documents Uploaded',
    pending_custody_review:     'Pending Custody Review',
    receipt_signed:             'Required Documents Verified',
    stored:                     'In Storage',
    under_trial:                'Under Trial',
    cleared_for_accounting:     'Tagged — Cleared for Custodian',
    for_disposal:               'For Disposal',
    donation_pending_jev_out:   'Donation — Awaiting JEV Out',
    pending_release:            'Pending Release to Donee',
    donated:                    'Donated',
    fabricated:                 'Fabricated',
    released:                   'Released',
    decayed:                    'Decayed',
    forfeited:                  'Forfeited',
    damaged:                    'Damaged / Disabled',
};

interface AssetStatusBadgeProps {
    status: string;
    label?: string;
    disposedQuantity?: number;
    quantity?: number;
    className?: string;
}

export function AssetStatusBadge({
    status,
    label,
    disposedQuantity,
    quantity,
    className,
}: AssetStatusBadgeProps) {
    const showPartialProgress =
        status === 'for_disposal' &&
        typeof disposedQuantity === 'number' &&
        typeof quantity === 'number' &&
        disposedQuantity > 0 &&
        disposedQuantity < quantity;

    const resolvedLabel = statusLabels[status] ?? label ?? status.replace(/_/g, ' ');

    const displayLabel = showPartialProgress
        ? `${resolvedLabel} (${disposedQuantity}/${quantity} disposed)`
        : resolvedLabel;

    return (
        <Badge variant={statusVariants[status] ?? 'default'} className={className}>
            {displayLabel}
        </Badge>
    );
}