import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent, CardTitle } from '@/Components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { Users, ChevronRight, SlidersHorizontal, Info } from 'lucide-react';
import { ComponentType } from 'react';

interface SettingsCard {
    key: string;
    title: string;
    description: string;
    href: string;
    icon: string;
}

interface Props {
    cards: SettingsCard[];
}

function PesoIcon({ className }: { className?: string }) {
    return <span className={`flex items-center justify-center font-bold ${className ?? ''}`}>₱</span>;
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
    Users,
    Peso: PesoIcon,
    Info,
};

export default function SettingsIndex({ cards }: Props) {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Settings</h2>}>
            <Head title="Settings" />

            <div className="mx-auto max-w-4xl space-y-4 px-4 sm:px-6 lg:px-8">
                {cards.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-500">
                        You don't have access to any settings sections.
                    </p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {cards.map((card) => {
                            const Icon = ICONS[card.icon] ?? SlidersHorizontal;
                            return (
                                <Link key={card.key} href={card.href}>
                                    <Card className="h-full border-0 shadow-sm transition hover:shadow-md hover:ring-1 hover:ring-emerald-200">
                                        <CardContent className="flex items-start gap-4 pt-6">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <div className="flex-1">
                                                <CardTitle className="text-base">{card.title}</CardTitle>
                                                <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                                            </div>
                                            <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-gray-300" />
                                        </CardContent>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}