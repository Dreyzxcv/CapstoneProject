import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft, KeyRound, Mail, Pencil, PowerOff, Search, Settings2, ShieldCheck, UserPlus, UsersRound, X,
} from 'lucide-react';

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
type ManageView = 'overview' | 'edit' | 'permissions' | 'deactivate' | 'reset';

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

const tileBtn =
    'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

const selectClass =
    'h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm ' +
    'focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600';
    
const footerRow =
    'mt-6 flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3';
const footerBtn = 'w-full sm:w-auto';

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

function customCount(u: UserRow): number {
    return u.is_admin ? 0 : Object.values(u.areas).filter((a) => a.source === 'custom').length;
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
    return (
        <span
            aria-hidden="true"
            className={
                'flex shrink-0 items-center justify-center rounded-md font-bold text-white ' +
                (size === 'lg' ? 'h-11 w-11 text-base ' : 'h-8 w-8 text-xs ') +
                avatarColor(name)
            }
        >
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

function RoleBadges({ roles }: { roles: string[] }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
                <span
                    key={role}
                    className={
                        'inline-flex max-w-full rounded-full px-3 py-1 text-xs font-bold capitalize ' +
                        (roleBadgeClass[role.toLowerCase()] ?? 'bg-gray-100 text-gray-500')
                    }
                >
                    <span className="truncate">{role}</span>
                </span>
            ))}
        </div>
    );
}

function StatusBadge({ active }: { active: boolean }) {
    return (
        <span
            className={
                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                (active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')
            }
        >
            {active ? 'Active' : 'Inactive'}
        </span>
    );
}

function CustomBadge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            Custom access ({count})
        </span>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-gray-900">{children}</dd>
        </div>
    );
}

