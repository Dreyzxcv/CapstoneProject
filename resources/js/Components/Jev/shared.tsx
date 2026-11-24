import { Badge } from '@/Components/ui/badge';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

/* ───────────── Types (shape of the detail payloads) ───────────── */

type Num = number | string | null | undefined;

export interface JevPiece {
    id: number;
    piece_number: number;
    species?: string | null;
    description?: string | null;
    length?: Num;
    width?: Num;
    height?: Num;
    volume_bd_ft?: Num;
    volume_cu_m?: Num;
    estimated_value?: Num;
    vehicle_type?: string | null;
    plate_number?: string | null;
    equipment_type?: string | null;
    serial_number?: string | null;
    disposed_at?: string | null;
}

export interface JevIncident {
    incident_code?: string | null;
    date_of_apprehension?: string | null;
    apprehending_party?: string | null;
    place_of_apprehension?: string | null;
}

export interface JevAsset {
    id: number;
    asset_code: string;
    aap_number: string | null;
    stcp_number: string | null;
    type: string;
    quantity?: Num;
    quantity_unit?: string | null;
    municipality_of_origin?: string | null;
    location_apprehended?: string | null;
    incident?: JevIncident | null;
    pieces?: JevPiece[];
}

export interface JevInRecord {
    jev_number: string | null;
    jev_date: string | null;
    particulars: string | null;
    amount: Num;
    created_at: string;
}

export interface JevInDetail {
    asset: JevAsset;
    jev: JevInRecord | null;
    can: { issue_jev: boolean };
}

/** Options forwarded to Inertia's form.post (lets the index page limit which props reload). */
export interface PostOptions {
    preserveState?: boolean;
    preserveScroll?: boolean;
    only?: string[];
}

/* ───────────── Formatting ───────────── */

export const num = (v: Num) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
export const peso = (v: Num) =>
    v === null || v === undefined || v === ''
        ? '—'
        : `₱ ${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
export const fixed2 = (v: Num) => (v === null || v === undefined || v === '' ? '—' : Number(v).toFixed(2));
export const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
export const titleCase = (s: string) => s.replace(/_/g, ' ');

export const inputCls = (hasError: boolean) =>
    `mt-1 block w-full rounded-md text-sm shadow-sm focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400 ${
        hasError ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-emerald-500'
    }`;

/* ───────────── Small UI pieces ───────────── */

export function JevStatusBadge({ issued, jevType }: { issued: boolean; jevType: 'IN' | 'OUT' }) {
    return issued ? (
        <Badge variant="green" className="whitespace-nowrap">Issued</Badge>
    ) : (
        <Badge variant="amber" className="whitespace-nowrap">Awaiting JEV {jevType}</Badge>
    );
}

export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium text-gray-400">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-gray-800">{children}</dd>
        </div>
    );
}

export function FieldLabel({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: ReactNode }) {
    return (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
            {children}
            {required && (
                <>
                    <span className="ml-0.5 text-red-500" aria-hidden>*</span>
                    <span className="sr-only"> (required)</span>
                </>
            )}
        </label>
    );
}

const SECTION_TONES = {
    default: { wrap: 'border-gray-200', head: 'border-gray-100 bg-white' },
    pending: { wrap: 'border-amber-200', head: 'border-amber-100 bg-amber-50' },
    issued: { wrap: 'border-green-200', head: 'border-green-100 bg-green-50' },
};

/** Card used by every section on both the modal and the standalone pages. */
export function Section({
    title,
    description,
    aside,
    tone = 'default',
    padded = true,
    children,
}: {
    title: ReactNode;
    description?: string;
    aside?: ReactNode;
    tone?: keyof typeof SECTION_TONES;
    padded?: boolean;
    children: ReactNode;
}) {
    const t = SECTION_TONES[tone];
    return (
        <section className={cn('overflow-hidden rounded-xl border bg-white shadow-sm', t.wrap)}>
            <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5', t.head)}>
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                    {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
                </div>
                {aside}
            </div>
            <div className={padded ? 'p-4 sm:p-5' : undefined}>{children}</div>
        </section>
    );
}

/** Read-only notice for pending records when the user can't issue. */
export function AwaitingNotice({ jevType, what }: { jevType: 'IN' | 'OUT'; what: string }) {
    return (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:p-5">
            <p className="font-medium">Awaiting JEV {jevType}</p>
            <p className="mt-1 text-amber-700">
                No JEV {jevType} has been issued for this {what} yet. Accounting will issue it.
            </p>
        </div>
    );
}