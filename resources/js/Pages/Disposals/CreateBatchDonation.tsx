import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import InputError from "@/Components/InputError";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Head, Link, useForm } from "@inertiajs/react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, ScanLine, Trash2 } from "lucide-react";
import AssetScanModal, { ScannedAsset } from "@/Components/shared/AssetScanModal";
import PiecePickerModal, { AssetPieceData } from "@/Components/shared/PiecePickerModal";

// ── Types ────────────────────────────────────────────────────────────────────

interface Option {
    value: string;
    label: string;
}

interface DonatableAsset {
    id: number;
    asset_code: string;
    display_number?: string | null;
    species: string | null;
    description: string | null;
    quantity: number;
    remaining_quantity: number;
    municipality_of_origin: string;
    incident?: { place_of_apprehension: string } | null;
    pieces: AssetPieceData[];
}

interface CreateBatchDonationProps {
    assets: DonatableAsset[];
    municipalities: Option[];
    barangaysByMunicipality: Record<string, string[]>;
}

interface DonationLine {
    asset_id: string;
    quantity: string;
    piece_ids?: number[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const selectClass =
    "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600";

// Users recognise the AAP number (apprehended) or STCP number (turned over),
// not the system asset code. The backend resolves which one applies into
// `display_number`; fall back to the asset code if it has neither yet.
function assetLabel(a: { display_number?: string | null; asset_code: string }): string {
    return a.display_number || a.asset_code;
}

const ORG_TYPES = [
    { value: "academe", label: "Academe" },
    { value: "national_agency", label: "National Agency" },
    { value: "lgu", label: "LGU" },
    { value: "other", label: "Other" },
];

const STEPS = [
    { id: 1, label: "Assets", description: "What's being donated" },
    { id: 2, label: "Recipient", description: "Who receives it" },
    { id: 3, label: "Delivery", description: "Donee address" },
    { id: 4, label: "Signatories", description: "Deed signers" },
    { id: 5, label: "Review", description: "Confirm donation" },
];

// Soft pulsing highlight that guides the user to the next required field
// (same behaviour as the incident form).
const HIGHLIGHT_CSS = `
@keyframes nfPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.45); }
    50%      { box-shadow: 0 0 0 6px rgba(5, 150, 105, 0); }
}
.nf-highlight {
    border-color: #059669 !important;
    animation: nfPulse 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
    .nf-highlight { animation: none; box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.35); }
}
`;

// Which step owns a server-side validation error key.
function stepForErrorKey(key: string): number {
    if (key.startsWith("lines")) return 1;
    if (["organization_type", "organization_type_other", "agency_name", "requester_name", "donee_position", "purpose_statement", "confiscation_order_reference"].includes(key)) return 2;
    if (["municipality", "barangay", "street"].includes(key)) return 3;
    return 4; // signatories + notes
}

// ── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
    return (
        <div className="w-full">
            {/* Mobile: compact label + progress bar */}
            <div className="mb-3 flex items-center justify-between px-1 sm:hidden">
                <span className="text-sm font-semibold text-emerald-700">
                    Step {current} of {STEPS.length}
                </span>
                <span className="text-sm text-gray-500">{STEPS[current - 1].label}</span>
            </div>
            <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 sm:hidden">
                <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${((current - 1) / (STEPS.length - 1)) * 100}%` }}
                />
            </div>

            {/* Desktop: full stepper */}
            <nav className="mb-8 hidden items-center sm:flex" aria-label="Form steps">
                {STEPS.map((step, idx) => {
                    const done = current > step.id;
                    const active = current === step.id;
                    const upcoming = current < step.id;

                    return (
                        <div key={step.id} className="flex flex-1 items-center last:flex-none">
                            <div className="flex w-24 flex-col items-center gap-1">
                                <div
                                    className={[
                                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                                        done ? "border-emerald-600 bg-emerald-600 text-white" : "",
                                        active ? "border-emerald-600 bg-white text-emerald-700" : "",
                                        upcoming ? "border-gray-300 bg-white text-gray-400" : "",
                                    ].join(" ")}
                                >
                                    {done ? <Check className="h-4 w-4" /> : step.id}
                                </div>
                                <div className="text-center leading-tight">
                                    <p className={`text-xs font-semibold ${active ? "text-emerald-700" : done ? "text-gray-700" : "text-gray-400"}`}>
                                        {step.label}
                                    </p>
                                    <p className={`text-[11px] ${active ? "text-gray-500" : "text-gray-300"}`}>{step.description}</p>
                                </div>
                            </div>

                            {idx < STEPS.length - 1 && (
                                <div className={`mx-1 mb-8 h-0.5 flex-1 rounded-full transition-colors ${done ? "bg-emerald-500" : "bg-gray-200"}`} />
                            )}
                        </div>
                    );
                })}
            </nav>
        </div>
    );
}

// ── Navigation bar ───────────────────────────────────────────────────────────

function StepNav({
    step,
    totalSteps,
    onBack,
    onNext,
    nextDisabled = false,
    processing = false,
    highlightNext = false,
}: {
    step: number;
    totalSteps: number;
    onBack: () => void;
    onNext: () => void;
    nextDisabled?: boolean;
    processing?: boolean;
    highlightNext?: boolean;
}) {
    const highlightClass = highlightNext && !nextDisabled ? "nf-highlight" : undefined;
    const isLast = step === totalSteps;

    return (
        <div className="flex items-center justify-between pb-8 pt-2">
            <div>
                {step > 1 && (
                    <Button type="button" variant="outline" onClick={onBack}>
                        <ChevronLeft className="mr-1.5 h-4 w-4" />
                        Back
                    </Button>
                )}
            </div>
            <div className="flex gap-3">
                <Link href={route("disposals.index")}>
                    <Button type="button" variant="ghost" className="text-gray-500">
                        Cancel
                    </Button>
                </Link>
                <Button
                    type="button"
                    onClick={onNext}
                    disabled={nextDisabled || (isLast && processing)}
                    className={highlightClass}
                >
                    {isLast ? (processing ? "Saving…" : "Confirm Donation") : "Continue"}
                    {!isLast && <ChevronRight className="ml-1.5 h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}

// ── Review helpers ───────────────────────────────────────────────────────────

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 rounded-t-lg">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h3>
                <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                >
                    <Pencil className="h-3 w-3" />
                    Edit
                </button>
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function ReviewField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div className={`min-w-0 ${className}`}>
            <dt className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
            <dd className="break-words text-sm text-gray-900">{children || "—"}</dd>
        </div>
    );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CreateBatchDonation({
    assets,
    municipalities,
    barangaysByMunicipality,
}: CreateBatchDonationProps) {
    const [step, setStep] = useState(1);
    const [scanning, setScanning] = useState(false);
    const [piecePickerLine, setPiecePickerLine] = useState<number | null>(null);
    const [extraAssets, setExtraAssets] = useState<DonatableAsset[]>([]);
    const topRef = useRef<HTMLDivElement>(null);
    const firstRender = useRef(true);

    const allAssets = useMemo(
        () => [...assets, ...extraAssets.filter((ea) => !assets.some((a) => a.id === ea.id))],
        [assets, extraAssets],
    );

    const assetsById = useMemo(
        () => new Map(allAssets.map((a) => [String(a.id), a])),
        [allAssets],
    );

    const { data, setData, post, processing, errors } = useForm({
        lines: [{ asset_id: "", quantity: "", piece_ids: undefined as number[] | undefined }] as DonationLine[],
        requester_name: "",
        donee_position: "",
        purpose_statement: "",
        confiscation_order_reference: "",
        organization_type: "",
        organization_type_other: "",
        agency_name: "",
        municipality: municipalities[0]?.value ?? "",
        barangay: "",
        street: "",
        donor_representative_name: "",
        donor_representative_title: "",
        witness_1_name: "",
        witness_1_title: "",
        witness_2_name: "",
        witness_2_title: "",
        notes: "",
    });

    // Bring the top of the form into view whenever the step changes.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [step]);

    // ── Line helpers ─────────────────────────────────────────────────────────

    function lineError(index: number, field: "asset_id" | "quantity"): string | undefined {
        return (errors as Record<string, string>)[`lines.${index}.${field}`];
    }

    function updateLine(index: number, field: "asset_id" | "quantity", value: string) {
        const next = [...data.lines];
        if (field === "asset_id") {
            next[index] = { asset_id: value, quantity: "", piece_ids: undefined as number[] | undefined };
        } else {
            next[index] = { ...next[index], quantity: value, piece_ids: undefined as number[] | undefined };
        }
        setData("lines", next);
    }

    function addLine() {
        setData("lines", [...data.lines, { asset_id: "", quantity: "", piece_ids: undefined }]);
    }

    function removeLine(index: number) {
        if (data.lines.length === 1) return;
        setData("lines", data.lines.filter((_, i) => i !== index));
    }

    function availableOptionsFor(currentIndex: number): DonatableAsset[] {
        const chosenElsewhere = new Set(
            data.lines
                .filter((_, i) => i !== currentIndex)
                .map((l) => l.asset_id)
                .filter(Boolean),
        );
        return allAssets.filter((a) => !chosenElsewhere.has(String(a.id)));
    }

    function selectedPieceNumbers(line: DonationLine, selectedAsset: DonatableAsset): number[] {
        if (!line.piece_ids?.length) return [];
        return selectedAsset.pieces
            .filter((p) => line.piece_ids!.includes(p.id))
            .map((p) => p.piece_number)
            .sort((a, b) => a - b);
    }

    function handleAssetScanned(scanned: ScannedAsset) {
        setExtraAssets((prev) => (prev.some((a) => a.id === scanned.id) ? prev : [...prev, scanned as any]));

        setData((prevData) => {
            const pieceId = scanned.piece_id ?? null;
            const existingIndex = prevData.lines.findIndex((l) => l.asset_id === String(scanned.id));

            if (existingIndex !== -1) {
                const nextLines = [...prevData.lines];
                const existing = nextLines[existingIndex];
                const existingIds = existing.piece_ids ?? [];

                if (pieceId !== null && existingIds.includes(pieceId)) return prevData;

                const nextIds = pieceId !== null ? [...existingIds, pieceId] : existingIds;
                nextLines[existingIndex] = {
                    ...existing,
                    quantity: pieceId !== null ? String(nextIds.length) : existing.quantity,
                    piece_ids: nextIds.length ? nextIds : undefined,
                };
                return { ...prevData, lines: nextLines };
            }

            const emptyIndex = prevData.lines.findIndex((l) => !l.asset_id);
            const newLine: DonationLine = {
                asset_id: String(scanned.id),
                quantity: "1",
                piece_ids: pieceId !== null ? [pieceId] : undefined,
            };

            const nextLines = [...prevData.lines];
            if (emptyIndex !== -1) {
                nextLines[emptyIndex] = newLine;
            } else {
                nextLines.push(newLine);
            }
            return { ...prevData, lines: nextLines };
        });

        setScanning(false);
    }

    // ── Recipient / address helpers ──────────────────────────────────────────

    function handleOrgTypeChange(value: string) {
        setData((prev) => ({
            ...prev,
            organization_type: value,
            organization_type_other: value === "other" ? prev.organization_type_other : "",
        }));
    }

    function handleMunicipalityChange(value: string) {
        setData((prev) => ({ ...prev, municipality: value, barangay: "" }));
    }

    function orgLabel(): string {
        if (data.organization_type === "other") return data.organization_type_other || "Other";
        return ORG_TYPES.find((o) => o.value === data.organization_type)?.label ?? "";
    }

    // ── Step validation ──────────────────────────────────────────────────────

    function canProceedStep1() {
        return data.lines.every((l) => !!l.asset_id && Number(l.quantity) >= 1);
    }

    function canProceedStep2() {
        return !!(
            data.organization_type &&
            (data.organization_type !== "other" || data.organization_type_other.trim()) &&
            data.agency_name.trim() &&
            data.requester_name.trim() &&
            data.donee_position.trim() &&
            data.purpose_statement.trim()
        );
    }

    function canProceedStep3() {
        return !!(data.municipality && data.barangay);
    }

    function canProceed(): boolean {
        if (step === 1) return canProceedStep1();
        if (step === 2) return canProceedStep2();
        if (step === 3) return canProceedStep3();
        return true; // signatories are optional; review has nothing to validate
    }

    // Guided highlight: key of the NEXT required field, or 'next_btn' when the
    // current step is complete.
    function getNextTarget(): string {
        if (step === 1) {
            for (let i = 0; i < data.lines.length; i++) {
                const l = data.lines[i];
                if (!l.asset_id) return `asset:${i}`;
                if (!(Number(l.quantity) >= 1)) return `qty:${i}`;
            }
            return "next_btn";
        }

        if (step === 2) {
            if (!data.organization_type) return "organization_type";
            if (data.organization_type === "other" && !data.organization_type_other.trim()) return "organization_type_other";
            if (!data.agency_name.trim()) return "agency_name";
            if (!data.requester_name.trim()) return "requester_name";
            if (!data.donee_position.trim()) return "donee_position";
            if (!data.purpose_statement.trim()) return "purpose_statement";
            return "next_btn";
        }

        if (step === 3) {
            if (!data.municipality) return "municipality";
            if (!data.barangay) return "barangay";
            return "next_btn";
        }

        return "next_btn";
    }

    const nextTarget = getNextTarget();
    const hl = (key: string) => (nextTarget === key ? "nf-highlight" : "");

    // ── Navigation / submit ──────────────────────────────────────────────────

    function handleNext() {
        if (!canProceed()) return;
        if (step < STEPS.length) {
            setStep(step + 1);
        } else {
            confirmAndSubmit();
        }
    }

    function confirmAndSubmit() {
        const lineSummaries = data.lines
            .map((line) => {
                const asset = assetsById.get(line.asset_id);
                return asset ? `${line.quantity || "?"} pc(s) of ${assetLabel(asset)}` : null;
            })
            .filter(Boolean)
            .join(", ");

        if (!confirm(`Confirm donation of ${lineSummaries} to ${data.requester_name || "this recipient"}? This cannot be undone.`)) {
            return;
        }

        post(route("disposals.donate.store"), {
            // If the server rejects something, jump to the step that owns the first error.
            onError: (errs) => {
                const keys = Object.keys(errs);
                if (keys.length > 0) setStep(Math.min(...keys.map(stepForErrorKey)));
            },
        });
    }

    const pickerLine = piecePickerLine !== null ? data.lines[piecePickerLine] : null;
    const pickerAsset = pickerLine ? assetsById.get(pickerLine.asset_id) : null;

    // ── Step 1: Assets ───────────────────────────────────────────────────────

    function renderStep1() {
        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">Assets to Donate</CardTitle>
                    <p className="text-sm text-gray-600">
                        Choose one or more assets and select which pieces go to this recipient.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    {data.lines.map((line, index) => {
                        const selectedAsset = assetsById.get(line.asset_id);
                        const options = availableOptionsFor(index);
                        const hasPieces = (selectedAsset?.pieces?.length ?? 0) > 0;
                        const pieceNums = selectedAsset ? selectedPieceNumbers(line, selectedAsset) : [];
                        const remainingAfter = selectedAsset
                            ? selectedAsset.remaining_quantity - Number(line.quantity)
                            : 0;

                        return (
                            <div key={index} className="rounded-lg border border-gray-200 p-4">
                                <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                                    {/* Asset selector */}
                                    <div>
                                        <Label htmlFor={`asset-${index}`}>Asset</Label>
                                        <select
                                            id={`asset-${index}`}
                                            value={line.asset_id}
                                            onChange={(e) => updateLine(index, "asset_id", e.target.value)}
                                            className={`${selectClass} ${hl(`asset:${index}`)}`}
                                            required
                                        >
                                            <option value="" disabled>
                                                Select an asset…
                                            </option>
                                            {options.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {assetLabel(a)}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError message={lineError(index, "asset_id")} />
                                    </div>

                                    {/* Piece picker button OR quantity fallback */}
                                    <div className="min-w-[150px]">
                                        <Label>Pieces</Label>
                                        {hasPieces ? (
                                            <button
                                                type="button"
                                                onClick={() => selectedAsset && setPiecePickerLine(index)}
                                                disabled={!selectedAsset}
                                                className={`mt-1 flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 ${hl(`qty:${index}`)}`}
                                            >
                                                <span className={line.piece_ids?.length ? "text-gray-900" : "text-gray-400"}>
                                                    {line.piece_ids?.length
                                                        ? `${line.piece_ids.length} piece${line.piece_ids.length !== 1 ? "s" : ""} selected`
                                                        : "Select pieces…"}
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                            </button>
                                        ) : (
                                            <Input
                                                type="number"
                                                min={1}
                                                max={selectedAsset?.remaining_quantity}
                                                value={line.quantity}
                                                onChange={(e) => updateLine(index, "quantity", e.target.value)}
                                                disabled={!selectedAsset}
                                                placeholder={!selectedAsset ? "Select an asset first" : ""}
                                                className={`mt-1 ${hl(`qty:${index}`)}`}
                                                required
                                            />
                                        )}
                                        <InputError message={lineError(index, "quantity")} />
                                    </div>

                                    {/* Remove */}
                                    {data.lines.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="mb-0.5 self-end"
                                            onClick={() => removeLine(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                {/* Selected piece badges */}
                                {pieceNums.length > 0 && selectedAsset && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {pieceNums.map((n) => (
                                            <span
                                                key={n}
                                                className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"
                                            >
                                                Piece {n}/{selectedAsset.quantity}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Remainder warning */}
                                {selectedAsset && Number(line.quantity) > 0 && remainingAfter > 0 && (
                                    <p className="mt-2 text-xs text-amber-700">
                                        The remaining {remainingAfter} pc(s) of {assetLabel(selectedAsset)} will stay available for future disposal.
                                    </p>
                                )}
                            </div>
                        );
                    })}

                    <div className="flex flex-wrap gap-2">
                        {data.lines.length < allAssets.length && (
                            <Button type="button" variant="outline" size="sm" onClick={addLine}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Add Another Asset
                            </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={() => setScanning(true)}>
                            <ScanLine className="mr-1.5 h-3.5 w-3.5" />
                            Scan QR Code
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── Step 2: Recipient ────────────────────────────────────────────────────

    function renderStep2() {
        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">Recipient</CardTitle>
                    <p className="text-sm text-gray-600">Who is receiving the donation and why.</p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="organization_type">
                                Organization Type<span className="text-red-500">*</span>
                            </Label>
                            <select
                                id="organization_type"
                                value={data.organization_type}
                                onChange={(e) => handleOrgTypeChange(e.target.value)}
                                className={`${selectClass} ${hl("organization_type")}`}
                                required
                            >
                                <option value="" disabled>
                                    Select type…
                                </option>
                                {ORG_TYPES.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.organization_type} />
                        </div>

                        {data.organization_type === "other" && (
                            <div>
                                <Label htmlFor="organization_type_other">
                                    Specify Type<span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="organization_type_other"
                                    value={data.organization_type_other}
                                    className={`mt-1 ${hl("organization_type_other")}`}
                                    onChange={(e) => setData("organization_type_other", e.target.value)}
                                    autoFocus
                                />
                                <InputError message={errors.organization_type_other} />
                            </div>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="agency_name">
                            Donee Office / Institution Name<span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="agency_name"
                            placeholder="Agency / Institution Name"
                            value={data.agency_name}
                            className={`mt-1 ${hl("agency_name")}`}
                            onChange={(e) => setData("agency_name", e.target.value)}
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Printed in the Deed of Donation's signature block (the "DONEE OFFICE" heading).
                        </p>
                        <InputError message={errors.agency_name} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="requester_name">
                                Representative Name<span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="requester_name"
                                value={data.requester_name}
                                className={`mt-1 ${hl("requester_name")}`}
                                onChange={(e) => setData("requester_name", e.target.value)}
                                required
                            />
                            <InputError message={errors.requester_name} />
                        </div>

                        <div>
                            <Label htmlFor="donee_position">
                                Representative's Position / Title<span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="donee_position"
                                placeholder="Donee Position"
                                value={data.donee_position}
                                className={`mt-1 ${hl("donee_position")}`}
                                onChange={(e) => setData("donee_position", e.target.value)}
                                required
                            />
                            <InputError message={errors.donee_position} />
                        </div>
                    </div>
                    <p className="-mt-2 text-xs text-gray-500">
                        Printed on the Deed of Donation, e.g. "represented by [name], [position]".
                    </p>

                    <div>
                        <Label htmlFor="purpose_statement">
                            Purpose / Need Statement<span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="purpose_statement"
                            placeholder="e.g. for the improvement and renovation of the office space"
                            value={data.purpose_statement}
                            className={`mt-1 ${hl("purpose_statement")}`}
                            onChange={(e) => setData("purpose_statement", e.target.value)}
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Describes why the donee needs the lumber — appears in the Deed's WITNESSETH clause.
                        </p>
                        <InputError message={errors.purpose_statement} />
                    </div>

                    <div>
                        <Label htmlFor="confiscation_order_reference">Confiscation Order Reference (optional)</Label>
                        <Input
                            id="confiscation_order_reference"
                            value={data.confiscation_order_reference}
                            className="mt-1"
                            onChange={(e) => setData("confiscation_order_reference", e.target.value)}
                        />
                        <InputError message={errors.confiscation_order_reference} />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── Step 3: Delivery ─────────────────────────────────────────────────────

    function renderStep3() {
        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">Delivery</CardTitle>
                    <p className="text-sm text-gray-600">Where the donated items will be delivered.</p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Donee Address</p>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="municipality">
                                    Municipality<span className="text-red-500">*</span>
                                </Label>
                                <select
                                    id="municipality"
                                    value={data.municipality}
                                    onChange={(e) => handleMunicipalityChange(e.target.value)}
                                    className={`${selectClass} ${hl("municipality")}`}
                                    required
                                >
                                    {municipalities.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.municipality} />
                            </div>
                            <div>
                                <Label htmlFor="barangay">
                                    Barangay<span className="text-red-500">*</span>
                                </Label>
                                <select
                                    id="barangay"
                                    value={data.barangay}
                                    onChange={(e) => setData("barangay", e.target.value)}
                                    className={`${selectClass} ${hl("barangay")}`}
                                    required
                                >
                                    <option value="" disabled>
                                        Select barangay…
                                    </option>
                                    {(barangaysByMunicipality[data.municipality] ?? []).map((brgy) => (
                                        <option key={brgy} value={brgy}>
                                            {brgy}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.barangay} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <Label htmlFor="street">Street / House No.</Label>
                            <Input
                                id="street"
                                placeholder="e.g. Purok 3, Zone 2"
                                value={data.street}
                                className="mt-1"
                                onChange={(e) => setData("street", e.target.value)}
                            />
                            <InputError message={errors.street} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── Step 4: Signatories ──────────────────────────────────────────────────

    function renderStep4() {
        return (
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                    <CardTitle className="text-xl">Deed of Donation Signatories</CardTitle>
                    <p className="text-sm text-gray-600">
                        Optional. Leave any of these blank to use the office's standing default for this document.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="donor_representative_name">OIC / PENR Officer Name</Label>
                            <Input
                                id="donor_representative_name"
                                placeholder="Donor Representative Name"
                                value={data.donor_representative_name}
                                className="mt-1"
                                onChange={(e) => setData("donor_representative_name", e.target.value)}
                            />
                            <InputError message={errors.donor_representative_name} />
                        </div>
                        <div>
                            <Label htmlFor="donor_representative_title">OIC / PENR Officer Title</Label>
                            <Input
                                id="donor_representative_title"
                                placeholder="Donor Representative Title"
                                value={data.donor_representative_title}
                                className="mt-1"
                                onChange={(e) => setData("donor_representative_title", e.target.value)}
                            />
                            <InputError message={errors.donor_representative_title} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="witness_1_name">Witness 1 Name</Label>
                            <Input
                                id="witness_1_name"
                                placeholder="Witness 1 Name"
                                value={data.witness_1_name}
                                className="mt-1"
                                onChange={(e) => setData("witness_1_name", e.target.value)}
                            />
                            <InputError message={errors.witness_1_name} />
                        </div>
                        <div>
                            <Label htmlFor="witness_1_title">Witness 1 Title</Label>
                            <Input
                                id="witness_1_title"
                                placeholder="Witness 1 Title"
                                value={data.witness_1_title}
                                className="mt-1"
                                onChange={(e) => setData("witness_1_title", e.target.value)}
                            />
                            <InputError message={errors.witness_1_title} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="witness_2_name">Witness 2 Name</Label>
                            <Input
                                id="witness_2_name"
                                placeholder="Witness 2 Name"
                                value={data.witness_2_name}
                                className="mt-1"
                                onChange={(e) => setData("witness_2_name", e.target.value)}
                            />
                            <InputError message={errors.witness_2_name} />
                        </div>
                        <div>
                            <Label htmlFor="witness_2_title">Witness 2 Title</Label>
                            <Input
                                id="witness_2_title"
                                placeholder="Witness 2 Title"
                                value={data.witness_2_title}
                                className="mt-1"
                                onChange={(e) => setData("witness_2_title", e.target.value)}
                            />
                            <InputError message={errors.witness_2_title} />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Input
                            id="notes"
                            value={data.notes}
                            className="mt-1"
                            onChange={(e) => setData("notes", e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── Step 5: Review ───────────────────────────────────────────────────────

    function renderStep5() {
        const address = [data.street, data.barangay, data.municipality].filter(Boolean).join(", ");
        const hasSignatories = !!(
            data.donor_representative_name || data.donor_representative_title ||
            data.witness_1_name || data.witness_1_title ||
            data.witness_2_name || data.witness_2_title
        );

        const signatory = (name: string, title: string) => (name || title ? [name, title].filter(Boolean).join(" — ") : "Office default");

        return (
            <div className="space-y-4">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-xl">Review &amp; Confirm</CardTitle>
                        <p className="text-sm text-gray-600">
                            Check everything below. Once confirmed, the donation cannot be undone.
                        </p>
                    </CardHeader>
                </Card>

                <ReviewCard title={`Assets (${data.lines.length})`} onEdit={() => setStep(1)}>
                    <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
                        {data.lines.map((line, i) => {
                            const asset = assetsById.get(line.asset_id);
                            const nums = asset ? selectedPieceNumbers(line, asset) : [];
                            return (
                                <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                                    <div className="min-w-0">
                                        <span className="font-medium text-gray-900">{asset ? assetLabel(asset) : "—"}</span>
                                        {asset?.species && <span className="ml-2 text-xs text-gray-500">{asset.species}</span>}
                                        {nums.length > 0 && asset && (
                                            <p className="mt-0.5 text-xs text-gray-500">
                                                Pieces: {nums.join(", ")} of {asset.quantity}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-600">{line.quantity} pc(s)</span>
                                </li>
                            );
                        })}
                    </ul>
                </ReviewCard>

                <ReviewCard title="Recipient" onEdit={() => setStep(2)}>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <ReviewField label="Organization Type">{orgLabel()}</ReviewField>
                        <ReviewField label="Office / Institution">{data.agency_name}</ReviewField>
                        <ReviewField label="Representative">{data.requester_name}</ReviewField>
                        <ReviewField label="Position / Title">{data.donee_position}</ReviewField>
                        <ReviewField label="Purpose" className="sm:col-span-2">{data.purpose_statement}</ReviewField>
                        {data.confiscation_order_reference && (
                            <ReviewField label="Confiscation Order Ref." className="sm:col-span-2">
                                {data.confiscation_order_reference}
                            </ReviewField>
                        )}
                    </dl>
                </ReviewCard>

                <ReviewCard title="Delivery" onEdit={() => setStep(3)}>
                    <dl>
                        <ReviewField label="Donee Address">{address}</ReviewField>
                    </dl>
                </ReviewCard>

                <ReviewCard title="Signatories" onEdit={() => setStep(4)}>
                    {hasSignatories ? (
                        <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <ReviewField label="OIC / PENR Officer">
                                {signatory(data.donor_representative_name, data.donor_representative_title)}
                            </ReviewField>
                            <ReviewField label="Witness 1">{signatory(data.witness_1_name, data.witness_1_title)}</ReviewField>
                            <ReviewField label="Witness 2">{signatory(data.witness_2_name, data.witness_2_title)}</ReviewField>
                        </dl>
                    ) : (
                        <p className="text-sm text-gray-500">Using the office's standing defaults.</p>
                    )}
                    {data.notes && (
                        <p className="mt-4 text-sm text-gray-700">
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Notes: </span>
                            {data.notes}
                        </p>
                    )}
                </ReviewCard>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Donate Assets</h2>}>
            <Head title="Donate Assets" />
            <style>{HIGHLIGHT_CSS}</style>

            <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-4 px-4 sm:px-6 lg:px-8">
                {assets.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-sm text-gray-500">
                            No log assets are currently available for donation.
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <StepIndicator current={step} />

                        <form
                            onSubmit={(e: FormEvent) => {
                                e.preventDefault();
                                handleNext();
                            }}
                        >
                            {step === 1 && renderStep1()}
                            {step === 2 && renderStep2()}
                            {step === 3 && renderStep3()}
                            {step === 4 && renderStep4()}
                            {step === 5 && renderStep5()}

                            <div className="mt-6">
                                <StepNav
                                    step={step}
                                    totalSteps={STEPS.length}
                                    onBack={() => setStep(step - 1)}
                                    onNext={handleNext}
                                    nextDisabled={!canProceed()}
                                    processing={processing}
                                    highlightNext={nextTarget === "next_btn"}
                                />
                            </div>
                        </form>
                    </>
                )}
            </div>

            <AssetScanModal show={scanning} onClose={() => setScanning(false)} onFound={handleAssetScanned} />
            {piecePickerLine !== null && pickerAsset && (
                <PiecePickerModal
                    show
                    assetCode={assetLabel(pickerAsset)}
                    totalPieces={pickerAsset.quantity}
                    pieces={pickerAsset.pieces}
                    selectedIds={data.lines[piecePickerLine].piece_ids ?? []}
                    onClose={() => setPiecePickerLine(null)}
                    onConfirm={(ids) => {
                        const next = [...data.lines];
                        next[piecePickerLine] = {
                            ...next[piecePickerLine],
                            piece_ids: ids,
                            quantity: String(ids.length),
                        };
                        setData("lines", next);
                        setPiecePickerLine(null);
                    }}
                />
            )}
        </AuthenticatedLayout>
    );
}