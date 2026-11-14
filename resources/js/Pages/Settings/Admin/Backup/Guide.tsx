import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent, CardTitle } from '@/Components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

interface Props {
    content: string | null;
}

export default function BackupGuide({ content }: Props) {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Backup &amp; Restore Guide</h2>}>
            <Head title="Backup & Restore Guide" />

            <div className="mx-auto max-w-4xl space-y-4 px-4 sm:px-6 lg:px-8">
                <Link
                    href={route('settings.backup')}
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:underline"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to System Backup
                </Link>

                <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                        <CardTitle className="text-base">docs/BACKUP_PLAN.md</CardTitle>
                        <p className="mt-1 text-xs text-gray-500">
                            Read-only copy of the guide. Restoring is done manually on the server, never from this page.
                        </p>

                        {content === null ? (
                            <p className="mt-4 text-sm text-red-600">
                                The guide file <code>docs/BACKUP_PLAN.md</code> was not found on the server.
                            </p>
                        ) : (
                            <pre className="mt-4 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800">
                                {content}
                            </pre>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}