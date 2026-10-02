import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import InputError from "@/Components/InputError";
import Modal from "@/Components/Modal";
import { Asset } from "@/types";
import { router, useForm } from "@inertiajs/react";
import { FormEvent, useState } from "react";
import { CheckCircle2, AlertTriangle, Scale } from "lucide-react";

interface CaseDetailsProps {
    asset: Asset & {
        case_number?: string | null;
        court_branch?: string | null;
        next_hearing_date?: string | null;
        case_outcome?: string | null;
    };
    can: {
        updateCaseDetails: boolean;
        resolveCase: boolean;
    };
}

// ─── Modal content (shared between modal and standalone) ─────────────────────

function CaseDetailsContent({ asset, can, onClose }: CaseDetailsProps & { onClose?: () => void }) {
    const [saved, setSaved] = useState(false);

    const caseForm = useForm({
        case_number: asset.case_number ?? "",
        court_branch: asset.court_branch ?? "",
        next_hearing_date: asset.next_hearing_date
            ? asset.next_hearing_date.slice(0, 10)
            : "",
        case_outcome: asset.case_outcome ?? "",
    });

    function submitCaseDetails(e: FormEvent) {
        e.preventDefault();
        caseForm.post(route("assets.case-details.update", asset.id), {
            preserveScroll: true,
            onSuccess: () => {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            },
        });
    }

    function handleResolveTrial() {
        if (
            confirm(
                "Confirm the case has been resolved and this asset can proceed to accounting?",
            )
        ) {
            router.post(route("assets.resolve-trial", asset.id), {}, {
                onSuccess: () => onClose?.(),
            });
        }
    }

    const hearingDateValue = caseForm.data.next_hearing_date
        ? new Date(caseForm.data.next_hearing_date)
        : null;
    const hearingIsPast =
        hearingDateValue != null && hearingDateValue < new Date();
    const hearingIsUpcoming =
        hearingDateValue != null &&
        !hearingIsPast &&
        hearingDateValue.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

    function ReadRow({
        label,
        value,
        mono,
    }: {
        label: string;
        value: React.ReactNode;
        mono?: boolean;
    }) {
        return (
            <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0 text-sm">
                <span className="text-gray-500 shrink-0">{label}</span>
                <span className={`text-gray-900 text-right ${mono ? "font-mono" : "font-medium"}`}>
                    {value || "—"}
                </span>
            </div>
        );
    }

    const isResolved = asset.current_status === "case_resolved";

    return (
        <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-gray-400" />
                    <h2 className="text-lg font-semibold text-gray-800">Case Details</h2>
                </div>
                {isResolved && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolved
                    </span>
                )}
            </div>

            <div className="h-px bg-gray-100" />

            {/* Body */}
            {can.updateCaseDetails ? (
                <form onSubmit={submitCaseDetails} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="modal_case_number">Case Number</Label>
                            <Input
                                id="modal_case_number"
                                placeholder="e.g. Crim. Case No. 2026-001"
                                value={caseForm.data.case_number}
                                onChange={(e) => caseForm.setData("case_number", e.target.value)}
                            />
                            <InputError message={caseForm.errors.case_number} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="modal_court_branch">Court / Branch</Label>
                            <Input
                                id="modal_court_branch"
                                placeholder="e.g. RTC Branch 43, Virac"
                                value={caseForm.data.court_branch}
                                onChange={(e) => caseForm.setData("court_branch", e.target.value)}
                            />
                            <InputError message={caseForm.errors.court_branch} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="modal_next_hearing_date">Next Hearing Date</Label>
                            <Input
                                id="modal_next_hearing_date"
                                type="date"
                                value={caseForm.data.next_hearing_date}
                                onChange={(e) => caseForm.setData("next_hearing_date", e.target.value)}
                                className={
                                    hearingIsPast
                                        ? "border-amber-400 focus:ring-amber-400"
                                        : hearingIsUpcoming
                                          ? "border-blue-400 focus:ring-blue-400"
                                          : ""
                                }
                            />
                            {hearingIsPast && (
                                <p className="flex items-center gap-1.5 text-xs text-amber-700">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    This hearing date has already passed. Update if a new date has been set.
                                </p>
                            )}
                            {hearingIsUpcoming && !hearingIsPast && (
                                <p className="text-xs text-blue-700">Hearing is within the next 7 days.</p>
                            )}
                            <InputError message={caseForm.errors.next_hearing_date} />
                        </div>

                        {(isResolved || asset.case_outcome) && (
                            <div className="space-y-1.5">
                                <Label htmlFor="modal_case_outcome">Case Outcome</Label>
                                <Input
                                    id="modal_case_outcome"
                                    placeholder="e.g. Convicted, Acquitted, Settled"
                                    value={caseForm.data.case_outcome}
                                    onChange={(e) => caseForm.setData("case_outcome", e.target.value)}
                                />
                                <InputError message={(caseForm.errors as any).case_outcome} />
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Button type="submit" size="sm" disabled={caseForm.processing}>
                                {caseForm.processing ? "Saving…" : "Save Case Details"}
                            </Button>
                            {saved && (
                                <span className="flex items-center gap-1.5 text-xs text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Saved successfully
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {can.resolveCase && !isResolved && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleResolveTrial}
                                    className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                >
                                    Resolve Case
                                </Button>
                            )}
                            {onClose && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={onClose}
                                    className="text-gray-500"
                                >
                                    Close
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            ) : (
                // ── Read-only view ────────────────────────────────────────────
                <>
                    <div className="rounded-md border border-gray-100 overflow-hidden">
                        <ReadRow label="Case Number" value={asset.case_number} mono />
                        <ReadRow label="Court / Branch" value={asset.court_branch} />
                        <ReadRow
                            label="Next Hearing"
                            value={
                                asset.next_hearing_date ? (
                                    <span className={new Date(asset.next_hearing_date) < new Date() ? "text-amber-700" : ""}>
                                        {new Date(asset.next_hearing_date).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                                        {new Date(asset.next_hearing_date) < new Date() && (
                                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded px-1 py-0.5">
                                                Lapsed
                                            </span>
                                        )}
                                    </span>
                                ) : null
                            }
                        />
                        {asset.case_outcome && (
                            <ReadRow label="Outcome" value={asset.case_outcome} />
                        )}
                    </div>

                    {/* Resolve + Close for read-only users */}
                    {(can.resolveCase || onClose) && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                            {can.resolveCase && !isResolved && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleResolveTrial}
                                    className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                >
                                    Resolve Case
                                </Button>
                            )}
                            {onClose && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={onClose}
                                    className="text-gray-500"
                                >
                                    Close
                                </Button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Modal export (used from Actions card button) ─────────────────────────────

export function CaseDetailsModal({ asset, can }: CaseDetailsProps) {
    const [open, setOpen] = useState(false);
    const isResolved = asset.current_status === "case_resolved";

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-gray-700"
                onClick={() => setOpen(true)}
            >
                <Scale className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                Case Details
                {isResolved && (
                    <span className="ml-auto text-[10px] font-semibold text-emerald-600">
                        Resolved
                    </span>
                )}
                {!isResolved && asset.next_hearing_date && new Date(asset.next_hearing_date) < new Date() && (
                    <span className="ml-auto text-[10px] font-semibold text-amber-600">
                        Hearing lapsed
                    </span>
                )}
            </Button>

            <Modal show={open} onClose={() => setOpen(false)} maxWidth="lg">
                <CaseDetailsContent
                    asset={asset}
                    can={can}
                    onClose={() => setOpen(false)}
                />
            </Modal>
        </>
    );
}

// ─── Standalone card export (kept for backward compat if needed) ──────────────

export function CaseDetailsCard({ asset, can }: CaseDetailsProps) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <CaseDetailsContent asset={asset} can={can} />
        </div>
    );
}