interface RecentActivityEntry {
    id: number;
    action: string;
    model_type: string | null;
    model_id: number | null;
    created_at: string;
}

function formatAction(action: string): string {
    const parts = action.split('.');
    const verb = parts[parts.length - 1] ?? action;
    return verb.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatModel(modelType: string | null, modelId: number | null): string {
    if (!modelType) return '';
    const shortName = modelType.split('\\').pop() ?? modelType;
    return modelId ? `${shortName} #${modelId}` : shortName;
}

export default function AccountActivity({
    recentActivity,
    className = '',
}: {
    lastLoginAt?: string | null; // kept for API compat, no longer rendered here
    recentActivity: RecentActivityEntry[];
    className?: string;
}) {
    if (recentActivity.length === 0) {
        return (
            <p className="text-sm text-gray-500">No recent activity recorded yet.</p>
        );
    }

    return (
        <ul className={`divide-y divide-gray-100 rounded-md border border-gray-200 ${className}`}>
            {recentActivity.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                        <p className="font-medium text-gray-800">{formatAction(entry.action)}</p>
                        {entry.model_type && (
                            <p className="text-xs text-gray-500">
                                {formatModel(entry.model_type, entry.model_id)}
                            </p>
                        )}
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                        {new Date(entry.created_at).toLocaleString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                        })}
                    </span>
                </li>
            ))}
        </ul>
    );
}