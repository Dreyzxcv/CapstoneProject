import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { DialogTitle } from '@headlessui/react';
import { X } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { AssetPiecesSection, AssetSummarySection, JevInIssuanceSection } from './JevInSections';
import {
    BatchAssetsSection,
    DonationSummarySection,
    JevOutDetail,
    JevOutIssuanceSection,
    donationFacts,
} from './JevOutSections';
import { JevInDetail, JevStatusBadge, PostOptions } from './shared';

/* ───────────── Detail loading (JSON, no navigation) ───────────── */

type LoadState<T> =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; data: T };

class HttpError extends Error {
    status: number;
    constructor(status: number) {
        super(`HTTP ${status}`);
        this.status = status;
    }
}

function errorMessage(err: unknown): string {
    if (err instanceof HttpError) {
        if (err.status === 401) return 'Your session has expired. Reload the page and sign in again.';
        if (err.status === 403) return 'You don’t have permission to view this JEV.';
        if (err.status === 404) return 'This record could not be found. It may have been removed.';
    }
    return 'The details could not be loaded. Check your connection and try again.';
}

/** Fetches a JSON detail endpoint once per mount (and again on retry). */
function useDetail<T>(url: string) {
    const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setState({ status: 'loading' });

        fetch(url, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then((res) => {
                if (!res.ok) throw new HttpError(res.status);
                return res.json() as Promise<T>;
            })
            .then((data) => setState({ status: 'ready', data }))
            .catch((err) => {
                if (err?.name === 'AbortError') return;
                setState({ status: 'error', message: errorMessage(err) });
            });

        return () => controller.abort();
    }, [url, attempt]);

    return { state, retry: () => setAttempt((a) => a + 1) };
}

/* ───────────── Shell ───────────── */

function ModalChrome({
    title,
    subtitle,
    badge,
    closeable,
    onClose,
    children,
}: {
    title: string;
    subtitle?: string;
    badge?: ReactNode;
    closeable: boolean;
    onClose: () => void;
    children: ReactNode;
}) {
    return (
        // Height is constrained so the body scrolls and the header stays put.
        <div className="flex max-h-[calc(100dvh-3rem)] flex-col bg-white">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <DialogTitle as="h2" className="text-lg font-semibold text-gray-900">
                            {title}
                        </DialogTitle>
                        {badge}
                    </div>
                    {subtitle && <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={!closeable}
                    aria-label="Close"
                    className="-mr-1 shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <X className="h-5 w-5" aria-hidden />
                </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gray-50 p-4 sm:p-6">{children}</div>
        </div>
    );
}

/** Main details on the left, issuance on the right from `lg`; stacked below that. */
function ModalColumns({ main, aside }: { main: ReactNode; aside: ReactNode }) {
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="min-w-0 space-y-4">{main}</div>
            <div className="space-y-4 lg:sticky lg:top-0">{aside}</div>
        </div>
    );
}

function DetailLoading() {
    return (
        <div role="status" aria-live="polite" className="space-y-4">
            <span className="sr-only">Loading JEV details…</span>
            {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />
            ))}
        </div>
    );
}

function DetailError({ message, onRetry, onClose }: { message: string; onRetry: () => void; onClose: () => void }) {
    return (
        <div role="alert" className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <p className="font-medium text-gray-800">Couldn’t load JEV details</p>
            <p className="mt-1 text-sm text-gray-500">{message}</p>
            <div className="mt-4 flex justify-center gap-2">
                <Button type="button" size="sm" onClick={onRetry}>Try again</Button>
                <Button type="button" size="sm" variant="outline" onClick={onClose}>Close</Button>
            </div>
        </div>
    );
}

/* ───────────── JEV IN ───────────── */

interface ModalProps {
    show: boolean;
    /** Bumps on every open so the content remounts (fresh fetch, empty form, no stale errors). */
    session: number;
    onClose: () => void;
    /** Called after a successful issuance (the index closes the modal and its props refresh). */
    onIssued: () => void;
    postOptions?: PostOptions;
}

