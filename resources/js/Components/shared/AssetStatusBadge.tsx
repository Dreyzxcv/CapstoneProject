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

export function AssetStatusBadge({
    status,
    label,
}: {
    status: string;
    label: string;
}) {
    return <Badge variant={statusVariants[status] ?? 'default'}>{label}</Badge>;
}
