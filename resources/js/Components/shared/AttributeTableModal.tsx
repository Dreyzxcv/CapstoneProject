import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Transition } from '@headlessui/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/Components/ui/table';
import { ArrowDown, ArrowUp, Download, Filter, Loader2, Plus, Trash2, X } from 'lucide-react';

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
}

interface AssetsPayload {
    data: Record<string, unknown>[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
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

const selectClass =
    'h-9 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

function emptyClause(firstField: string): Clause {
    return { field: firstField, operator: 'eq', value: '' };
}

interface AttributeTableModalProps {
    show: boolean;
    onClose: () => void;
}

export default function AttributeTableModal({ show, onClose }: AttributeTableModalProps) {
    const [columns, setColumns] = useState<ColumnDef[]>([]);
    const [assets, setAssets] = useState<AssetsPayload | null>(null);
    const [clauses, setClauses] = useState<Clause[]>([]);
    const [combinator, setCombinator] = useState<'and' | 'or'>('and');
    const [sort, setSort] = useState('id');
    const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
    const [loading, setLoading] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);

    const columnByKey = Object.fromEntries(columns.map((c) => [c.key, c]));

    const fetchData = useCallback(
        async (
            page = 1,
            overrides: Partial<{
                clauses: Clause[];
                combinator: 'and' | 'or';
                sort: string;
                direction: 'asc' | 'desc';
            }> = {},
        ) => {
            setLoading(true);
            try {
                const response = await axios.get(route('reports.attribute-table.data'), {
                    params: {
                        clauses: overrides.clauses ?? clauses,
                        combinator: overrides.combinator ?? combinator,
                        sort: overrides.sort ?? sort,
                        direction: overrides.direction ?? direction,
                        page,
                    },
                });
                setColumns(response.data.columns);
                setAssets(response.data.assets);
            } finally {
                setLoading(false);
            }
        },
        [clauses, combinator, sort, direction],
    );

    useEffect(() => {
        if (show) {
            fetchData(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    // Prevent the page behind the fullscreen modal from scrolling, and
    // allow Escape to close it — matches the Confiscation Locations
    // fullscreen map behavior.
    useEffect(() => {
        if (!show) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                onClose();
            }
        }

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [show, onClose]);

    function addClause() {
        setClauses((prev) => [...prev, emptyClause(columns[0]?.key ?? 'id')]);
        setPanelOpen(true);
    }

    function updateClause(index: number, patch: Partial<Clause>) {
        setClauses((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    }

    function removeClause(index: number) {
        setClauses((prev) => prev.filter((_, i) => i !== index));
    }

    function runQuery() {
        fetchData(1);
    }

    function clearAll() {
        setClauses([]);
        fetchData(1, { clauses: [] });
    }

    function toggleSort(key: string) {
        const nextDirection = sort === key && direction === 'asc' ? 'desc' : 'asc';
        setSort(key);
        setDirection(nextDirection);
        fetchData(1, { sort: key, direction: nextDirection });
    }

    function exportCsv() {
        const params = new URLSearchParams();
        clauses.forEach((c, i) => {
            params.append(`clauses[${i}][field]`, c.field);
            params.append(`clauses[${i}][operator]`, c.operator);
            params.append(`clauses[${i}][value]`, c.value);
        });
        params.set('combinator', combinator);
        window.open(`${route('reports.attribute-table.export')}?${params.toString()}`, '_blank');
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
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
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

    if (!show) return null;

    return (
        <>
            {/* Backdrop — same treatment as the Confiscation Locations fullscreen map */}
            <div className="fixed inset-0 z-[9998] bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />

            <Transition
                show={show}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
            >
                <div className="fixed inset-4 z-[9999] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl sm:inset-8">
                    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Attribute Table</h2>
                            <p className="text-sm text-gray-500">
                                Raw asset records
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="rounded-lg border border-gray-200">
                            <div
                                className="flex cursor-pointer items-center justify-between px-4 py-3"
                                onClick={() => setPanelOpen((p) => !p)}
                            >
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-emerald-700" />
                                    <span className="text-sm font-semibold text-gray-800">Select by Attribute</span>
                                    {clauses.length > 0 && (
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                            {clauses.length} clause{clauses.length === 1 ? '' : 's'}
                                        </span>
                                    )}
                                </div>
                                <Button type="button" variant="ghost" size="sm">
                                    {panelOpen ? 'Hide' : 'Show'}
                                </Button>
                            </div>

                            {panelOpen && (
                                <div className="space-y-4 border-t border-gray-100 px-4 py-4">
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
                                                            <option key={c.key} value={c.key}>
                                                                {c.label}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    <select
                                                        className={selectClass}
                                                        value={clause.operator}
                                                        onChange={(e) =>
                                                            updateClause(index, { operator: e.target.value, value: '' })
                                                        }
                                                    >
                                                        {operators.map((o) => (
                                                            <option key={o.value} value={o.value}>
                                                                {o.label}
                                                            </option>
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
                                        {clauses.length > 0 && (
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
                                </div>
                            )}
                        </div>

                        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 text-sm text-gray-500">
                                <span>
                                    {assets
                                        ? `Showing ${assets.from ?? 0}–${assets.to ?? 0} of ${assets.total} record${assets.total === 1 ? '' : 's'}`
                                        : 'Loading…'}
                                </span>
                                {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />}
                            </div>
                            <div className="[&_[data-slot=table-container]]:max-h-[62vh] [&_[data-slot=table-container]]:overflow-y-auto">
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
                                                            {sort === col.key &&
                                                                (direction === 'asc' ? (
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
                                            {!assets || assets.data.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={columns.length || 1} className="py-10 text-center text-sm text-gray-400">
                                                        {loading ? 'Loading…' : 'No records match this query.'}
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
                            </div>

                            {assets && assets.last_page > 1 && (
                                <div className="flex items-center justify-center gap-2 border-t border-gray-100 px-4 py-3 text-sm">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={assets.current_page <= 1}
                                        onClick={() => fetchData(assets.current_page - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <span className="text-gray-500">
                                        Page {assets.current_page} of {assets.last_page}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={assets.current_page >= assets.last_page}
                                        onClick={() => fetchData(assets.current_page + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
            </Transition>
        </>
    );
}