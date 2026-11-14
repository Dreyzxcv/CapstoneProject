import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent } from '@/Components/ui/card';
import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Check, Copy } from 'lucide-react';
import { Fragment, ReactNode, useState } from 'react';

interface Props {
    content: string | null;
}

/* ------------------------------------------------------------------ */
/* Tiny markdown parser (headings, paragraphs, lists, tables, quotes,  */
/* code blocks, rules). Output is rendered as React elements only, so  */
/* nothing from the file is ever injected as raw HTML.                 */
/* ------------------------------------------------------------------ */

interface ListItem {
    indent: number;
    marker: string;
    text: string;
    extra: Block[];
}

type Block =
    | { t: 'h'; level: number; text: string; id: string }
    | { t: 'p'; text: string }
    | { t: 'code'; lang: string; code: string }
    | { t: 'quote'; text: string }
    | { t: 'hr' }
    | { t: 'table'; head: string[]; rows: string[][] }
    | { t: 'list'; items: ListItem[] };

const LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

const stripMd = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '');
const slug = (s: string) =>
    stripMd(s)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const splitRow = (line: string) =>
    line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());

function startsBlock(lines: string[], i: number): boolean {
    const line = lines[i];
    const t = line.trim();
    return (
        t.startsWith('```') ||
        /^#{1,4}\s/.test(t) ||
        /^-{3,}$/.test(t) ||
        t.startsWith('>') ||
        LIST_RE.test(line) ||
        (t.startsWith('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1]))
    );
}

function parse(md: string): Block[] {
    const lines = md.replace(/\r\n?/g, '\n').split('\n');
    const blocks: Block[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const t = line.trim();

        if (t === '') {
            i++;
            continue;
        }

        // Fenced code (may be indented inside a list item)
        if (t.startsWith('```')) {
            const indent = line.length - line.trimStart().length;
            const lang = t.slice(3).trim();
            const code: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                code.push(lines[i].slice(Math.min(indent, lines[i].length - lines[i].trimStart().length)));
                i++;
            }
            i++; // closing fence
            const block: Block = { t: 'code', lang, code: code.join('\n') };
            const last = blocks[blocks.length - 1];
            if (indent > 0 && last?.t === 'list' && last.items.length > 0) {
                last.items[last.items.length - 1].extra.push(block);
            } else {
                blocks.push(block);
            }
            continue;
        }

        const h = /^(#{1,4})\s+(.*)$/.exec(t);
        if (h) {
            blocks.push({ t: 'h', level: h[1].length, text: h[2], id: slug(h[2]) });
            i++;
            continue;
        }

        if (/^-{3,}$/.test(t)) {
            blocks.push({ t: 'hr' });
            i++;
            continue;
        }

        if (t.startsWith('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
            const head = splitRow(t);
            const rows: string[][] = [];
            i += 2;
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                rows.push(splitRow(lines[i]));
                i++;
            }
            blocks.push({ t: 'table', head, rows });
            continue;
        }

        if (t.startsWith('>')) {
            const parts: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                parts.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            blocks.push({ t: 'quote', text: parts.join(' ') });
            continue;
        }

        const li = LIST_RE.exec(line);
        if (li) {
            const item: ListItem = { indent: li[1].length, marker: li[2], text: li[3], extra: [] };
            const last = blocks[blocks.length - 1];
            if (last?.t === 'list') last.items.push(item);
            else blocks.push({ t: 'list', items: [item] });
            i++;
            continue;
        }

        // Indented continuation of a list item
        const prev = blocks[blocks.length - 1];
        if (prev?.t === 'list' && line.startsWith(' ') && prev.items.length > 0 && lines[i - 1]?.trim() !== '') {
            prev.items[prev.items.length - 1].text += ' ' + t;
            i++;
            continue;
        }

        // Paragraph
        const para: string[] = [t];
        i++;
        while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines, i)) {
            para.push(lines[i].trim());
            i++;
        }
        blocks.push({ t: 'p', text: para.join(' ') });
    }

    return blocks;
}

/* ----------------------------- rendering ---------------------------- */

function inline(text: string): ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s)]+)/g);
    return parts.map((p, idx) => {
        if (!p) return null;
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
            return <strong key={idx} className="font-semibold text-gray-800">{inline(p.slice(2, -2))}</strong>;
        }
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
            return (
                <code key={idx} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] text-gray-800">
                    {p.slice(1, -1)}
                </code>
            );
        }
        if (/^https?:\/\//.test(p)) {
            return (
                <a key={idx} href={p} target="_blank" rel="noreferrer noopener" className="text-emerald-700 underline">
                    {p}
                </a>
            );
        }
        return <Fragment key={idx}>{p}</Fragment>;
    });
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable (e.g. non-HTTPS); the text is still selectable */
        }
    }

    return (
        <div className="my-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-900">
            <div className="flex items-center justify-between bg-gray-800 px-3 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{lang || 'text'}</span>
                <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-700"
                >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-gray-100">
                <code>{code}</code>
            </pre>
        </div>
    );
}

