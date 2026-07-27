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
    lastLoginAt,
    recentActivity,
    className = '',
}: {
    lastLoginAt: string | null;
    recentActivity: RecentActivityEntry[];
    className?: string;
}) {
    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">Account Activity</h2>
                <p className="mt-1 text-sm text-gray-600">
                    A quick look at your recent sign-in and account actions.
                </p>
            </header>

            <div className="mt-6 space-y-4">
                <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                    <span className="font-medium text-gray-700">Last sign-in: </span>
                    <span className="text-gray-600">
                        {lastLoginAt ? new Date(lastLoginAt).toLocaleString() : 'No sign-in recorded yet'}
                    </span>
                </div>

                {recentActivity.length === 0 ? (
                    <p className="text-sm text-gray-500">No recent activity recorded yet.</p>
                ) : (
                    <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                        {recentActivity.map((entry) => (
                            <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                                <div>
                                    <p className="font-medium text-gray-800">{formatAction(entry.action)}</p>
                                    {entry.model_type && (
                                        <p className="text-xs text-gray-500">
                                            {formatModel(entry.model_type, entry.model_id)}
                                        </p>
                                    )}
                                </div>
                                <span className="shrink-0 text-xs text-gray-500">
                                    {new Date(entry.created_at).toLocaleString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}