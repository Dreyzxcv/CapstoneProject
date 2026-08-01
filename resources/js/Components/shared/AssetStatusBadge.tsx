import { Badge } from '@/Components/ui/badge';

const statusVariants: Record<string, string> = {
    intake_recorded: 'default',
    pending_custody_review: 'amber',
    receipt_signed: 'blue',
    stored: 'green',
    under_trial: 'blue',
    cleared_for_accounting: 'amber',
    for_disposal: 'amber',
    pending_release: 'amber',
    donated: 'green',
    decayed: 'gray',
    fabricated: 'green',
    released: 'green',
    forfeited: 'gray',
    damaged: 'gray',
};

interface AssetStatusBadgeProps {
    status: string;
    label: string;
    disposedQuantity?: number;
    quantity?: number;
}

export function AssetStatusBadge({
    status,
    label,
    disposedQuantity,
    quantity,
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

    return <Badge variant={statusVariants[status] ?? 'default'}>{displayLabel}</Badge>;
}