function JevInContent({
    assetId,
    closeable,
    onClose,
    onIssued,
    onProcessingChange,
    postOptions,
}: {
    assetId: number;
    closeable: boolean;
    onClose: () => void;
    onIssued: () => void;
    onProcessingChange: (p: boolean) => void;
    postOptions?: PostOptions;
}) {
    const { state, retry } = useDetail<JevInDetail>(route('assets.jev.details', assetId));
    const data = state.status === 'ready' ? state.data : null;
    const issued = !!data?.jev;
    const canIssue = !!data?.can.issue_jev;

    const title = !data
        ? 'JEV IN'
        : issued
          ? 'JEV IN details'
          : canIssue
            ? 'Issue JEV IN'
            : 'JEV IN — awaiting issuance';
    const subtitle = data
        ? [data.asset.asset_code, data.asset.aap_number ?? data.asset.stcp_number].filter(Boolean).join(' · ')
        : undefined;

    return (
        <ModalChrome
            title={title}
            subtitle={subtitle}
            badge={data ? <JevStatusBadge issued={issued} jevType="IN" /> : undefined}
            closeable={closeable}
            onClose={onClose}
        >
            {state.status === 'loading' && <DetailLoading />}
            {state.status === 'error' && <DetailError message={state.message} onRetry={retry} onClose={onClose} />}
            {data && (
                <ModalColumns
                    main={
                        <>
                            <AssetSummarySection asset={data.asset} />
                            <AssetPiecesSection asset={data.asset} maxHeightClass="max-h-72" />
                        </>
                    }
                    aside={
                        <JevInIssuanceSection
                            asset={data.asset}
                            jev={data.jev}
                            canIssue={canIssue}
                            compact
                            postOptions={postOptions}
                            onIssued={onIssued}
                            onProcessingChange={onProcessingChange}
                        />
                    }
                />
            )}
        </ModalChrome>
    );
}

export function JevInModal({ show, assetId, session, onClose, onIssued, postOptions }: ModalProps & { assetId: number }) {
    const [processing, setProcessing] = useState(false);
    return (
        <Modal show={show} maxWidth="6xl" closeable={!processing} onClose={onClose}>
            <JevInContent
                key={`in-${assetId}-${session}`}
                assetId={assetId}
                closeable={!processing}
                onClose={onClose}
                onIssued={onIssued}
                onProcessingChange={setProcessing}
                postOptions={postOptions}
            />
        </Modal>
    );
}

/* ───────────── JEV OUT ───────────── */

function JevOutContent({
    disposalId,
    closeable,
    onClose,
    onIssued,
    onProcessingChange,
    postOptions,
}: {
    disposalId: number;
    closeable: boolean;
    onClose: () => void;
    onIssued: () => void;
    onProcessingChange: (p: boolean) => void;
    postOptions?: PostOptions;
}) {
    const { state, retry } = useDetail<JevOutDetail>(route('disposals.jev-out.details', disposalId));
    const data = state.status === 'ready' ? state.data : null;
    const jev = data?.disposal.disposal_jev ?? null;
    const issued = !!jev;
    const canIssue = !!data?.can.issue_jev_out;
    const facts = data ? donationFacts(data.disposal.donation) : null;

    const title = !data
        ? 'JEV OUT'
        : issued
          ? 'JEV OUT details'
          : canIssue
            ? 'Issue JEV OUT'
            : 'JEV OUT — awaiting issuance';
    const subtitle = facts ? [facts.donationId, facts.recipient].filter((v) => v && v !== '—').join(' · ') : undefined;

    return (
        <ModalChrome
            title={title}
            subtitle={subtitle}
            badge={data ? <JevStatusBadge issued={issued} jevType="OUT" /> : undefined}
            closeable={closeable}
            onClose={onClose}
        >
            {state.status === 'loading' && <DetailLoading />}
            {state.status === 'error' && <DetailError message={state.message} onRetry={retry} onClose={onClose} />}
            {data && facts && (
                <ModalColumns
                    main={
                        <>
                            <DonationSummarySection facts={facts} assetCount={data.siblings.length} />
                            <BatchAssetsSection siblings={data.siblings} />
                        </>
                    }
                    aside={
                        <JevOutIssuanceSection
                            disposalId={data.disposal.id}
                            jev={jev}
                            facts={facts}
                            canIssue={canIssue}
                            compact
                            postOptions={postOptions}
                            onIssued={onIssued}
                            onProcessingChange={onProcessingChange}
                        />
                    }
                />
            )}
        </ModalChrome>
    );
}

export function JevOutModal({
    show,
    disposalId,
    session,
    onClose,
    onIssued,
    postOptions,
}: ModalProps & { disposalId: number }) {
    const [processing, setProcessing] = useState(false);
    return (
        <Modal show={show} maxWidth="6xl" closeable={!processing} onClose={onClose}>
            <JevOutContent
                key={`out-${disposalId}-${session}`}
                disposalId={disposalId}
                closeable={!processing}
                onClose={onClose}
                onIssued={onIssued}
                onProcessingChange={setProcessing}
                postOptions={postOptions}
            />
        </Modal>
    );
}