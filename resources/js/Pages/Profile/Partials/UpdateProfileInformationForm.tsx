import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    className = '',
}: {
    mustVerifyEmail: boolean;
    status?: string;
    className?: string;
}) {
    const user = usePage().props.auth.user!;
    const canEdit = user.roles?.includes('System Admin') ?? false;

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            email: user.email,
        });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        patch(route('profile.update'));
    };

    const verificationNotice = mustVerifyEmail &&
        user.email_verified_at === null && (
            <div>
                <p className="mt-2 text-sm text-gray-800">
                    Your email address is unverified.
                    <Link
                        href={route('verification.send')}
                        method="post"
                        as="button"
                        className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        Click here to re-send the verification email.
                    </Link>
                </p>

                {status === 'verification-link-sent' && (
                    <div className="mt-2 text-sm font-medium text-green-600">
                        A new verification link has been sent to your email
                        address.
                    </div>
                )}
            </div>
        );

    if (!canEdit) {
        return (
            <section className={className}>
                <dl className="space-y-4">
                    <div>
                        <dt className="text-sm font-medium text-gray-700">Name</dt>
                        <dd className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                            {user.name}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-700">Email</dt>
                        <dd className="mt-1 break-all rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                            {user.email}
                        </dd>
                    </div>
                </dl>

                <p className="mt-3 text-xs text-gray-500">
                    Only a System Admin can change this information.
                </p>

                {verificationNotice}
            </section>
        );
    }

    return (
        <section className={className}>
            <form onSubmit={submit} className="mt-2 space-y-6">
                <div>
                    <InputLabel htmlFor="name" value="Name" />

                    <TextInput
                        id="name"
                        className="mt-1 block w-full"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                        isFocused
                        autoComplete="name"
                    />

                    <InputError className="mt-2" message={errors.name} />
                </div>

                <div>
                    <InputLabel htmlFor="email" value="Email" />

                    <TextInput
                        id="email"
                        type="email"
                        className="mt-1 block w-full"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                        autoComplete="username"
                    />

                    <InputError className="mt-2" message={errors.email} />
                </div>

                {verificationNotice}

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>Save</PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-gray-600">Saved.</p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}