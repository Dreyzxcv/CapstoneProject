import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { FormEvent, useMemo, useState } from 'react';
import { KeyRound, Mail, Pencil, PowerOff, Search, UserPlus, UsersRound, X } from 'lucide-react';

interface AreaDef { key: string; label: string; group: string; description: string }
interface AreaState { allowed: boolean; role_default: boolean; source: 'role' | 'custom' }
interface UserRow {
    id: number;
    name: string;
    email: string;
    roles: string[];
    is_active: boolean;
    is_admin: boolean;
    areas: Record<string, AreaState>;
    last_login_at: string | null;
}
interface ActionResult { success: string | null; error: string | null }

interface UsersIndexProps {
    users: UserRow[];
    availableRoles: string[];
    can: { create: boolean; edit: boolean };
    permissionAreas: AreaDef[];
    authId: number; // logged-in user's id, to guard self-deactivation
    result?: ActionResult;
}

type StatusKey = 'all' | 'active' | 'inactive' | 'never';

const statusFilters: { key: StatusKey; label: string; test: (u: UserRow) => boolean }[] = [
    { key: 'all',      label: 'All',             test: () => true },
    { key: 'active',   label: 'Active',          test: (u) => u.is_active },
    { key: 'inactive', label: 'Inactive',        test: (u) => !u.is_active },
    { key: 'never',    label: 'Never logged in', test: (u) => u.last_login_at === null },
];

const roleBadgeClass: Record<string, string> = {
    'system admin':      'bg-red-50 text-red-500',
    'mes officer':       'bg-sky-50 text-sky-600',
    'property custodian':'bg-amber-50 text-amber-600',
    'accounting officer':'bg-violet-50 text-violet-500',
    'penro management':  'bg-emerald-50 text-emerald-600',
};

const avatarColors = [
    'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
    'bg-amber-600', 'bg-rose-600',   'bg-cyan-600',
];

const focusRing =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';

const actionBtn =
    'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

function avatarColor(name: string) {
    return avatarColors[name.charCodeAt(0) % avatarColors.length];
}

function formatLastLogin(dateString: string | null): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-PH', {
        month:  'short',
        day:    'numeric',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
    });
}