export default function UsersIndex({ users, availableRoles, can, authId, permissionAreas }: UsersIndexProps) {
    const [search,       setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
    const [roleFilter,   setRoleFilter]   = useState<string | null>(null); // null = all roles
    // Single source of truth for the Manage panel. Stores the id only, so the user is
    // always read fresh from the `users` prop and can never go stale after a reload.
    const [manage, setManage] = useState<{ id: number; view: ManageView } | null>(null);
    const [busy, setBusy] = useState<{ id: number; action: 'toggle' | 'reset' } | null>(null);
    const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const editForm = useForm({ name: '', email: '', role: '' });
    const permForm = useForm<{ areas: Record<string, boolean> }>({ areas: {} });

    const managedUser = useMemo(
        () => (manage ? users.find((u) => u.id === manage.id) ?? null : null),
        [manage, users],
    );

    // If the managed user disappears from the list, drop the panel state.
    useEffect(() => {
        if (manage && !managedUser) setManage(null);
    }, [manage, managedUser]);

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

    // ── Manage panel navigation ──────────────────────────────────────────────

    function openManage(u: UserRow) {
        editForm.clearErrors();
        permForm.clearErrors();
        setManage({ id: u.id, view: 'overview' });
    }

    function closeManage() {
        // Don't dismiss while a request is running.
        if (busy || editForm.processing || permForm.processing) return;
        setManage(null);
        editForm.clearErrors();
        permForm.clearErrors();
    }

    function goTo(view: ManageView) {
        if (!managedUser) return;
        if (view === 'edit') {
            editForm.clearErrors();
            editForm.setData({ name: managedUser.name, email: managedUser.email, role: managedUser.roles[0] ?? '' });
        }
        if (view === 'permissions') {
            permForm.clearErrors();
            permForm.setData(
                'areas',
                Object.fromEntries(permissionAreas.map((a) => [a.key, managedUser.areas[a.key].allowed])),
            );
        }
        setManage({ id: managedUser.id, view });
    }

    function backToOverview() {
        if (busy || editForm.processing || permForm.processing) return;
        goTo('overview');
    }

    // ── Actions (same routes and handlers as before) ─────────────────────────

    function submitEdit(e: FormEvent) {
        e.preventDefault();
        if (!managedUser) return;
        setBanner(null);
        editForm.put(route('users.update', managedUser.id), {
            preserveScroll: true,
            onSuccess: (page) => { setManage(null); editForm.clearErrors(); showResult(page); },
        });
    }

    function runToggle(user: UserRow) {
        setBanner(null);
        setBusy({ id: user.id, action: 'toggle' });
        router.patch(route('users.toggle-active', user.id), {}, {
            preserveScroll: true,
            onSuccess: showResult,
            onError: () => showFailure(`Could not update ${user.name}'s account. Please try again.`),
            onFinish: () => { setBusy(null); setManage(null); },
        });
    }

    function toggleActive(user: UserRow) {
        // Deactivating asks for confirmation first; reactivating does not.
        if (user.is_active) {
            goTo('deactivate');
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
            onFinish: () => { setBusy(null); setManage(null); },
        });
    }

    function resetToRole(u: UserRow) {
        permForm.setData('areas', Object.fromEntries(permissionAreas.map((a) => [a.key, u.areas[a.key].role_default])));
    }

    function submitPermissions(e: FormEvent) {
        e.preventDefault();
        if (!managedUser) return;
        setBanner(null);
        permForm.put(route('users.permissions.update', managedUser.id), {
            preserveScroll: true,
            onSuccess: (page) => { setManage(null); permForm.clearErrors(); showResult(page); },
        });
    }

    const headerCell = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400';

    function ManageButton({ u, className }: { u: UserRow; className?: string }) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={className}
                onClick={() => openManage(u)}
                disabled={busy?.id === u.id}
                aria-haspopup="dialog"
                aria-label={`Manage ${u.name}`}
            >
                <Settings2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Manage
            </Button>
        );
    }

    // ── Manage panel views ───────────────────────────────────────────────────

    function renderOverview(u: UserRow) {
        const isSelf = u.id === authId;
        const rowBusy = busy?.id === u.id;
        const customs = customCount(u);

        return (
            <div className="space-y-5">
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Full name">{u.name}{isSelf && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}</Detail>
                    <Detail label="Email"><span className="break-all">{u.email}</span></Detail>
                    <Detail label="Status"><StatusBadge active={u.is_active} /></Detail>
                    <Detail label={u.roles.length > 1 ? 'Assigned roles' : 'Assigned role'}>
                        {u.roles.length > 0 ? <RoleBadges roles={u.roles} /> : <span className="text-gray-400">No role</span>}
                    </Detail>
                    <Detail label="Last login">{formatLastLogin(u.last_login_at)}</Detail>
                    <Detail label="Account type">{u.is_admin ? 'System Admin (full access)' : 'Standard account'}</Detail>
                </dl>

                {u.roles.length > 1 && (
                    <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        This account has {u.roles.length} roles. Accounts are limited to one role, so saving the account
                        in Edit will keep only the one you select.
                    </p>
                )}

                {/* Effective permissions */}
                <section aria-labelledby="effective-access">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 id="effective-access" className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Effective access
                        </h3>
                        <CustomBadge count={customs} />
                    </div>

                    {u.is_admin ? (
                        <p className="mt-2 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            System Admin accounts have full access to every area. Their access cannot be restricted.
                        </p>
                    ) : (
                        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                            {permissionAreas.map((a) => {
                                const s = u.areas[a.key];
                                return (
                                    <li key={a.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800">{a.label}</p>
                                            <p className="text-xs text-gray-500">
                                                Role default: {s.role_default ? 'Allowed' : 'Not allowed'}
                                                {s.source === 'custom' && (
                                                    <span className="ml-1 font-medium text-amber-600">
                                                        · {s.allowed ? 'Added for this user' : 'Removed for this user'}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <span
                                            className={
                                                'rounded px-2 py-0.5 text-xs font-medium ' +
                                                (s.allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')
                                            }
                                        >
                                            {s.allowed ? 'Allowed' : 'Not allowed'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                {/* The four actions */}
                <section aria-labelledby="manage-actions">
                    <h3 id="manage-actions" className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Actions
                    </h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => goTo('edit')}
                            disabled={rowBusy}
                            className={tileBtn + ' border-gray-200 text-gray-700 hover:bg-gray-50'}
                        >
                            <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                            <span>
                                <span className="block text-sm font-medium">Edit account</span>
                                <span className="block text-xs text-gray-500">Change name, email or role.</span>
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => goTo('permissions')}
                            disabled={rowBusy || u.is_admin}
                            aria-describedby={u.is_admin ? 'perm_admin_note' : undefined}
                            className={tileBtn + ' border-gray-200 text-gray-700 hover:bg-gray-50'}
                        >
                            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                            <span>
                                <span className="block text-sm font-medium">Update permissions</span>
                                <span id="perm_admin_note" className="block text-xs text-gray-500">
                                    {u.is_admin ? 'System Admin access cannot be restricted.' : 'Customise which areas this user can view.'}
                                </span>
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => goTo('reset')}
                            disabled={rowBusy}
                            className={tileBtn + ' border-gray-200 text-gray-700 hover:bg-gray-50'}
                        >
                            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                            <span>
                                <span className="block text-sm font-medium">Send password reset link</span>
                                <span className="block break-all text-xs text-gray-500">Emails a link to {u.email}.</span>
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => toggleActive(u)}
                            disabled={rowBusy || isSelf}
                            aria-describedby={isSelf ? 'toggle_self_note' : undefined}
                            className={
                                tileBtn + ' ' +
                                (u.is_active
                                    ? 'border-red-100 text-red-600 hover:bg-red-50'
                                    : 'border-emerald-100 text-emerald-700 hover:bg-emerald-50')
                            }
                        >
                            <PowerOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>
                                <span className="block text-sm font-medium">
                                    {rowBusy && busy?.action === 'toggle'
                                        ? (u.is_active ? 'Deactivating…' : 'Reactivating…')
                                        : (u.is_active ? 'Deactivate account' : 'Reactivate account')}
                                </span>
                                <span id="toggle_self_note" className="block text-xs opacity-80">
                                    {isSelf
                                        ? 'You cannot deactivate your own account.'
                                        : u.is_active ? 'Blocks sign-in immediately.' : 'Restores sign-in access.'}
                                </span>
                            </span>
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    function renderEdit(u: UserRow) {
        return (
            <form onSubmit={submitEdit}>
                <div className="space-y-4">
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
                        {u.roles.length > 1 && (
                            <p role="alert" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                This account currently has {u.roles.length} roles ({u.roles.join(', ')}).
                                Accounts are limited to one role, so saving will remove all of them except the one selected above.
                            </p>
                        )}
                        <InputError message={editForm.errors.role} className="mt-1" />
                    </div>
                </div>

                <div className={footerRow}>
                    <Button type="button" variant="outline" className={footerBtn} onClick={backToOverview} disabled={editForm.processing}>Back</Button>
                    <Button type="submit" className={footerBtn} disabled={editForm.processing}>
                        {editForm.processing ? 'Saving…' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        );
    }

    function renderPermissions(u: UserRow) {
        return (
            <form onSubmit={submitPermissions}>
                <p className="text-sm text-gray-600">
                    Areas <span className="font-medium">{u.name}</span> can view. Role:{' '}
                    <span className="capitalize">{u.roles.join(', ')}</span>.
                </p>

                <div className="mt-5 space-y-5">
                    {Object.entries(areaGroups).map(([group, areas]) => (
                        <fieldset key={group}>
                            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">{group}</legend>
                            <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                                {areas.map((a) => {
                                    const checked = permForm.data.areas[a.key] ?? false;
                                    const def = u.areas[a.key].role_default;
                                    const note = checked === def ? 'Role default' : checked ? 'Added for this user' : 'Removed for this user';
                                    return (
                                        <label key={a.key} className="flex cursor-pointer flex-wrap items-start gap-3 p-3">
                                            <input type="checkbox" className="mt-1" checked={checked}
                                                onChange={(e) => permForm.setData('areas', { ...permForm.data.areas, [a.key]: e.target.checked })} />
                                            <span className="min-w-0 flex-1">
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

                <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => resetToRole(u)} disabled={permForm.processing}>
                        Reset to role
                    </Button>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                        <Button type="button" variant="outline" className={footerBtn} onClick={backToOverview} disabled={permForm.processing}>Back</Button>
                        <Button type="submit" className={footerBtn} disabled={permForm.processing}>
                            {permForm.processing ? 'Saving…' : 'Save'}
                        </Button>
                    </div>
                </div>
            </form>
        );
    }

    function renderConfirm(u: UserRow, kind: 'deactivate' | 'reset') {
        const working = busy?.id === u.id;
        return (
            <div>
                {kind === 'deactivate' ? (
                    <p className="text-sm text-gray-600">
                        <span className="font-medium">{u.name}</span> will immediately lose access to the system. Their records and audit trail will be preserved.
                    </p>
                ) : (
                    <p className="text-sm text-gray-600">
                        A password reset link will be emailed to <span className="break-all font-medium">{u.email}</span>.
                        Their current password keeps working until they use the link.
                    </p>
                )}
                <div className={footerRow}>
                    <Button type="button" variant="outline" className={footerBtn} onClick={backToOverview} disabled={working}>Cancel</Button>
                    <Button
                        type="button"
                        className={footerBtn + (kind === 'deactivate' ? ' bg-red-600 hover:bg-red-700' : '')}
                        onClick={() => (kind === 'deactivate' ? runToggle(u) : runPasswordReset(u))}
                        disabled={working}
                    >
                        {kind === 'deactivate'
                            ? (working ? 'Deactivating…' : 'Deactivate')
                            : (working ? 'Sending…' : 'Send reset link')}
                    </Button>
                </div>
            </div>
        );
    }

    const viewTitle: Record<ManageView, string> = {
        overview: 'Manage User',
        edit: 'Edit Account',
        permissions: 'Update Permissions',
        deactivate: 'Deactivate Account',
        reset: 'Send Password Reset Link',
    };

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
                        <span className="min-w-0 break-words">{banner.message}</span>
                        <button
                            type="button"
                            onClick={() => setBanner(null)}
                            aria-label="Dismiss message"
                            className={'shrink-0 rounded p-0.5 hover:bg-white/60 ' + focusRing}
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
                                {/* Search + filters */}
                                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_14rem]">
                                    <div className="sm:col-span-2 lg:col-span-1">
                                        <Label htmlFor="user-search" className="sr-only">Search users by name or email</Label>
                                        <div className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 shadow-sm focus-within:ring-2 focus-within:ring-emerald-600">
                                            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                                            <input
                                                id="user-search"
                                                type="search"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder="Search by name or email…"
                                                className="w-full min-w-0 border-0 p-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="status-filter" className="sr-only">Filter by account status</Label>
                                        <select
                                            id="status-filter"
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value as StatusKey)}
                                            className={selectClass}
                                        >
                                            {statusFilters.map((s) => (
                                                <option key={s.key} value={s.key}>
                                                    {s.key === 'all' ? 'All statuses' : s.label} ({statusCounts[s.key]})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <Label htmlFor="role-filter" className="sr-only">Filter by role</Label>
                                        <select
                                            id="role-filter"
                                            value={roleFilter ?? ''}
                                            onChange={(e) => setRoleFilter(e.target.value === '' ? null : e.target.value)}
                                            className={selectClass}
                                        >
                                            <option value="">All roles ({roleCounts.all})</option>
                                            {availableRoles.map((role) => (
                                                <option key={role} value={role}>{role} ({roleCounts.map[role] ?? 0})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <p className="mb-2 text-xs text-gray-500" aria-live="polite">
                                    Showing {filteredUsers.length} of {users.length} account{users.length === 1 ? '' : 's'}
                                </p>

                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className={'mb-2 ml-2 text-xs font-medium text-emerald-700 hover:underline ' + focusRing}
                                    >
                                        Clear filters
                                    </button>
                                )}

                                {filteredUsers.length === 0 ? (
                                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center shadow-sm">
                                        <p className="text-sm font-medium text-gray-700">No users match your search or filters.</p>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Try a different search term, or clear the filters to see every account.
                                        </p>
                                        {hasActiveFilters && (
                                            <Button type="button" variant="outline" className="mt-4" onClick={clearFilters}>
                                                Clear filters
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {/* Mobile + tablet: cards */}
                                        <ul className="grid gap-3 sm:grid-cols-2 lg:hidden" aria-label="System user accounts">
                                            {filteredUsers.map((u) => {
                                                const isSelf = u.id === authId;
                                                return (
                                                    <li
                                                        key={u.id}
                                                        className={'min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm ' + (u.is_active ? '' : 'opacity-70')}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <Avatar name={u.name} />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="break-words text-sm font-medium text-gray-800">
                                                                    {u.name}
                                                                    {isSelf && <span className="ml-1.5 text-xs font-normal text-gray-400">(you)</span>}
                                                                </p>
                                                                <p className="break-all text-xs text-gray-500">{u.email}</p>
                                                            </div>
                                                            <StatusBadge active={u.is_active} />
                                                        </div>
                                                        <div className="mt-3 space-y-2">
                                                            <RoleBadges roles={u.roles} />
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {u.is_admin && <span className="text-xs font-medium text-gray-500">Full access</span>}
                                                                <CustomBadge count={customCount(u)} />
                                                            </div>
                                                            <p className="text-xs text-gray-500">Last login: {formatLastLogin(u.last_login_at)}</p>
                                                        </div>
                                                        {can.edit && (
                                                            <div className="mt-4 border-t border-gray-100 pt-3">
                                                                <ManageButton u={u} className="w-full" />
                                                            </div>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>

                                        {/* Large screens: table (no horizontal scroll) */}
                                        <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
                                            <table className="w-full table-fixed divide-y divide-gray-100">
                                                <caption className="sr-only">System user accounts</caption>
                                                <thead className="bg-gray-50/60">
                                                    <tr>
                                                        <th scope="col" className={headerCell + ' w-14'}>#</th>
                                                        <th scope="col" className={headerCell}>User</th>
                                                        <th scope="col" className={headerCell + ' w-52'}>Role</th>
                                                        <th scope="col" className={headerCell + ' w-32'}>Status</th>
                                                        <th scope="col" className={headerCell + ' w-44'}>Last Login</th>
                                                        {can.edit && (
                                                            <th scope="col" className="w-32 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                                Actions
                                                            </th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {filteredUsers.map((u, index) => {
                                                        const isSelf = u.id === authId;
                                                        return (
                                                            <tr key={u.id} className={'hover:bg-gray-50/60 ' + (u.is_active ? '' : 'opacity-60')}>
                                                                <td className="px-4 py-3 text-sm text-gray-400">
                                                                    {String(index + 1).padStart(2, '0')}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex min-w-0 items-center gap-3">
                                                                        <Avatar name={u.name} />
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-sm font-medium text-gray-800" title={u.name}>
                                                                                {u.name}
                                                                                {isSelf && <span className="ml-1.5 text-xs font-normal text-gray-400">(you)</span>}
                                                                            </p>
                                                                            <p className="truncate text-xs text-gray-500" title={u.email}>{u.email}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="space-y-1.5">
                                                                        <RoleBadges roles={u.roles} />
                                                                        <CustomBadge count={customCount(u)} />
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3"><StatusBadge active={u.is_active} /></td>
                                                                <td className="px-4 py-3 text-xs text-gray-500">{formatLastLogin(u.last_login_at)}</td>
                                                                {can.edit && (
                                                                    <td className="px-4 py-3 text-right"><ManageButton u={u} /></td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Manage modal: fixed header, scrollable body, fixed footer */}
            <Modal show={managedUser !== null} onClose={closeManage} maxWidth="2xl">
                {managedUser && manage && (
                    <div className="flex max-h-[calc(100dvh-3rem)] flex-col">
                        {/* Fixed header */}
                        <div className="shrink-0 border-b border-gray-100 p-4 sm:p-6">
                            <div className="flex items-start gap-3">
                                <Avatar name={managedUser.name} size="lg" />
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-lg font-medium text-gray-900">{viewTitle[manage.view]}</h2>
                                    <p className="break-words text-sm text-gray-600">
                                        <span className="font-medium">{managedUser.name}</span>
                                    </p>
                                    <p className="break-all text-xs text-gray-500">{managedUser.email}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeManage}
                                    aria-label="Close"
                                    className={'shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 ' + focusRing}
                                >
                                    <X className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>

                            {manage.view !== 'overview' && (
                                <button
                                    type="button"
                                    onClick={backToOverview}
                                    className={'mt-3 inline-flex items-center gap-1 rounded text-xs font-medium text-emerald-700 hover:underline ' + focusRing}
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                    Back to details
                                </button>
                            )}
                        </div>

                        {/* Scrollable content */}
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
                            {manage.view === 'overview' && renderOverview(managedUser)}
                            {manage.view === 'edit' && renderEdit(managedUser)}
                            {manage.view === 'permissions' && !managedUser.is_admin && renderPermissions(managedUser)}
                            {manage.view === 'deactivate' && renderConfirm(managedUser, 'deactivate')}
                            {manage.view === 'reset' && renderConfirm(managedUser, 'reset')}
                        </div>

                        {/* Fixed footer (overview only) */}
                        {manage.view === 'overview' && (
                            <div className="shrink-0 border-t border-gray-100 p-4 sm:px-6">
                                <Button type="button" variant="outline" className="w-full sm:ml-auto sm:flex" onClick={closeManage}>
                                    Close
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </AuthenticatedLayout>
    );
}