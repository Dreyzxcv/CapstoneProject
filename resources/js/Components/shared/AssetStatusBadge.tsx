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

interface AssetStatusBadgeProps {
    status: string;
    label: string;
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

    const displayLabel = showPartialProgress
        ? `${label} (${disposedQuantity}/${quantity} disposed)`
        : label;

    return (
        <Badge variant={statusVariants[status] ?? 'default'} className={className}>
            {displayLabel}
        </Badge>
    );
}