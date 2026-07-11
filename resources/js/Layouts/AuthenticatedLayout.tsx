import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { PageProps } from '@/types';
import {
    LayoutDashboard,
    Package,
    QrCode,
    Trash2,
    FileBarChart2,
    History,
    Users,
    ChevronDown,
    LogOut,
    Menu,
    X,
    ClipboardPlus,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-react';

function hasPermission(permissions: string[], permission: string): boolean {
    return permissions.includes(permission);
}

type NavItem = {
    href: string;
    label: string;
    active: boolean;
    show: boolean;
    icon: ReactNode;
};

type NavSection = {
    label: string;
    items: NavItem[];
};

const SIDEBAR_COLLAPSED_KEY = 'logtrack-sidebar-collapsed';

export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth, flash } = usePage<PageProps>().props;
    const user = auth.user!;
    const permissions = user.permissions ?? [];

    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    // Load persisted preference once on mount (avoids SSR/hydration mismatch).
    useEffect(() => {
        const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        if (stored === '1') setCollapsed(true);
    }, []);

    function toggleCollapsed() {
        setCollapsed((prev) => {
            const next = !prev;
            window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
            return next;
        });
    }

    const iconClass = 'h-[18px] w-[18px] shrink-0';

    const sections: NavSection[] = [
        {
            label: 'Overview',
            items: [
                {
                    href: route('dashboard'),
                    label: 'Dashboard',
                    active: route().current('dashboard'),
                    show: true,
                    icon: <LayoutDashboard className={iconClass} />,
                },
            ],
        },
        {
            label: 'Assets',
            items: [
                {
                    href: route('assets.index'),
                    label: 'Assets',
                    active: route().current('assets.*'),
                    show: hasPermission(permissions, 'assets.view'),
                    icon: <Package className={iconClass} />,
                },
                {
                    href: route('incidents.create'),
                    label: 'New Incident',
                    active: route().current('incidents.*'),
                    show: hasPermission(permissions, 'incidents.create'),
                    icon: <ClipboardPlus className={iconClass} />,
                },
                {
                    href: route('scan.index'),
                    label: 'Scan QR',
                    active: route().current('scan.*'),
                    show: hasPermission(permissions, 'assets.scan'),
                    icon: <QrCode className={iconClass} />,
                },
                {
                    href: route('disposals.index'),
                    label: 'Disposals',
                    active: route().current('disposals.*'),
                    show: hasPermission(permissions, 'disposals.view'),
                    icon: <Trash2 className={iconClass} />,
                },
            ],
        },
        {
            label: 'Reports',
            items: [
                {
                    href: route('reports.index'),
                    label: 'Reports',
                    active: route().current('reports.*'),
                    show: hasPermission(permissions, 'reports.view'),
                    icon: <FileBarChart2 className={iconClass} />,
                },
                {
                    href: route('audit-logs.index'),
                    label: 'Audit Logs',
                    active: route().current('audit-logs.*'),
                    show: hasPermission(permissions, 'audit.view'),
                    icon: <History className={iconClass} />,
                },
            ],
        },
        {
            label: 'Administration',
            items: [
                {
                    href: route('users.index'),
                    label: 'Users',
                    active: route().current('users.*'),
                    show: hasPermission(permissions, 'users.manage'),
                    icon: <Users className={iconClass} />,
                },
            ],
        },
    ]
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => item.show),
        }))
        .filter((section) => section.items.length > 0);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Mobile top bar */}
            <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
                <Link href={route('dashboard')} className="flex items-center gap-3">
                    <ApplicationLogo className="block h-8 w-auto fill-current text-emerald-800" />
                    <span className="flex flex-col leading-tight">
                        <span className="text-sm font-bold text-emerald-900">LogTrack Insight</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            DENR-PENRO Catanduanes
                        </span>
                    </span>
                </Link>
                <button
                    onClick={() => setShowingNavigationDropdown(true)}
                    className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100"
                    aria-label="Open menu"
                >
                    <Menu className="h-6 w-6" />
                </button>
            </div>

            {/* Mobile backdrop */}
            {showingNavigationDropdown && (
                <div
                    className="fixed inset-0 z-40 bg-gray-900/40 lg:hidden"
                    onClick={() => setShowingNavigationDropdown(false)}
                />
            )}

            <div className="flex min-h-screen flex-col lg:flex-row">
                <aside
                    className={
                        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-visible border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out ' +
                        (showingNavigationDropdown ? 'translate-x-0' : '-translate-x-full') +
                        ' lg:sticky lg:top-0 lg:relative lg:h-screen lg:translate-x-0 lg:transition-[width] lg:duration-200 lg:ease-in-out ' +
                        (collapsed ? 'lg:w-20' : 'lg:w-65')
                    }
                >
                    {/* Collapse toggle — desktop only, floats on the sidebar's edge */}
                    <button
                        onClick={toggleCollapsed}
                        className="absolute right-0 top-6 z-10 hidden h-7 w-7 translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-emerald-700 lg:flex"
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="h-3.5 w-3.5" />
                        ) : (
                            <PanelLeftClose className="h-3.5 w-3.5" />
                        )}
                    </button>

                    {/* Logo */}
                    <div className={'flex h-16 items-center justify-between px-4 lg:h-20 ' + (collapsed ? 'lg:px-3' : 'lg:px-6')}>
                        <Link
                            href={route('dashboard')}
                            className={'flex items-center gap-3 overflow-hidden ' + (collapsed ? 'lg:gap-0' : '')}
                        >
                            <ApplicationLogo className="block h-9 w-auto shrink-0 fill-current text-emerald-800" />
                            <span
                                className={
                                    'flex flex-col leading-tight whitespace-nowrap ' +
                                    (collapsed ? 'lg:hidden' : '')
                                }
                            >
                                <span className="text-sm font-bold text-emerald-900">
                                    LogTrack Insight
                                </span>
                                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                                    DENR-PENRO Catanduanes
                                </span>
                            </span>
                        </Link>

                        <div className="flex items-center lg:hidden">
                            <button
                                onClick={() => setShowingNavigationDropdown(false)}
                                className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 transition duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-500 focus:outline-none"
                                aria-label="Close menu"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Nav sections */}
                    <nav className="space-y-6 overflow-y-auto px-4 pb-6 lg:flex-1 lg:px-4 lg:pb-8">
                        {sections.map((section) => (
                            <div key={section.label}>
                                <p
                                    className={
                                        'mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 ' +
                                        (collapsed ? 'lg:hidden' : '')
                                    }
                                >
                                    {section.label}
                                </p>
                                <div className="space-y-1">
                                    {section.items.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setShowingNavigationDropdown(false)}
                                            title={collapsed ? item.label : undefined}
                                            className={
                                                'flex items-center gap-3 rounded-md border-l-[3px] py-2 pl-[9px] pr-3 text-sm font-medium transition duration-150 ease-in-out ' +
                                                (collapsed ? 'lg:justify-center lg:gap-0 lg:pl-[9px] lg:pr-[9px]' : '') +
                                                ' ' +
                                                (item.active
                                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-emerald-700')
                                            }
                                        >
                                            {item.icon}
                                            <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>

                    {/* Account - desktop */}
                    <div className={'hidden border-t border-gray-200 lg:block ' + (collapsed ? 'px-2 py-4' : 'px-4 py-4')}>
                        {collapsed ? (
                            <div className="flex flex-col items-center gap-2">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <button
                                            type="button"
                                            title={user.name}
                                            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 hover:bg-emerald-200"
                                        >
                                            {user.name.charAt(0).toUpperCase()}
                                        </button>
                                    </Dropdown.Trigger>
                                    <Dropdown.Content>
                                        <Dropdown.Link href={route('profile.edit')}>Profile</Dropdown.Link>
                                        <Dropdown.Link href={route('logout')} method="post" as="button">
                                            Log Out
                                        </Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                                <Link
                                    href={route('logout')}
                                    method="post"
                                    as="button"
                                    title="Sign Out"
                                    className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-red-600"
                                >
                                    <LogOut className="h-4 w-4" />
                                </Link>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex w-full rounded-md">
                                            <button
                                                type="button"
                                                className="flex w-full items-center justify-between rounded-md border border-transparent bg-transparent px-0 py-1 text-left text-sm font-medium leading-4 text-gray-600 transition duration-150 ease-in-out hover:text-gray-800 focus:outline-none"
                                            >
                                                <span>
                                                    <span className="block text-gray-900">{user.name}</span>
                                                    <span className="block text-xs text-gray-500">{user.roles?.join(', ')}</span>
                                                </span>
                                                <ChevronDown className="h-4 w-4" />
                                            </button>
                                        </span>
                                    </Dropdown.Trigger>
                                    <Dropdown.Content>
                                        <Dropdown.Link href={route('profile.edit')}>Profile</Dropdown.Link>
                                        <Dropdown.Link href={route('logout')} method="post" as="button">
                                            Log Out
                                        </Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>

                                <Link
                                    href={route('logout')}
                                    method="post"
                                    as="button"
                                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-red-600"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Sign Out
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Account - mobile */}
                    <div className="border-t border-gray-200 px-4 py-4 lg:hidden">
                        <div className="text-sm font-medium text-gray-800">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="mt-3 space-y-1">
                            <ResponsiveNavLink href={route('profile.edit')}>Profile</ResponsiveNavLink>
                            <ResponsiveNavLink method="post" href={route('logout')} as="button">
                                Log Out
                            </ResponsiveNavLink>
                        </div>
                    </div>
                </aside>

                <div className="flex-1">
                    {flash?.success && (
                        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            {flash.success}
                        </div>
                    )}
                    {flash?.error && (
                        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {flash.error}
                        </div>
                    )}

                    {header && (
                        <header className="bg-white shadow-sm">
                            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{header}</div>
                        </header>
                    )}

                    <main className="py-6">{children}</main>
                </div>
            </div>
        </div>
    );
}