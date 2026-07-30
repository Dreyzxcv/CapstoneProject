import { Link, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface NotificationItem {
    id: number;
    asset_id: number | null;
    title: string;
    message: string;
    created_at: string;
}

interface NotificationsProps {
    unreadCount: number;
    items: NotificationItem[];
    unreadAssetIds: number[];
}

export default function NotificationBell() {
    const { notifications } = usePage<PageProps & { notifications: NotificationsProps }>().props;
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const unreadCount = notifications?.unreadCount ?? 0;
    const items = notifications?.items ?? [];

    function markAllRead() {
        router.post(route('notifications.read-all'), {}, { preserveScroll: true, preserveState: true });
    }

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-emerald-700"
                aria-label="Notifications"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                        <p className="text-sm font-semibold text-gray-800">Notifications</p>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={markAllRead}
                                className="text-xs font-medium text-emerald-700 hover:underline"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {items.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-gray-400">You're all caught up.</p>
                        ) : (
                            items.map((item) => (
                                <Link
                                    key={item.id}
                                    href={item.asset_id ? route('assets.show', item.asset_id) : '#'}
                                    onClick={() => setOpen(false)}
                                    className="block border-b border-gray-50 px-4 py-3 transition hover:bg-emerald-50/60"
                                >
                                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                                    <p className="mt-0.5 text-xs text-gray-500">{item.message}</p>
                                    <p className="mt-1 text-[11px] text-gray-400">
                                        {new Date(item.created_at).toLocaleString()}
                                    </p>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}