function renderBlock(b: Block, key: number): ReactNode {
    switch (b.t) {
        case 'h':
            if (b.level === 1) return null; // shown as the page title
            if (b.level === 2) {
                return (
                    <h3
                        key={key}
                        id={b.id}
                        className="mt-8 scroll-mt-24 border-b border-gray-100 pb-2 text-lg font-semibold text-gray-800 first:mt-0"
                    >
                        {inline(b.text)}
                    </h3>
                );
            }
            return (
                <h4 key={key} id={b.id} className="mt-6 scroll-mt-24 text-sm font-semibold text-emerald-800">
                    {inline(b.text)}
                </h4>
            );

        case 'p':
            return (
                <p key={key} className="my-2 text-sm leading-relaxed text-gray-600">
                    {inline(b.text)}
                </p>
            );

        case 'quote':
            return (
                <div
                    key={key}
                    className="my-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{inline(b.text)}</span>
                </div>
            );

        case 'hr':
            return null; // headings already separate sections

        case 'code':
            return <CodeBlock key={key} code={b.code} lang={b.lang} />;

        case 'table':
            return (
                <div key={key} className="my-3 overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {b.head.map((c, i) => (
                                    <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                                        {inline(c)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {b.rows.map((r, ri) => (
                                <tr key={ri}>
                                    {r.map((c, ci) => (
                                        <td key={ci} className="px-3 py-2 align-top text-gray-600">
                                            {inline(c)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );

        case 'list': {
            const base = Math.min(...b.items.map((x) => x.indent));
            return (
                <div key={key} role="list" className="my-2 space-y-1.5">
                    {b.items.map((it, i) => {
                        const ordered = /\d/.test(it.marker);
                        const depth = Math.min(3, Math.floor((it.indent - base) / 2));
                        return (
                            <div
                                key={i}
                                role="listitem"
                                style={{ marginLeft: depth * 20 }}
                                className="text-sm text-gray-600"
                            >
                                <div className="flex items-start gap-2">
                                    {ordered ? (
                                        <span className="mt-px flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 px-1 text-xs font-semibold text-emerald-700">
                                            {it.marker.replace('.', '')}
                                        </span>
                                    ) : (
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                    )}
                                    <span className="leading-relaxed">{inline(it.text)}</span>
                                </div>
                                {it.extra.length > 0 && (
                                    <div className="ml-7">{it.extra.map((e, j) => renderBlock(e, j))}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }
    }
}

export default function BackupGuide({ content }: Props) {
    const blocks = content ? parse(content) : [];
    const title = blocks.find((b) => b.t === 'h' && b.level === 1);
    const toc = blocks.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h' && b.level === 2);

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Backup &amp; Restore Guide</h2>}>
            <Head title="Backup & Restore Guide" />

            <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6 lg:px-8">
                <Link
                    href={route('settings.backup')}
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:underline"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to System Backup
                </Link>

                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        This is a read-only guide. Restoring replaces live data and is done manually on the server,
                        never from this page.
                    </span>
                </div>

                {content === null ? (
                    <Card className="border-0 shadow-sm">
                        <CardContent className="pt-6">
                            <p className="text-sm text-red-600">
                                The guide file <code>docs/BACKUP_PLAN.md</code> was not found on the server.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
                        {toc.length > 0 && (
                            <nav aria-label="On this page" className="lg:sticky lg:top-4 lg:self-start">
                                <Card className="border-0 shadow-sm">
                                    <CardContent className="p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            On this page
                                        </p>
                                        <ul className="mt-2 space-y-1">
                                            {toc.map((h) => (
                                                <li key={h.id}>
                                                    <a
                                                        href={`#${h.id}`}
                                                        className="block rounded px-2 py-1 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                                                    >
                                                        {stripMd(h.text)}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            </nav>
                        )}

                        <Card className="min-w-0 border-0 shadow-sm">
                            <CardContent className="pt-6">
                                {title && title.t === 'h' && (
                                    <h2 className="mb-2 text-xl font-semibold text-gray-800">{stripMd(title.text)}</h2>
                                )}
                                {blocks.map((b, i) => renderBlock(b, i))}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}