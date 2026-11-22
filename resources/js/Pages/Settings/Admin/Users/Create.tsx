import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';

interface RoleOption {
    name: string;
    description: string | null;
    privileged: boolean;
}

interface CreateProps {
    roles: RoleOption[];
}

export default function UsersCreate({ roles }: CreateProps) {
    const { data, setData, post, processing, errors, setError, clearErrors, transform } = useForm({
        name: '',
        email: '',
        role: '',
        acknowledge_privileged: false,
    });
    const submitting = useRef(false);

    const selectedRole = roles.find((r) => r.name === data.role);
    const needsAck = !!selectedRole?.privileged;

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing || submitting.current) return; // block double submission

        const name = data.name.replace(/\s+/g, ' ').trim();
        if (name === '') {
            setError('name', 'Full name cannot be blank.');
            return;
        }
        clearErrors();

        transform((d) => ({
            ...d,
            name,
            email: d.email.trim().toLowerCase(),
            acknowledge_privileged: needsAck ? d.acknowledge_privileged : null,
        }));

        submitting.current = true;
        post(route('users.store'), { onFinish: () => { submitting.current = false; } });
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-gray-800">New User Account</h2>}
        >
            <Head title="New User" />

            <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-xl">Create Account</CardTitle>
                        <p className="text-sm text-gray-600">
                            The account is active immediately. A secure setup link is emailed so the user can choose
                            their own password. You never see or set it.
                        </p>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={submit} className="space-y-6" noValidate>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        autoComplete="name"
                                        aria-invalid={!!errors.name}
                                        aria-describedby={errors.name ? 'name_error' : undefined}
                                        required
                                    />
                                    <div id="name_error"><InputError message={errors.name} /></div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        autoComplete="off"
                                        aria-invalid={!!errors.email}
                                        aria-describedby={'email_help' + (errors.email ? ' email_error' : '')}
                                        required
                                    />
                                    <p id="email_help" className="text-xs text-gray-500">
                                        The setup link is sent to this address.
                                    </p>
                                    <div id="email_error"><InputError message={errors.email} /></div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                <select
                                    id="role"
                                    value={data.role}
                                    onChange={(e) => {
                                        setData((prev) => ({ ...prev, role: e.target.value, acknowledge_privileged: false }));
                                    }}
                                    aria-invalid={!!errors.role}
                                    aria-describedby={'role_help' + (selectedRole?.description ? ' role_desc' : '') + (errors.role ? ' role_error' : '')}
                                    required
                                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                >
                                    <option value="" disabled>Select a role</option>
                                    {roles.map((role) => (
                                        <option key={role.name} value={role.name}>{role.name}</option>
                                    ))}
                                </select>
                                {selectedRole?.description && (
                                    <p id="role_desc" className="text-xs text-gray-600">{selectedRole.description}</p>
                                )}
                                <p id="role_help" className="text-xs text-gray-500">
                                    Each account has exactly one role. You can change it later from the user list.
                                </p>
                                <div id="role_error"><InputError message={errors.role} /></div>
                            </div>

                            {needsAck && (
                                <div role="alert" className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                                    <p className="flex items-center gap-1.5 font-medium">
                                        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                                        Privileged role
                                    </p>
                                    <p className="text-xs">
                                        <span className="font-medium">{selectedRole!.name}</span> can manage users and
                                        other administrator-only settings. Only assign it to people who need that access.
                                    </p>
                                    <label className="flex items-start gap-2 text-xs">
                                        <input
                                            type="checkbox"
                                            className="mt-0.5"
                                            checked={data.acknowledge_privileged}
                                            onChange={(e) => setData('acknowledge_privileged', e.target.checked)}
                                            aria-describedby={errors.acknowledge_privileged ? 'ack_error' : undefined}
                                            required
                                        />
                                        <span>I understand and want to grant this role.</span>
                                    </label>
                                    <div id="ack_error"><InputError message={errors.acknowledge_privileged} /></div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                                <Button
                                    type="submit"
                                    disabled={
                                        processing ||
                                        data.name.trim() === '' ||
                                        data.email.trim() === '' ||
                                        data.role === '' ||
                                        (needsAck && !data.acknowledge_privileged)
                                    }
                                >
                                    {processing ? 'Creating…' : 'Create Account'}
                                </Button>
                                <Link href={route('users.index')}>
                                    <Button type="button" variant="outline">Cancel</Button>
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}