function FilterPill({
    label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={
                'rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ' + focusRing + ' ' +
                (active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
            }
        >
            {label} ({count})
        </button>
    );
}

export default function UsersIndex({ users, availableRoles, can, authId, permissionAreas }: UsersIndexProps) {
    const [search,       setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
    const [roleFilter,   setRoleFilter]   = useState<string | null>(null); // null = all roles
    const [editingUser,  setEditingUser]  = useState<UserRow | null>(null);
    const [confirm, setConfirm] = useState<{ kind: 'deactivate' | 'reset'; user: UserRow } | null>(null);
    const [busy, setBusy] = useState<{ id: number; action: 'toggle' | 'reset' } | null>(null);
    const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const editForm = useForm({ name: '', email: '', role: '' });

    const query = search.trim().toLowerCase();
    const matchesSearch = (u: UserRow) =>
        query === '' || u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
    const matchesRole   = (u: UserRow) => roleFilter === null || u.roles.includes(roleFilter);
    const matchesStatus = (u: UserRow) =>
        (statusFilters.find((s) => s.key === statusFilter) ?? statusFilters[0]).test(u);

    // Counts reflect the other active filters, so each pill shows what clicking it would list.
    const statusCounts = useMemo(() => {
        const base = users.filter((u) => matchesSearch(u) && matchesRole(u));
        return Object.fromEntries(statusFilters.map((s) => [s.key, base.filter(s.test).length])) as Record<StatusKey, number>;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users, query, roleFilter]);

    const roleCounts = useMemo(() => {
        const base = users.filter((u) => matchesSearch(u) && matchesStatus(u));
        const map: Record<string, number> = {};
        availableRoles.forEach((role) => {
            map[role] = base.filter((u) => u.roles.includes(role)).length;
        });
        return { all: base.length, map };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users, availableRoles, query, statusFilter]);

    const filteredUsers = useMemo(
        () => users.filter((u) => matchesSearch(u) && matchesRole(u) && matchesStatus(u)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [users, query, roleFilter, statusFilter],
    );

    const hasActiveFilters = query !== '' || roleFilter !== null || statusFilter !== 'all';

    function clearFilters() {
        setSearch('');
        setStatusFilter('all');
        setRoleFilter(null);
    }

    const [permUser, setPermUser] = useState<UserRow | null>(null);
    const permForm = useForm<{ areas: Record<string, boolean> }>({ areas: {} });

    const areaGroups = useMemo(
        () => permissionAreas.reduce<Record<string, AreaDef[]>>((acc, a) => {
            (acc[a.group] ??= []).push(a);
            return acc;
        }, {}),
        [permissionAreas],
    );

    // The server flashes success/error and the index returns it as `result`.
    function showResult(page: { props: object }) {
        const result = (page.props as { result?: ActionResult }).result;
        if (result?.error) setBanner({ type: 'error', message: result.error });
        else if (result?.success) setBanner({ type: 'success', message: result.success });
    }

    function showFailure(message: string) {
        setBanner({ type: 'error', message });
    }

    function openEdit(user: UserRow) {
        setEditingUser(user);
        editForm.clearErrors();
        editForm.setData({ name: user.name, email: user.email, role: user.roles[0] ?? '' });
    }

    function closeEdit() {
        setEditingUser(null);
        editForm.clearErrors();
        editForm.reset();
    }

    function submitEdit(e: FormEvent) {
        e.preventDefault();
        if (!editingUser) return;
        setBanner(null);
        editForm.put(route('users.update', editingUser.id), {
            preserveScroll: true,
            onSuccess: (page) => { closeEdit(); showResult(page); },
        });
    }

    function runToggle(user: UserRow) {
        setBanner(null);
        setBusy({ id: user.id, action: 'toggle' });
        router.patch(route('users.toggle-active', user.id), {}, {
            preserveScroll: true,
            onSuccess: showResult,
            onError: () => showFailure(`Could not update ${user.name}'s account. Please try again.`),
            onFinish: () => { setBusy(null); setConfirm(null); },
        });
    }

    function toggleActive(user: UserRow) {
        // Deactivating asks for confirmation first; reactivating does not.
        if (user.is_active) {
            setConfirm({ kind: 'deactivate', user });
            return;
        }
        runToggle(user);
    }

    function runPasswordReset(user: UserRow) {
        setBanner(null);
        setBusy({ id: user.id, action: 'reset' });
        router.post(route('users.send-reset', user.id), {}, {
            preserveScroll: true,
            onSuccess: showResult,
            onError: () => showFailure(`Could not send a reset link to ${user.email}. Please try again.`),
            onFinish: () => { setBusy(null); setConfirm(null); },
        });
    }

    function confirmAction() {
        if (!confirm) return;
        if (confirm.kind === 'deactivate') runToggle(confirm.user);
        else runPasswordReset(confirm.user);
    }

    function closeConfirm() {
        if (busy) return; // don't dismiss while the request is running
        setConfirm(null);
    }

    function openPermissions(u: UserRow) {
        permForm.clearErrors();
        permForm.setData('areas', Object.fromEntries(permissionAreas.map((a) => [a.key, u.areas[a.key].allowed])));
        setPermUser(u);
    }
    function closePermissions() { setPermUser(null); permForm.clearErrors(); }
    function resetToRole(u: UserRow) {
        permForm.setData('areas', Object.fromEntries(permissionAreas.map((a) => [a.key, u.areas[a.key].role_default])));
    }
    function submitPermissions(e: FormEvent) {
        e.preventDefault();
        if (!permUser) return;
        setBanner(null);
        permForm.put(route('users.permissions.update', permUser.id), {
            preserveScroll: true,
            onSuccess: (page) => { closePermissions(); showResult(page); },
        });
    }

    const headerCell = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400';

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">User Management</h2>}>
            <Head title="Users" />

            <div className="mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="mt-1 text-sm text-gray-500">
                        {users.length} account{users.length === 1 ? '' : 's'} registered
                    </p>
                    {can.create && (
                        <Link href={route('users.create')}>
                            <Button>
                                <UserPlus className="mr-1.5 h-4 w-4" />
                                New User
                            </Button>
                        </Link>
                    )}
                </div>

                {/* Action result */}
                {banner && (
                    <div
                        role={banner.type === 'error' ? 'alert' : 'status'}
                        className={
                            'mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ' +
                            (banner.type === 'error'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800')
                        }
                    >
                        <span>{banner.message}</span>
                        <button
                            type="button"
                            onClick={() => setBanner(null)}
                            aria-label="Dismiss message"
                            className={'rounded p-0.5 hover:bg-white/60 ' + focusRing}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="text-base">System Users</CardTitle>
                    </CardHeader>
                    <CardContent className="min-w-0">
                        {users.length === 0 ? (
                            /* System has no users at all */
                            <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
                                <UsersRound className="h-8 w-8 text-gray-300" aria-hidden="true" />
                                <h3 className="mt-3 text-sm font-semibold text-gray-800">No user accounts yet</h3>
                                <p className="mt-1 max-w-sm text-sm text-gray-500">
                                    Accounts you create will show up here, where you can manage their roles and access.
                                </p>
                                {can.create && (
                                    <Link href={route('users.create')} className="mt-4">
                                        <Button>
                                            <UserPlus className="mr-1.5 h-4 w-4" />
                                            Create the first user
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Search */}
                                <div className="mb-4">
                                    <Label htmlFor="user-search" className="sr-only">Search users by name or email</Label>
                                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-emerald-600">
                                        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                                        <input
                                            id="user-search"
                                            type="search"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search by name or email…"
                                            className="w-full border-0 p-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                        />
                                    </div>
                                </div>

                                {/* Filters */}
                                <div className="mb-4 space-y-3">
                                    <div role="group" aria-label="Filter by account status" className="flex flex-wrap gap-2">
                                        {statusFilters.map((s) => (
                                            <FilterPill
                                                key={s.key}
                                                label={s.label}
                                                count={statusCounts[s.key]}
                                                active={statusFilter === s.key}
                                                onClick={() => setStatusFilter(s.key)}
                                            />
                                        ))}
                                    </div>
                                    <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-2">
                                        <FilterPill
                                            label="All roles"
                                            count={roleCounts.all}
                                            active={roleFilter === null}
                                            onClick={() => setRoleFilter(null)}
                                        />
                                        {availableRoles.map((role) => (
                                            <FilterPill
                                                key={role}
                                                label={role}
                                                count={roleCounts.map[role] ?? 0}
                                                active={roleFilter === role}
                                                onClick={() => setRoleFilter(role)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <p className="mb-2 text-xs text-gray-500" aria-live="polite">
                                    Showing {filteredUsers.length} of {users.length} account{users.length === 1 ? '' : 's'}
                                </p>

                                {/* Table: scrolls horizontally on small screens */}
                                <div
                                    role="region"
                                    aria-label="Users table"
                                    tabIndex={0}
                                    className={'relative max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm ' + focusRing}
                                >
                                    <table className="min-w-[56rem] divide-y divide-gray-100 lg:min-w-full">
                                        <caption className="sr-only">System user accounts</caption>
                                        <thead className="bg-gray-50/60">
                                            <tr>
                                                <th scope="col" className={headerCell}>#</th>
                                                <th scope="col" className={headerCell}>Name</th>
                                                <th scope="col" className={headerCell}>Email</th>
                                                <th scope="col" className={headerCell}>Role</th>
                                                <th scope="col" className={headerCell}>Access</th>
                                                <th scope="col" className={headerCell}>Status</th>
                                                <th scope="col" className={headerCell}>Last Login</th>
                                                {can.edit && (
                                                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                        Actions
                                                    </th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredUsers.map((u, index) => {
                                                const isSelf     = u.id === authId;
                                                const isInactive = !u.is_active;
                                                const rowBusy    = busy?.id === u.id;
                                                return (
                                                    <tr
                                                        key={u.id}
                                                        className={'hover:bg-gray-50/60 ' + (isInactive ? 'opacity-60' : '')}
                                                    >
                                                        <td className="px-4 py-3 text-sm text-gray-400">
                                                            {String(index + 1).padStart(2, '0')}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <span
                                                                    aria-hidden="true"
                                                                    className={
                                                                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ' +
                                                                        avatarColor(u.name)
                                                                    }
                                                                >
                                                                    {u.name.charAt(0).toUpperCase()}
                                                                </span>
                                                                <p className="text-sm font-medium text-gray-800">
                                                                    {u.name}
                                                                    {isSelf && (
                                                                        <span className="ml-1.5 text-xs font-normal text-gray-400">(you)</span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {u.roles.map((role) => (
                                                                    <span
                                                                        key={role}
                                                                        className={
                                                                            'inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ' +
                                                                            (roleBadgeClass[role.toLowerCase()] ?? 'bg-gray-100 text-gray-500')
                                                                        }
                                                                    >
                                                                        {role}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {u.is_admin ? (
                                                                <span className="text-xs font-medium text-gray-500">Full access</span>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {permissionAreas.map((a) => {
                                                                        const s = u.areas[a.key];
                                                                        return (
                                                                            <span
                                                                                key={a.key}
                                                                                title={s.source === 'custom' ? 'Customised for this user' : 'Role default'}
                                                                                className={
                                                                                    'rounded px-2 py-0.5 text-xs font-medium ' +
                                                                                    (s.allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400 line-through')
                                                                                }
                                                                            >
                                                                                {a.label}{s.source === 'custom' ? ' •' : ''}
                                                                                <span className="sr-only">
                                                                                    {s.allowed ? ' (allowed)' : ' (not allowed)'}
                                                                                    {s.source === 'custom' ? ', customised' : ''}
                                                                                </span>
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span
                                                                className={
                                                                    'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                                                                    (u.is_active
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : 'bg-gray-100 text-gray-500')
                                                                }
                                                            >
                                                                {u.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-500">
                                                            {formatLastLogin(u.last_login_at)}
                                                        </td>
                                                        {can.edit && (
                                                            <td className="px-4 py-3">
                                                                {/* Labels collapse to icons below xl; accessible names always include the user. */}
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    {!u.is_admin && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openPermissions(u)}
                                                                            disabled={rowBusy}
                                                                            title="Configure access"
                                                                            aria-label={`Configure access for ${u.name}`}
                                                                            className={actionBtn + ' border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-emerald-700'}
                                                                        >
                                                                            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                                                                            <span className="sr-only xl:not-sr-only">Permissions</span>
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openEdit(u)}
                                                                        disabled={rowBusy}
                                                                        title="Edit user"
                                                                        aria-label={`Edit ${u.name}`}
                                                                        className={actionBtn + ' border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-emerald-700'}
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                                                        <span className="sr-only xl:not-sr-only">Edit</span>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setConfirm({ kind: 'reset', user: u })}
                                                                        disabled={rowBusy}
                                                                        title="Send password reset link"
                                                                        aria-label={`Send password reset link to ${u.name}`}
                                                                        className={actionBtn + ' border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-blue-700'}
                                                                    >
                                                                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                                                                        <span className="sr-only xl:not-sr-only">
                                                                            {rowBusy && busy?.action === 'reset' ? 'Sending…' : 'Send reset link'}
                                                                        </span>
                                                                    </button>

                                                                    {/* Deactivate / Reactivate — hidden for self */}
                                                                    {!isSelf && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleActive(u)}
                                                                            disabled={rowBusy}
                                                                            title={u.is_active ? 'Deactivate account' : 'Reactivate account'}
                                                                            aria-label={`${u.is_active ? 'Deactivate' : 'Reactivate'} ${u.name}`}
                                                                            className={
                                                                                actionBtn + ' ' +
                                                                                (u.is_active
                                                                                    ? 'border-red-100 text-red-500 hover:bg-red-50'
                                                                                    : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50')
                                                                            }
                                                                        >
                                                                            <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />
                                                                            <span className="sr-only xl:not-sr-only">
                                                                                {rowBusy && busy?.action === 'toggle'
                                                                                    ? (u.is_active ? 'Deactivating…' : 'Reactivating…')
                                                                                    : (u.is_active ? 'Deactivate' : 'Reactivate')}
                                                                            </span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}

                                            {filteredUsers.length === 0 && (
                                                <tr>
                                                    <td colSpan={can.edit ? 8 : 7} className="px-4 py-10 text-center">
                                                        <p className="text-sm font-medium text-gray-700">No users match your search or filters.</p>
                                                        <p className="mt-1 text-sm text-gray-500">
                                                            Try a different search term, or clear the filters to see every account.
                                                        </p>
                                                        {hasActiveFilters && (
                                                            <Button type="button" variant="outline" className="mt-4" onClick={clearFilters}>
                                                                Clear filters
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Edit modal */}
            <Modal show={editingUser !== null} onClose={closeEdit} maxWidth="md">
                {editingUser && (
                    <form onSubmit={submitEdit} className="p-6">
                        <h2 className="text-lg font-medium text-gray-900">Edit User</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Update profile for <span className="font-medium">{editingUser.name}</span>.
                        </p>

                        <div className="mt-6 space-y-4">
                            <div>
                                <Label htmlFor="edit_name">Name</Label>
                                <Input
                                    id="edit_name"
                                    className="mt-1 w-full"
                                    value={editForm.data.name}
                                    onChange={(e) => editForm.setData('name', e.target.value)}
                                    required
                                />
                                <InputError message={editForm.errors.name} className="mt-1" />
                            </div>

                            <div>
                                <Label htmlFor="edit_email">Email</Label>
                                <Input
                                    id="edit_email"
                                    type="email"
                                    className="mt-1 w-full"
                                    value={editForm.data.email}
                                    onChange={(e) => editForm.setData('email', e.target.value)}
                                    required
                                />
                                <InputError message={editForm.errors.email} className="mt-1" />
                            </div>

                            <div>
                                <Label htmlFor="edit_role">Role</Label>
                                <select
                                    id="edit_role"
                                    value={editForm.data.role}
                                    onChange={(e) => editForm.setData('role', e.target.value)}
                                    aria-describedby="edit_role_help"
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    required
                                >
                                    <option value="" disabled>Select a role</option>
                                    {availableRoles.map((role) => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                                <p id="edit_role_help" className="mt-1 text-xs text-gray-500">
                                    Each account has exactly one role. Saving replaces the current role with the one selected.
                                </p>
                                {editingUser.roles.length > 1 && (
                                    <p role="alert" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                        This account currently has {editingUser.roles.length} roles ({editingUser.roles.join(', ')}).
                                        Accounts are limited to one role, so saving will remove all of them except the one selected above.
                                    </p>
                                )}
                                <InputError message={editForm.errors.role} className="mt-1" />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                            <Button type="button" variant="outline" onClick={closeEdit}>Cancel</Button>
                            <Button type="submit" disabled={editForm.processing}>
                                {editForm.processing ? 'Saving…' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal show={permUser !== null} onClose={closePermissions} maxWidth="md">
                {permUser && (
                    <form onSubmit={submitPermissions} className="p-6">
                        <h2 className="text-lg font-medium text-gray-900">Permissions</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Areas <span className="font-medium">{permUser.name}</span> can view. Role: <span className="capitalize">{permUser.roles.join(', ')}</span>.
                        </p>

                        <div className="mt-5 space-y-5">
                            {Object.entries(areaGroups).map(([group, areas]) => (
                                <fieldset key={group}>
                                    <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">{group}</legend>
                                    <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                                        {areas.map((a) => {
                                            const checked = permForm.data.areas[a.key] ?? false;
                                            const def = permUser.areas[a.key].role_default;
                                            const note = checked === def ? 'Role default' : checked ? 'Added for this user' : 'Removed for this user';
                                            return (
                                                <label key={a.key} className="flex cursor-pointer items-start gap-3 p-3">
                                                    <input type="checkbox" className="mt-1" checked={checked}
                                                        onChange={(e) => permForm.setData('areas', { ...permForm.data.areas, [a.key]: e.target.checked })} />
                                                    <span className="flex-1">
                                                        <span className="block text-sm font-medium text-gray-800">{a.label}</span>
                                                        <span className="block text-xs text-gray-500">{a.description}</span>
                                                    </span>
                                                    <span className={'text-xs font-medium ' + (checked === def ? 'text-gray-400' : 'text-amber-600')}>{note}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                            ))}
                        </div>

                        <p className="mt-4 text-xs text-gray-500">
                            User Management, audit logs, market prices and backups are System Admin only and cannot be granted here.
                        </p>
                        <InputError message={permForm.errors.areas} className="mt-2" />

                        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                            <Button type="button" variant="ghost" onClick={() => resetToRole(permUser)}>Reset to role</Button>
                            <div className="flex gap-3">
                                <Button type="button" variant="outline" onClick={closePermissions}>Cancel</Button>
                                <Button type="submit" disabled={permForm.processing}>
                                    {permForm.processing ? 'Saving…' : 'Save'}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Confirmation modal: deactivate account / send password reset link */}
            <Modal show={confirm !== null} onClose={closeConfirm} maxWidth="sm">
                {confirm && (
                    <div className="p-6">
                        {confirm.kind === 'deactivate' ? (
                            <>
                                <h2 className="text-lg font-medium text-gray-900">Deactivate Account</h2>
                                <p className="mt-2 text-sm text-gray-600">
                                    <span className="font-medium">{confirm.user.name}</span> will immediately lose access to the system. Their records and audit trail will be preserved.
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-lg font-medium text-gray-900">Send Password Reset Link</h2>
                                <p className="mt-2 text-sm text-gray-600">
                                    A password reset link will be emailed to{' '}
                                    <span className="font-medium">{confirm.user.email}</span>. Their current password keeps working until they use the link.
                                </p>
                            </>
                        )}
                        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                            <Button type="button" variant="outline" onClick={closeConfirm} disabled={busy !== null}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                className={confirm.kind === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : undefined}
                                onClick={confirmAction}
                                disabled={busy !== null}
                            >
                                {confirm.kind === 'deactivate'
                                    ? (busy ? 'Deactivating…' : 'Deactivate')
                                    : (busy ? 'Sending…' : 'Send reset link')}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </AuthenticatedLayout>
    );
}