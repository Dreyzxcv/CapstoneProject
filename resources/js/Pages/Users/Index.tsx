import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { FormEvent, useMemo, useState } from 'react';
import { Search, UserPlus, Pencil } from 'lucide-react';

interface UserRow {
    id: number;
    name: string;
    email: string;
    roles: string[];
}

interface UsersIndexProps {
    users: UserRow[];
    availableRoles: string[];
    can: { create: boolean; edit: boolean };
}

const roleBadgeClass: Record<string, string> = {
    'system admin': 'bg-red-50 text-red-500',
    'mes officer': 'bg-sky-50 text-sky-600',
    'property custodian': 'bg-amber-50 text-amber-600',
    'accounting officer': 'bg-violet-50 text-violet-500',
    'penro management': 'bg-emerald-50 text-emerald-600',
};

const avatarColors = ['bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];

function avatarColor(name: string) {
    return avatarColors[name.charCodeAt(0) % avatarColors.length];
}

export default function UsersIndex({ users, availableRoles, can }: UsersIndexProps) {
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [editingUser, setEditingUser] = useState<UserRow | null>(null);

    const editForm = useForm({
        name: '',
        email: '',
        role: '',
    });

    // unique roles present in the data, used to build filter pills dynamically
    const allRoles = useMemo(() => {
        const set = new Set<string>();
        users.forEach((u) => u.roles.forEach((r) => set.add(r)));
        return Array.from(set);
    }, [users]);

    const counts = useMemo(() => {
        const map: Record<string, number> = { All: users.length };
        allRoles.forEach((role) => {
            map[role] = users.filter((u) => u.roles.includes(role)).length;
        });
        return map;
    }, [users, allRoles]);

    const filteredUsers = useMemo(() => {
        return users.filter((u) => {
            const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase());
            const matchesFilter = activeFilter === 'All' || u.roles.includes(activeFilter);
            return matchesSearch && matchesFilter;
        });
    }, [users, search, activeFilter]);

    function openEdit(user: UserRow) {
        setEditingUser(user);
        editForm.clearErrors();
        editForm.setData({
            name: user.name,
            email: user.email,
            role: user.roles[0] ?? '',
        });
    }

    function closeEdit() {
        setEditingUser(null);
        editForm.clearErrors();
        editForm.reset();
    }

    function submitEdit(e: FormEvent) {
        e.preventDefault();
        if (!editingUser) return;

        editForm.put(route('users.update', editingUser.id), {
            preserveScroll: true,
            onSuccess: () => closeEdit(),
        });
    }

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">User Management</h2>}>
            <Head title="Users" />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="mt-1 text-sm text-gray-500">
                            {users.length} account{users.length === 1 ? '' : 's'} registered
                        </p>
                    </div>
                    {can.create && (
                        <Link href={route('users.create')}>
                            <Button>
                                <UserPlus className="mr-1.5 h-4 w-4" />
                                New User
                            </Button>
                        </Link>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">System Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Search */}
                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                            <Search className="h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name..."
                                className="w-full border-0 p-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                            />
                        </div>

                        {/* Filter pills */}
                        <div className="mb-4 flex flex-wrap gap-2">
                            <button
                                onClick={() => setActiveFilter('All')}
                                className={
                                    'rounded-full px-4 py-1.5 text-sm font-semibold transition ' +
                                    (activeFilter === 'All'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
                                }
                            >
                                All ({counts.All})
                            </button>
                            {allRoles.map((role) => (
                                <button
                                    key={role}
                                    onClick={() => setActiveFilter(role)}
                                    className={
                                        'rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ' +
                                        (activeFilter === role
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
                                    }
                                >
                                    {role} ({counts[role] ?? 0})
                                </button>
                            ))}
                        </div>

                        {/* Table */}
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50/60">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Email</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Roles</th>
                                        {can.edit && (
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                Actions
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredUsers.map((u, index) => (
                                        <tr key={u.id} className="hover:bg-gray-50/60">
                                            <td className="px-4 py-3 text-sm text-gray-400">
                                                {String(index + 1).padStart(2, '0')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className={
                                                            'flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white ' +
                                                            avatarColor(u.name)
                                                        }
                                                    >
                                                        {u.name.charAt(0).toUpperCase()}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-800">{u.name}</span>
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
                                            {can.edit && (
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => openEdit(u)}
                                                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-emerald-700"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Edit
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}

                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={can.edit ? 5 : 4} className="px-4 py-10 text-center text-sm text-gray-400">
                                                No users found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Edit profile modal */}
            <Modal show={editingUser !== null} onClose={closeEdit} maxWidth="md">
                {editingUser && (
                    <form onSubmit={submitEdit} className="p-6">
                        <h2 className="text-lg font-medium text-gray-900">Edit User</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Update profile information for <span className="font-medium">{editingUser.name}</span>.
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
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    required
                                >
                                    <option value="" disabled>
                                        Select a role
                                    </option>
                                    {availableRoles.map((role) => (
                                        <option key={role} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={editForm.errors.role} className="mt-1" />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                            <Button type="button" variant="outline" onClick={closeEdit}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={editForm.processing}>
                                Save Changes
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>
        </AuthenticatedLayout>
    );
}