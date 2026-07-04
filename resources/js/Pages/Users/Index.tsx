import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';

interface UsersIndexProps {
    users: Array<{ id: number; name: string; email: string; roles: string[] }>;
    can: { create: boolean };
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

export default function UsersIndex({ users, can }: UsersIndexProps) {
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');

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
                                        </tr>
                                    ))}

                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
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
        </AuthenticatedLayout>
    );
}