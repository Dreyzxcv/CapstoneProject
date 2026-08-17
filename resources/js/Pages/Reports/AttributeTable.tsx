import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/Components/ui/table';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Download, Filter, Plus, Trash2, X } from 'lucide-react';

interface ColumnOption {
    value: string;
    label: string;
}

interface ColumnDef {
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'date' | 'select';
    options?: ColumnOption[];
}

interface Clause {
    field: string;
    operator: string;
    value: string;
    [key: string]: string;
}

interface QueryPayload {
    clauses: Clause[];
    combinator: 'and' | 'or';
    sort: string;
    direction: 'asc' | 'desc';
    [key: string]: unknown;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface AttributeTableProps {
    assets: {
        data: Record<string, unknown>[];
        links: PaginationLink[];
        from: number | null;
        to: number | null;
        total: number;
    };
    columns: ColumnDef[];
    filters: {
        clauses: Clause[];
        combinator: 'and' | 'or';
        sort: string;
        direction: 'asc' | 'desc';
    };
}

const OPERATORS_BY_TYPE: Record<string, Array<{ value: string; label: string }>> = {
    text: [
        { value: 'eq', label: 'is' },
        { value: 'neq', label: 'is not' },
        { value: 'contains', label: 'contains' },
        { value: 'starts_with', label: 'starts with' },
        { value: 'null', label: 'is empty' },
        { value: 'not_null', label: 'is not empty' },
    ],
    number: [
        { value: 'eq', label: '=' },
        { value: 'neq', label: '≠' },
        { value: 'gt', label: '>' },
        { value: 'lt', label: '<' },
        { value: 'gte', label: '≥' },
        { value: 'lte', label: '≤' },
        { value: 'null', label: 'is empty' },
        { value: 'not_null', label: 'is not empty' },
    ],
    date: [
        { value: 'eq', label: 'is' },
        { value: 'gt', label: 'after' },
        { value: 'lt', label: 'before' },
        { value: 'gte', label: 'on or after' },
        { value: 'lte', label: 'on or before' },
        { value: 'null', label: 'is empty' },
        { value: 'not_null', label: 'is not empty' },
    ],
    boolean: [{ value: 'eq', label: 'is' }],
    select: [
        { value: 'eq', label: 'is' },
        { value: 'neq', label: 'is not' },
        { value: 'null', label: 'is empty' },
        { value: 'not_null', label: 'is not empty' },
    ],
};

function emptyClause(firstField: string): Clause {
    return { field: firstField, operator: 'eq', value: '' };
}

const selectClass =
    'h-9 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

export default function AttributeTable({ assets, columns, filters }: AttributeTableProps) {
    const columnByKey = Object.fromEntries(columns.map((c) => [c.key, c]));
    const [clauses, setClauses] = useState<Clause[]>(
        filters.clauses.length > 0 ? filters.clauses : [],
    );
    const [combinator, setCombinator] = useState<'and' | 'or'>(filters.combinator);
    const [panelOpen, setPanelOpen] = useState(filters.clauses.length > 0);

    function addClause() {
        setClauses((prev) => [...prev, emptyClause(columns[0]?.key ?? '')]);
        setPanelOpen(true);
    }

    function updateClause(index: number, patch: Partial<Clause>) {
        setClauses((prev) =>
            prev.map((c, i) => (i === index ? { ...c, ...patch } : c)) as Clause[],
        );
    }

    function removeClause(index: number) {
        setClauses((prev) => prev.filter((_, i) => i !== index));
    }

    function buildQuery(overrides: Partial<QueryPayload> = {}): QueryPayload {
        return {
            clauses,
            combinator,
            sort: filters.sort,
            direction: filters.direction,
            ...overrides,
        };
    }

    function runQuery() {
        router.get(route('reports.attribute-table'), buildQuery() as unknown as Record<string, any>, {
            preserveState: true,
            preserveScroll: true,
        });
    }

    function clearAll() {
        setClauses([]);
        router.get(
            route('reports.attribute-table'),
            {
                clauses: [] as Clause[],
                combinator: 'and' as const,
                sort: filters.sort,
                direction: filters.direction,
            } as unknown as Record<string, any>,
            { preserveState: true, preserveScroll: true },
        );
    }

    function toggleSort(key: string) {
        const nextDirection = filters.sort === key && filters.direction === 'asc' ? 'desc' : 'asc';
        router.get(
            route('reports.attribute-table'),
            buildQuery({ sort: key, direction: nextDirection }) as unknown as Record<string, any>,
            { preserveState: true, preserveScroll: true },
        );
    }

    function exportCsv() {
        const params = new URLSearchParams();
        clauses.forEach((c, i) => {
            params.append(`clauses[${i}][field]`, c.field);
            params.append(`clauses[${i}][operator]`, c.operator);
            params.append(`clauses[${i}][value]`, c.value);
        });
        params.set('combinator', combinator);
        window.location.href = `${route('reports.attribute-table.export')}?${params.toString()}`;
    }

    function renderValueInput(clause: Clause, index: number) {
        const col = columnByKey[clause.field];
        if (!col || clause.operator === 'null' || clause.operator === 'not_null') return null;

        if (col.type === 'boolean') {
            return (
                <select
                    className={selectClass}
                    value={clause.value}
                    onChange={(e) => updateClause(index, { value: e.target.value })}
                >
                    <option value="">Select…</option>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                </select>
            );
        }

        if (col.type === 'select') {
            return (
                <select
                    className={selectClass}
                    value={clause.value}
                    onChange={(e) => updateClause(index, { value: e.target.value })}
                >
                    <option value="">Select…</option>
                    {col.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            );
        }

        return (
            <Input
                type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                value={clause.value}
                onChange={(e) => updateClause(index, { value: e.target.value })}
                className="h-9 w-full sm:w-48"
                placeholder="Value"
            />
        );
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">Attribute Table</h2>
                        <p className="text-sm text-gray-500">
                            Raw asset records
                        </p>
                    </div>
                    <Link href={route('reports.index')}>
                        <Button variant="outline">Back to Reports</Button>
                    </Link>
                </div>
            }
        >
            <Head title="Attribute Table" />

            <div className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6 lg:px-8">
                <Card>
                    <CardHeader
                        className="cursor-pointer flex-row items-center justify-between pb-3"
                        onClick={() => setPanelOpen((p) => !p)}
                    >
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-emerald-700" />
                            <CardTitle className="text-base">Select by Attribute</CardTitle>
                            {clauses.length > 0 && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                    {clauses.length} clause{clauses.length === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>
                        <Button type="button" variant="ghost" size="sm">
                            {panelOpen ? 'Hide' : 'Show'}
                        </Button>
                    </CardHeader>

                    {panelOpen && (
                        <CardContent className="space-y-4 pt-0">
                            {clauses.length > 1 && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <span>Combine clauses using</span>
                                    <select
                                        className={selectClass}
                                        value={combinator}
                                        onChange={(e) => setCombinator(e.target.value as 'and' | 'or')}
                                    >
                                        <option value="and">AND</option>
                                        <option value="or">OR</option>
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                {clauses.map((clause, index) => {
                                    const col = columnByKey[clause.field];
                                    const operators = OPERATORS_BY_TYPE[col?.type ?? 'text'];
                                    return (
                                        <div
                                            key={index}
                                            className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2"
                                        >
                                            <select
                                                className={selectClass}
                                                value={clause.field}
                                                onChange={(e) => {
                                                    const nextCol = columnByKey[e.target.value];
                                                    const nextOps = OPERATORS_BY_TYPE[nextCol?.type ?? 'text'];
                                                    updateClause(index, {
                                                        field: e.target.value,
                                                        operator: nextOps[0].value,
                                                        value: '',
                                                    });
                                                }}
                                            >
                                                {columns.map((c) => (
                                                    <option key={c.key} value={c.key}>{c.label}</option>
                                                ))}
                                            </select>

                                            <select
                                                className={selectClass}
                                                value={clause.operator}
                                                onChange={(e) => updateClause(index, { operator: e.target.value, value: '' })}
                                            >
                                                {operators.map((o) => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>

                                            {renderValueInput(clause, index)}

                                            <button
                                                type="button"
                                                onClick={() => removeClause(index)}
                                                className="ml-auto rounded-md p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                                                aria-label="Remove clause"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                                <Button type="button" variant="outline" size="sm" onClick={addClause}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Add Clause
                                </Button>
                                <Button type="button" size="sm" onClick={runQuery}>
                                    Apply Query
                                </Button>
                                {(clauses.length > 0 || filters.clauses.length > 0) && (
                                    <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                        Clear All
                                    </Button>
                                )}
                                <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={exportCsv}>
                                    <Download className="mr-1.5 h-3.5 w-3.5" />
                                    Export Results (CSV)
                                </Button>
                            </div>
                        </CardContent>
                    )}
                </Card>

                <Card className="overflow-hidden p-0">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 text-sm text-gray-500">
                        <span>
                            Showing {assets.from ?? 0}–{assets.to ?? 0} of {assets.total} record{assets.total === 1 ? '' : 's'}
                        </span>
                    </div>
                    <div className="max-h-[65vh] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columns.map((col) => (
                                        <TableHead
                                            key={col.key}
                                            className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-gray-50 shadow-[0_1px_0_0_theme(colors.gray.200)]"
                                            onClick={() => toggleSort(col.key)}
                                        >
                                            <span className="flex items-center gap-1">
                                                {col.label}
                                                {filters.sort === col.key &&
                                                    (filters.direction === 'asc' ? (
                                                        <ArrowUp className="h-3 w-3" />
                                                    ) : (
                                                        <ArrowDown className="h-3 w-3" />
                                                    ))}
                                            </span>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {assets.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-gray-400">
                                            No records match this query.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    assets.data.map((row, i) => (
                                        <TableRow key={(row.id as number) ?? i}>
                                            {columns.map((col) => {
                                                const value = row[col.key];
                                                let display: string;
                                                if (value === null || value === undefined) display = '—';
                                                else if (typeof value === 'boolean') display = value ? 'Yes' : 'No';
                                                else display = String(value);
                                                return (
                                                    <TableCell key={col.key} className="whitespace-nowrap text-sm">
                                                        {display}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {assets.links.length > 3 && (
                        <div className="flex flex-wrap items-center justify-center gap-1 border-t border-gray-100 px-4 py-3">
                            {assets.links.map((link, index) => (
                                <Link
                                    key={index}
                                    href={link.url ?? '#'}
                                    preserveScroll
                                    preserveState
                                    className={
                                        'min-w-9 rounded-md px-3 py-1.5 text-center text-sm ' +
                                        (link.active
                                            ? 'bg-emerald-700 text-white'
                                            : link.url
                                                ? 'text-gray-600 hover:bg-gray-100'
                                                : 'cursor-default text-gray-300')
                                    }
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}