import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { AssetStatusBadge } from "@/Components/shared/AssetStatusBadge";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import InputError from "@/Components/InputError";
import Modal from "@/Components/Modal";
import { Asset, PageProps } from "@/types";
import { documentUrl } from "@/lib/utils";
import {
    Head,
    Link,
    router,
    useForm,
    usePage,
    usePoll,
} from "@inertiajs/react";
import { FormEvent, Fragment, useMemo, useState } from "react";
import {
    FileText,
    MapPin,
    Pencil,
    Upload,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { IncidentLocationMap } from "@/Components/shared/IncidentLocationMap";
import { PdfBadge } from "@/Components/shared/PdfBadge";
import RequiredDocumentsModal from "@/Components/shared/RequiredDocumentsModal";
import CoordinatesPickerModal from "@/Components/shared/CoordinatesPickerModal";
import { CaseDetailsModal } from "@/Components/shared/CaseDetailsCard";
import { StatusHistoryEntry } from "@/types";

interface ShowProps {
    asset: Asset & {
        stcp_number: string | null;
        custody_review_status: "pending" | "approved" | "returned" | null;
        custody_review_submitted_at: string | null;
        custody_review_remarks: string | null;
    };
    relatedAssets: Asset[];
    hasAllRequiredDocuments: boolean;
    aapDocumentUploaded: boolean;

    qrPayload: string | null;
    qrSvg: string | null;
    pieceQrSvgs: Record<number, string>;
    requiredDocumentTypes: Array<{ value: string; label: string }>;
    modes: Array<{ value: string; label: string }>;
    municipalities: Array<{ value: string; label: string }>;
    barangaysByMunicipality: Record<string, string[]>;
    speciesOptions: string[];
    equipmentOptions: string[];
    allStatusHistory: StatusHistoryEntry[];
    can: {
        submitForCustodyReview: boolean;
        submitAapForReview: boolean;
        resolveCustodyReview: boolean;
        signReceipt: boolean;
        markStored: boolean;
        updateAap: boolean;
        generateQr: boolean;
        edit: boolean;
        releaseDonation: boolean;
        viewDisposalHistory: boolean;
        processDisposal: boolean;
        resolveCase: boolean;
        updateCaseDetails: boolean;
        uploadEvidence: boolean;
        issueJevOut: boolean;
        verifyDocuments: boolean;
        uploadJevOut: boolean;
    };
    documentReviewStatus: {
        all_verified: boolean;
        any_rejected: boolean;
        can_approve: boolean;
        can_return: boolean;
        show_panel: boolean;
    };
}

interface ClaimantForm {
    name: string;
    address: string;
    contact_number: string;
    id_type: string;
    id_number: string;
    id_type_other: boolean;
}

// ─── Piece Detail / Edit Modal ────────────────────────────────────────────────

const UNTAGGED_STATUSES = [
    "intake_recorded",
    "documents_uploaded",
    "pending_custody_review",
    "stored",
];

const selectClass =
    "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600";

const LAND_CLASSES = ["Timberland", "Protected Area", "Alienable & Disposable"];

const VALID_IDS: { label: string; placeholder?: string }[] = [
    { label: "PhilSys (National ID)", placeholder: "0000-0000-0000-0000" },
    { label: "Driver's License", placeholder: "e.g. N12-34-567890" },
    { label: "Passport", placeholder: "e.g. P1234567A" },
    { label: "Voter's ID", placeholder: "Enter ID number" },
    { label: "PRC ID", placeholder: "Enter PRC ID number" },
    { label: "SSS ID", placeholder: "Enter SSS number" },
    { label: "GSIS ID", placeholder: "Enter GSIS ID number" },
    { label: "Senior Citizen ID", placeholder: "Enter SC ID number" },
    { label: "PWD ID", placeholder: "Enter PWD ID number" },
    { label: "NBI Clearance", placeholder: "Enter clearance number" },
    { label: "Others" },
];

const emptyClaimant = (): ClaimantForm => ({
    name: '', address: '', contact_number: '', id_type: '', id_number: '', id_type_other: false,
});

function PieceModal({
    piece,
    asset,
    qrSvg,
    canEdit,
    onClose,
}: {
    piece: import("@/types").AssetPiece;
    asset: Asset;
    qrSvg: string | null;
    canEdit: boolean;
    onClose: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [qrLightbox, setQrLightbox] = useState(false);
    const isTagged = !UNTAGGED_STATUSES.includes(asset.current_status);

    const form = useForm({
        species: piece.species ?? "",
        vehicle_type: piece.vehicle_type ?? "",
        plate_number: piece.plate_number ?? "",
        equipment_type: piece.equipment_type ?? "",
        serial_number: piece.serial_number ?? "",
        description: piece.description ?? "",
        length: piece.length != null ? String(piece.length) : "",
        width: piece.width != null ? String(piece.width) : "",
        height: piece.height != null ? String(piece.height) : "",
    });

    function submitPieceEdit(e: FormEvent) {
        e.preventDefault();
        form.put(route("asset-pieces.update", piece.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    }

    function cancelEdit() {
        form.reset();
        form.clearErrors();
        setEditing(false);
    }

    // ── Section data ────────────────────────────────────────────────────────

    type FieldDef = {
        label: string;
        value: React.ReactNode;
        editField?: React.ReactNode;
        span?: number;
    };

    const identityFields: FieldDef[] = [];
    const dimensionFields: FieldDef[] = [];
    const valuationFields: FieldDef[] = [];

    if (asset.type === "log" || asset.type === "wildlife") {
        identityFields.push({
            label: "Species",
            value: piece.species ?? "—",
            editField: (
                <div>
                    <Input
                        value={form.data.species}
                        onChange={(e) => form.setData("species", e.target.value)}
                        className="h-8 text-sm"
                    />
                    <InputError message={form.errors.species} className="mt-1" />
                </div>
            ),
        });
    }

    if (asset.type === "vehicle") {
        identityFields.push(
            {
                label: "Vehicle type",
                value: piece.vehicle_type ?? "—",
                editField: (
                    <div>
                        <Input
                            value={form.data.vehicle_type}
                            onChange={(e) => form.setData("vehicle_type", e.target.value)}
                            className="h-8 text-sm"
                        />
                        <InputError message={(form.errors as any).vehicle_type} className="mt-1" />
                    </div>
                ),
            },
            {
                label: "Plate / conveyance no.",
                value: piece.plate_number ?? "—",
                editField: (
                    <div>
                        <Input
                            value={form.data.plate_number}
                            onChange={(e) => form.setData("plate_number", e.target.value)}
                            className="h-8 text-sm"
                        />
                        <InputError message={(form.errors as any).plate_number} className="mt-1" />
                    </div>
                ),
            },
        );
    }

    if (asset.type === "equipment") {
        identityFields.push(
            {
                label: "Equipment type",
                value: piece.equipment_type ?? "—",
                editField: (
                    <div>
                        <Input
                            value={form.data.equipment_type}
                            onChange={(e) => form.setData("equipment_type", e.target.value)}
                            className="h-8 text-sm"
                        />
                        <InputError message={(form.errors as any).equipment_type} className="mt-1" />
                    </div>
                ),
            },
            {
                label: "Serial number",
                value: (
                    <span className="font-mono tracking-wide">
                        {piece.serial_number ?? "—"}
                    </span>
                ),
                editField: (
                    <div>
                        <Input
                            value={form.data.serial_number}
                            onChange={(e) => form.setData("serial_number", e.target.value)}
                            className="h-8 text-sm font-mono"
                        />
                        <InputError message={(form.errors as any).serial_number} className="mt-1" />
                    </div>
                ),
            },
        );
    }

    identityFields.push({
        label: "Description",
        value: piece.description || <span className="text-gray-400">—</span>,
        editField: (
            <div>
                <Input
                    value={form.data.description}
                    onChange={(e) => form.setData("description", e.target.value)}
                    className="h-8 text-sm"
                />
                <InputError message={(form.errors as any).description} className="mt-1" />
            </div>
        ),
    });

    if (asset.type === "log") {
        dimensionFields.push(
            {
                label: "Length (in)",
                value: piece.length != null ? Number(piece.length).toFixed(2) : "—",
                editField: (
                    <div>
                        <Input
                            type="number"
                            value={form.data.length}
                            onChange={(e) => form.setData("length", e.target.value)}
                            className="h-8 text-sm"
                            step="0.01"
                            min="0"
                        />
                        <InputError message={(form.errors as any).length} className="mt-1" />
                    </div>
                ),
            },
            {
                label: "Width (in)",
                value: piece.width != null ? Number(piece.width).toFixed(2) : "—",
                editField: (
                    <div>
                        <Input
                            type="number"
                            value={form.data.width}
                            onChange={(e) => form.setData("width", e.target.value)}
                            className="h-8 text-sm"
                            step="0.01"
                            min="0"
                        />
                        <InputError message={(form.errors as any).width} className="mt-1" />
                    </div>
                ),
            },
            {
                label: "Height (in)",
                value: piece.height != null ? Number(piece.height).toFixed(2) : "—",
                editField: (
                    <div>
                        <Input
                            type="number"
                            value={form.data.height}
                            onChange={(e) => form.setData("height", e.target.value)}
                            className="h-8 text-sm"
                            step="0.01"
                            min="0"
                        />
                        <InputError message={(form.errors as any).height} className="mt-1" />
                    </div>
                ),
            },
            {
                label: "Volume (bd.ft)",
                value: piece.volume_bd_ft != null
                    ? Number(piece.volume_bd_ft).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "—",
                span: 2,
            },
            {
                label: "Volume (cu.m)",
                value: piece.volume_cu_m != null
                    ? Number(piece.volume_cu_m).toLocaleString("en-PH", { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                    : "—",
            },
        );

        valuationFields.push({
            label: "Estimated value",
            value: piece.estimated_value != null
                ? `₱ ${Number(piece.estimated_value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—",
        });
    }

    if (asset.type === "equipment") {
        valuationFields.push({
            label: "Estimated value",
            value: piece.estimated_value != null
                ? `₱ ${Number(piece.estimated_value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—",
        });
    }

    // ── Sub-components ───────────────────────────────────────────────────────

    function FieldCell({ field }: { field: FieldDef }) {
        return (
            <div
                className="bg-gray-50/70 p-2.5"
                style={field.span ? { gridColumn: `span ${field.span}` } : undefined}
            >
                <p className="text-[11px] text-gray-400 mb-0.5">{field.label}</p>
                {editing && field.editField ? (
                    field.editField
                ) : (
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                        {field.value}
                    </p>
                )}
            </div>
        );
    }

    function Section({
        title,
        fields,
        cols = 2,
    }: {
        title: string;
        fields: FieldDef[];
        cols?: number;
    }) {
        if (fields.length === 0) return null;
        return (
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                    {title}
                </p>
                <div
                    className="rounded-lg overflow-hidden border border-gray-200 divide-y divide-gray-200"
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        gap: "1px",
                        background: "rgb(229 231 235)",
                    }}
                >
                    {fields.map((f) => (
                        <FieldCell key={f.label} field={f} />
                    ))}
                </div>
            </div>
        );
    }

    const hasSections = dimensionFields.length > 0 || valuationFields.length > 0;

    return (
        <form onSubmit={submitPieceEdit} className="flex flex-col max-h-[90dvh]">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 mb-0.5">
                        {asset.asset_code}
                        {asset.type && (
                            <span className="ml-2 text-gray-400 font-normal capitalize">
                                · {asset.type}
                            </span>
                        )}
                    </p>
                    <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                        Piece {piece.piece_number}
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-400">
                        Encoded{" "}
                        {new Date(piece.created_at).toLocaleString("en-PH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                        })}
                    </p>
                </div>

                {/* QR code */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                    {isTagged && qrSvg ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setQrLightbox(true)}
                                className="h-[68px] w-[68px] rounded-lg border border-gray-200 bg-white p-1 shadow-sm overflow-hidden hover:ring-2 hover:ring-emerald-400 transition-all cursor-zoom-in"
                                title="Click to enlarge QR"
                                dangerouslySetInnerHTML={{ __html: qrSvg }}
                            />
                            <p className="text-[10px] text-gray-400">View QR</p>
                        </>
                    ) : (
                        <div className="h-[68px] w-[68px] rounded-lg border border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1">
                            <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75Z" />
                            </svg>
                            <p className="text-[9px] text-gray-300 text-center leading-tight px-1">
                                {isTagged ? "No QR" : "After tagging"}
                            </p>
                        </div>
                    )}
                </div>

                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="shrink-0 h-7 w-7 rounded-md border border-gray-200 bg-transparent flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                >
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            {/* ── Body ────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <Section
                    title={hasSections ? "Identity" : "Details"}
                    fields={identityFields}
                    cols={identityFields.length === 1 ? 1 : 2}
                />
                {dimensionFields.length > 0 && (
                    <Section title="Dimensions" fields={dimensionFields} cols={3} />
                )}
                {valuationFields.length > 0 && (
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                            Valuation
                        </p>
                        <div className="rounded-lg border border-gray-200 bg-gray-50/70 px-4 py-3 flex items-baseline gap-3">
                            <span className="text-xs text-gray-400">
                                {valuationFields[0].label}
                            </span>
                            <span className="ml-auto text-xl font-semibold text-gray-900 tabular-nums">
                                {valuationFields[0].value}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                <div>
                    {canEdit && (
                        editing ? (
                            <div className="flex items-center gap-2">
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={form.processing}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {form.processing ? "Saving…" : "Save changes"}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                    disabled={form.processing}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing(true)}
                                className="gap-1.5 text-gray-600"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit piece
                            </Button>
                        )
                    )}
                </div>

                {!editing && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-gray-500"
                    >
                        Close
                    </Button>
                )}
            </div>

            {/* ── QR Lightbox ─────────────────────────────────────────────── */}
            {qrLightbox && qrSvg && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setQrLightbox(false)}
                >
                    <div
                        className="relative flex flex-col items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="h-72 w-72 rounded-2xl bg-white p-4 shadow-2xl"
                            dangerouslySetInnerHTML={{ __html: qrSvg }}
                        />
                        <p className="text-sm font-medium text-white tracking-wide">
                            {asset.asset_code} — Piece {piece.piece_number}
                        </p>
                        <button
                            type="button"
                            onClick={() => setQrLightbox(false)}
                            className="mt-1 text-xs text-white/60 hover:text-white transition-colors"
                        >
                            Click anywhere to close
                        </button>
                    </div>
                </div>
            )}
        </form>
    );
}

function DocumentTimelineEntry({
    doc,
    label,
    compact = false,
}: {
    doc: import("@/types").DocumentItem;
    label: string;
    compact?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const url = documentUrl(doc.file_path);
    const isImage = doc.mime_type?.startsWith("image/");

    const statusColor =
        doc.status === "verified"
            ? "text-emerald-600"
            : doc.status === "rejected"
              ? "text-red-500"
              : "text-amber-500";

    return (
        <div className={compact ? "py-1" : "border-b border-gray-100 pb-2"}>
            <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="text-gray-700 font-medium truncate">
                        {label}
                    </span>
                    <span
                        className={`text-[10px] font-semibold capitalize shrink-0 ${statusColor}`}
                    >
                        {doc.status}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-right">
                    {compact ? (
                        <p className="text-[11px] text-gray-400">
                            {new Date(doc.uploaded_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                            })}
                        </p>
                    ) : (
                        <div>
                            {doc.uploaded_by && (
                                <p className="text-xs font-medium text-gray-700">
                                    {doc.uploaded_by.name}
                                </p>
                            )}
                            <p className="text-xs text-gray-400">
                                {new Date(doc.uploaded_at).toLocaleString()}
                            </p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setExpanded((p) => !p)}
                        className="text-gray-400 hover:text-gray-600 transition"
                        title={expanded ? "Collapse" : "View file"}
                    >
                        {expanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mt-2 ml-5 rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-start gap-3">
                        {url && (
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block h-14 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 hover:opacity-80 transition"
                                title="Open file"
                            >
                                {isImage ? (
                                    <img
                                        src={url}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-white">
                                        <FileText className="h-6 w-6 text-gray-300" />
                                    </div>
                                )}
                            </a>
                        )}
                        <div className="min-w-0 flex-1 text-xs space-y-1">
                            <p className="font-medium text-gray-700 truncate">
                                {doc.original_name}
                            </p>
                            {doc.uploaded_by && (
                                <p className="text-gray-400">
                                    Uploaded by{" "}
                                    <span className="font-medium text-gray-600">
                                        {doc.uploaded_by.name}
                                    </span>
                                </p>
                            )}
                            {doc.verified_by && doc.status === "verified" && (
                                <p className="text-gray-400">
                                    Verified by{" "}
                                    <span className="font-medium text-emerald-600">
                                        {doc.verified_by.name}
                                    </span>
                                    {doc.verified_at && (
                                        <span className="ml-1 text-gray-400">
                                            ·{" "}
                                            {new Date(
                                                doc.verified_at,
                                            ).toLocaleString()}
                                        </span>
                                    )}
                                </p>
                            )}
                            {doc.status === "rejected" && doc.remarks && (
                                <p className="rounded-md bg-red-50 px-2 py-1 text-red-700">
                                    <span className="font-semibold">
                                        Remarks:{" "}
                                    </span>
                                    {doc.remarks}
                                </p>
                            )}
                            {url && (
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block text-emerald-700 hover:underline"
                                >
                                    Open file →
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DocumentGroup({
    docs,
    defaultOpen = false,
}: {
    docs: Array<{ id: string; doc: import("@/types").DocumentItem; label: string }>;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    const count = (s: string) => docs.filter((d) => d.doc.status === s).length;
    const summary = [
        count("verified") > 0 && `${count("verified")} verified`,
        count("pending") > 0 && `${count("pending")} pending`,
        count("rejected") > 0 && `${count("rejected")} rejected`,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <div className="mt-2">
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition"
            >
                {open ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                )}
                <span>
                    {docs.length} document{docs.length === 1 ? "" : "s"}
                    {summary && (
                        <span className="ml-1 font-normal text-gray-400">· {summary}</span>
                    )}
                </span>
            </button>

            {open && (
                <div className="mt-2 ml-1.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                    {docs.map((d) => (
                        <DocumentTimelineEntry
                            key={d.id}
                            doc={d.doc}
                            label={d.label}
                            compact
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function InfoUpdateEntry({ entry }: { entry: StatusHistoryEntry }) {
    const fields = entry.changed_fields ?? [];

    return (
        <div className="flex flex-wrap justify-between gap-2 border-b border-gray-100 pb-2 text-sm">
            <div className="min-w-0 flex-1 break-words">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    <Pencil className="h-3 w-3" />
                    Information updated
                </span>

                {fields.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                        {fields.map((f, i) => (
                            <li key={`${f.label}-${i}`}>
                                <span className="font-medium text-gray-700">{f.label}</span>
                                {f.private ? (
                                    <span className="text-gray-500"> updated</span>
                                ) : (
                                    <>
                                        <span className="text-gray-500">: </span>
                                        <span className="text-gray-400 line-through">{f.from ?? "—"}</span>
                                        <span className="text-gray-400"> → </span>
                                        <span className="text-gray-800">{f.to ?? "—"}</span>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="min-w-0 shrink-0 break-words text-right text-gray-500">
                {entry.changed_by && (
                    <p className="text-xs font-medium text-gray-700">{entry.changed_by.name}</p>
                )}
                {entry.changed_by?.roles?.[0] && (
                    <p className="text-[11px] text-gray-400">{(entry.changed_by.roles[0] as any).name}</p>
                )}
                <p className="text-xs">{new Date(entry.changed_at).toLocaleString()}</p>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type PieceT = import("@/types").AssetPiece;
type Col = {
    header: string;
    right?: boolean;
    cell: (p: PieceT, count: number) => React.ReactNode;
};

const GROUP_PAGE_SIZE = 40;

const txtKey = (v: unknown) => String(v ?? "").trim();
const numKey = (v: unknown) => (v == null || v === "" ? "" : String(Number(v)));
const dash = (v: unknown) => (v == null || v === "" ? "—" : String(v));
const fmt = (v: unknown, d: number) =>
    v == null || v === ""
        ? "—"
        : Number(v).toLocaleString("en-PH", {
              minimumFractionDigits: d,
              maximumFractionDigits: d,
          });

function pieceGroupKey(type: string, p: PieceT): string {
    const x = p as any;
    const common = [
        txtKey(x.description),
        x.disposed_at ? "disposed" : "active",
        txtKey(x.disposal_id),
    ];
    let specific: string[];
    switch (type) {
        case "log":
            specific = [
                txtKey(p.species),
                numKey(p.length),
                numKey(p.width),
                numKey(p.height),
                numKey(p.volume_bd_ft),
                numKey(p.volume_cu_m),
                numKey(p.estimated_value),
            ];
            break;
        case "wildlife":
            specific = [txtKey(p.species)];
            break;
        case "vehicle":
            specific = [txtKey(p.vehicle_type), txtKey(p.plate_number)];
            break;
        case "equipment":
            specific = [
                txtKey(p.equipment_type),
                txtKey(p.serial_number),
                numKey(p.estimated_value),
            ];
            break;
        default:
            return `solo-${p.id}`; // unknown type: never group
    }
    return JSON.stringify([...specific, ...common]);
}

/** [1,2,3,5,7,8] -> "1–3, 5, 7–8" */
function formatRanges(nums: number[]): string {
    const s = [...nums].sort((a, b) => a - b);
    const out: string[] = [];
    let start = s[0];
    let prev = s[0];
    for (let i = 1; i <= s.length; i++) {
        const n = s[i];
        if (n !== prev + 1) {
            out.push(start === prev ? `${start}` : `${start}–${prev}`);
            start = n;
        }
        prev = n;
    }
    return out.join(", ");
}

function Amount({
    value,
    n,
    digits,
    prefix = "",
}: {
    value: unknown;
    n: number;
    digits: number;
    prefix?: string;
}) {
    if (value == null || value === "") return <>—</>;
    return (
        <span className="tabular-nums">
            <span className="font-semibold text-gray-900">
                {prefix}
                {fmt(Number(value) * n, digits)}
            </span>
            {n > 1 && (
                <span className="block text-[11px] font-normal text-gray-400">
                    {prefix}
                    {fmt(value, digits)} each
                </span>
            )}
        </span>
    );
}

function columnsFor(type: string): Col[] {
    switch (type) {
        case "log":
            return [
                {
                    header: "Species",
                    cell: (p) => (
                        <span className="font-medium text-gray-900">
                            {dash(p.species)}
                        </span>
                    ),
                },
                {
                    header: "Dimensions (L×W×H)",
                    cell: (p) =>
                        [p.length, p.width, p.height].map(dash).join(" × "),
                },
                {
                    header: "Vol. (bd.ft)",
                    right: true,
                    cell: (p, n) => (
                        <Amount value={p.volume_bd_ft} n={n} digits={2} />
                    ),
                },
                {
                    header: "Vol. (cu.m)",
                    right: true,
                    cell: (p, n) => (
                        <Amount value={p.volume_cu_m} n={n} digits={4} />
                    ),
                },
                {
                    header: "Est. Value",
                    right: true,
                    cell: (p, n) => (
                        <Amount
                            value={p.estimated_value}
                            n={n}
                            digits={2}
                            prefix="₱"
                        />
                    ),
                },
            ];
        case "wildlife":
            return [
                {
                    header: "Species",
                    cell: (p) => (
                        <span className="font-medium text-gray-900">
                            {dash(p.species)}
                        </span>
                    ),
                },
            ];
        case "vehicle":
            return [
                {
                    header: "Vehicle Type",
                    cell: (p) => (
                        <span className="font-medium capitalize text-gray-900">
                            {dash(p.vehicle_type)}
                        </span>
                    ),
                },
                {
                    header: "Plate / Conveyance No.",
                    cell: (p) => dash(p.plate_number),
                },
            ];
        case "equipment":
            return [
                {
                    header: "Equipment Type",
                    cell: (p) => (
                        <span className="font-medium capitalize text-gray-900">
                            {dash(p.equipment_type)}
                        </span>
                    ),
                },
                {
                    header: "Serial No.",
                    cell: (p) => (
                        <span className="font-mono">{dash(p.serial_number)}</span>
                    ),
                },
                {
                    header: "Est. Value",
                    right: true,
                    cell: (p, n) => (
                        <Amount
                            value={p.estimated_value}
                            n={n}
                            digits={2}
                            prefix="₱"
                        />
                    ),
                },
            ];
        default:
            return [];
    }
}

function PieceChips({
    pieces,
    onViewPiece,
}: {
    pieces: PieceT[];
    onViewPiece: (p: PieceT) => void;
}) {
    return (
        <div className="max-h-44 overflow-y-auto rounded-md bg-gray-50 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Select a piece to view its details and QR code
            </p>
            <div className="flex flex-wrap gap-1.5">
                {pieces.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onViewPiece(p)}
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                    >
                        #{p.piece_number}
                    </button>
                ))}
            </div>
        </div>
    );
}

function GroupedPiecesTable({
    asset,
    onViewPiece,
}: {
    asset: Asset;
    onViewPiece: (p: PieceT) => void;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState<Set<string>>(new Set());
    const [limit, setLimit] = useState(GROUP_PAGE_SIZE);

    const cols = useMemo(() => columnsFor(asset.type), [asset.type]);

    const groups = useMemo(() => {
        const map = new Map<string, PieceT[]>();
        [...(asset.pieces ?? [])]
            .sort((a, b) => a.piece_number - b.piece_number)
            .forEach((p) => {
                const k = pieceGroupKey(asset.type, p);
                const arr = map.get(k);
                if (arr) arr.push(p);
                else map.set(k, [p]);
            });
        return Array.from(map, ([key, pieces]) => ({ key, pieces }));
    }, [asset.pieces, asset.type]);

    const q = query.trim().toLowerCase();
    const filtered = q
        ? groups.filter((g) => {
              const p = g.pieces[0];
              const hay = [
                  p.species,
                  p.vehicle_type,
                  p.plate_number,
                  p.equipment_type,
                  p.serial_number,
                  p.description,
              ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
              return (
                  hay.includes(q) ||
                  g.pieces.some((x) => String(x.piece_number) === q)
              );
          })
        : groups;
    const visible = filtered.slice(0, limit);
    const totalPieces = asset.pieces?.length ?? 0;

    const totals = useMemo(() => {
        if (asset.type !== "log") return null;
        const ps = asset.pieces ?? [];
        const sum = (f: (p: PieceT) => unknown) =>
            ps.reduce((s, p) => s + (Number(f(p)) || 0), 0);
        return {
            bd: sum((p) => p.volume_bd_ft),
            cu: sum((p) => p.volume_cu_m),
            val: sum((p) => p.estimated_value),
        };
    }, [asset.pieces, asset.type]);

    function toggle(key: string) {
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    const expandable = visible.filter((g) => g.pieces.length > 1);

    return (
        <div className="space-y-3">
            {/* Summary + controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">
                        {totalPieces}
                    </span>{" "}
                    {totalPieces === 1 ? "piece" : "pieces"} in{" "}
                    <span className="font-semibold text-gray-900">
                        {groups.length}
                    </span>{" "}
                    {groups.length === 1 ? "group" : "groups"}
                    {totals && (
                        <span className="text-gray-400">
                            {" "}
                            · {fmt(totals.bd, 2)} bd.ft · {fmt(totals.cu, 4)}{" "}
                            cu.m · ₱{fmt(totals.val, 2)}
                        </span>
                    )}
                </p>
                <div className="flex items-center gap-2">
                    {expandable.length > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                setOpen(
                                    open.size > 0
                                        ? new Set()
                                        : new Set(expandable.map((g) => g.key)),
                                )
                            }
                            className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                            {open.size > 0 ? "Collapse all" : "Expand all"}
                        </button>
                    )}
                    {groups.length > 5 && (
                        <Input
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setLimit(GROUP_PAGE_SIZE);
                            }}
                            placeholder="Search species, plate, piece #…"
                            className="h-8 w-56 text-xs"
                        />
                    )}
                </div>
            </div>

            {filtered.length === 0 && (
                <p className="py-6 text-center text-sm italic text-gray-400">
                    No pieces match “{query}”.
                </p>
            )}

            {/* Desktop table */}
            {filtered.length > 0 && (
                <div className="hidden max-h-[55vh] overflow-auto rounded-md border border-gray-200 sm:block">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgb(229,231,235)]">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">
                                    Pieces
                                </th>
                                {cols.map((c) => (
                                    <th
                                        key={c.header}
                                        className={`whitespace-nowrap px-3 py-2 font-medium text-gray-500 ${c.right ? "text-right" : "text-left"}`}
                                    >
                                        {c.header}
                                    </th>
                                ))}
                                <th className="px-3 py-2 text-right font-medium text-gray-500">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {visible.map((g) => {
                                const first = g.pieces[0];
                                const n = g.pieces.length;
                                const isOpen = open.has(g.key);
                                const range = formatRanges(
                                    g.pieces.map((p) => p.piece_number),
                                );
                                return (
                                    <Fragment key={g.key}>
                                        <tr className="align-top hover:bg-gray-50">
                                            <td className="px-3 py-2">
                                                {n > 1 ? (
                                                    <button
                                                        type="button"
                                                        aria-expanded={isOpen}
                                                        onClick={() => toggle(g.key)}
                                                        className="flex items-center gap-1.5 text-left"
                                                    >
                                                        {isOpen ? (
                                                            <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                                                        ) : (
                                                            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                                        )}
                                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                                            ×{n}
                                                        </span>
                                                        <span
                                                            title={`#${range}`}
                                                            className="max-w-[9rem] truncate text-xs text-gray-500"
                                                        >
                                                            #{range}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span className="pl-5 text-xs text-gray-500">
                                                        #{first.piece_number}
                                                    </span>
                                                )}
                                            </td>
                                            {cols.map((c, i) => (
                                                <td
                                                    key={c.header}
                                                    className={`px-3 py-2 text-gray-700 ${c.right ? "whitespace-nowrap text-right" : ""}`}
                                                >
                                                    {c.cell(first, n)}
                                                    {i === 0 && first.description && (
                                                        <p className="mt-0.5 text-xs font-normal text-gray-400">
                                                            {first.description}
                                                        </p>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="whitespace-nowrap px-3 py-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        n > 1
                                                            ? toggle(g.key)
                                                            : onViewPiece(first)
                                                    }
                                                    className="text-xs font-medium text-emerald-700 hover:underline"
                                                >
                                                    {n > 1
                                                        ? isOpen
                                                            ? "Hide pieces"
                                                            : "Show pieces"
                                                        : "View"}
                                                </button>
                                            </td>
                                        </tr>
                                        {isOpen && n > 1 && (
                                            <tr>
                                                <td
                                                    colSpan={cols.length + 2}
                                                    className="bg-white px-3 pb-3 pt-0"
                                                >
                                                    <PieceChips
                                                        pieces={g.pieces}
                                                        onViewPiece={onViewPiece}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Mobile cards */}
            <div className="space-y-2 sm:hidden">
                {visible.map((g) => {
                    const first = g.pieces[0];
                    const n = g.pieces.length;
                    const isOpen = open.has(g.key);
                    return (
                        <div
                            key={g.key}
                            className="rounded-md border border-gray-200 bg-white p-3"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {n > 1 && (
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                            ×{n}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-500">
                                        #{formatRanges(g.pieces.map((p) => p.piece_number))}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        n > 1 ? toggle(g.key) : onViewPiece(first)
                                    }
                                    className="text-xs font-medium text-emerald-700"
                                >
                                    {n > 1 ? (isOpen ? "Hide" : "Show pieces") : "View"}
                                </button>
                            </div>
                            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                                {cols.map((c) => (
                                    <div key={c.header}>
                                        <dt className="text-[11px] text-gray-400">
                                            {c.header}
                                        </dt>
                                        <dd className="text-gray-800">
                                            {c.cell(first, n)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                            {first.description && (
                                <p className="mt-1.5 text-xs text-gray-400">
                                    {first.description}
                                </p>
                            )}
                            {isOpen && n > 1 && (
                                <div className="mt-2">
                                    <PieceChips
                                        pieces={g.pieces}
                                        onViewPiece={onViewPiece}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {filtered.length > limit && (
                <div className="text-center">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLimit((l) => l + GROUP_PAGE_SIZE)}
                    >
                        Show more ({filtered.length - limit} groups remaining)
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function AssetsShow({
    asset,
    relatedAssets,
    qrPayload,
    qrSvg,
    pieceQrSvgs,
    requiredDocumentTypes,
    speciesOptions,
    equipmentOptions,
    modes,
    municipalities,
    barangaysByMunicipality,
    can,
    hasAllRequiredDocuments,
    aapDocumentUploaded,
    documentReviewStatus,
    allStatusHistory,
}: ShowProps) {
    usePoll(6000, { only: ["asset"] });

    const { auth } = usePage<PageProps>().props;
    const [confirmAction, setConfirmAction] = useState<string | null>(null);
    const [selectedPiece, setSelectedPiece] = useState<
        import("@/types").AssetPiece | null
    >(null);
    const [selectedSibling, setSelectedSibling] = useState<Asset | null>(null);
    const [selectedSiblingPiece, setSelectedSiblingPiece] = useState<
        import("@/types").AssetPiece | null
    >(null);
    const [showRequiredDocsModal, setShowRequiredDocsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCoordinatesPicker, setShowCoordinatesPicker] = useState(false);

    const editForm = useForm({
        location_apprehended: asset.location_apprehended ?? "",
        apprehending_agency: asset.apprehending_agency ?? "",
        mode: asset.mode ?? "",
        date_of_apprehension: asset.incident?.date_of_apprehension
            ? asset.incident.date_of_apprehension.slice(0, 10)
            : "",
        place_of_apprehension: asset.incident?.place_of_apprehension ?? "",
        area: asset.incident?.area ?? "",
        coordinates: asset.incident?.coordinates ?? "",
        has_claimant: (asset.incident?.claimants?.length ?? 0) > 0,
        claimants: ((asset.incident?.claimants?.length ?? 0) > 0
            ? asset.incident!.claimants!.map((c) => ({
                name: c.name,
                address: c.address,
                contact_number: c.contact_number ?? "",
                id_type: c.id_type ?? "",
                id_number: c.id_number ?? "",
                id_type_other: !!c.id_type && !VALID_IDS.some((i) => i.label === c.id_type),
            }))
            : [emptyClaimant()]) as ClaimantForm[],
        apprehending_party: asset.incident?.apprehending_party ?? "",
        has_ongoing_case: asset.has_ongoing_case ?? false,
        has_confiscation_order: asset.has_confiscation_order ?? false,
    });

    const editIsTurnedOver = editForm.data.mode === "turned_over";

    const [apprehendingParties, setApprehendingParties] = useState<string[]>(
        () => {
            const parts = (asset.incident?.apprehending_party ?? "")
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean);
            return parts.length ? parts : [""];
        },
    );

    function syncParties(next: string[]) {
        setApprehendingParties(next);
        editForm.setData(
            "apprehending_party",
            next.filter((p) => p.trim() !== "").join("; "),
        );
    }

    const [coordsMode, setCoordsMode] = useState<"map" | "manual">("map");
    const [addressMunicipality, setAddressMunicipality] = useState("");
    const [addressBarangay, setAddressBarangay] = useState("");
    const [addressPickerIndex, setAddressPickerIndex] = useState<number | null>(null);
    const incidentClaimants = asset.incident?.claimants ?? [];

    function handleEditMunicipalityChange(value: string) {
        editForm.setData((prev: any) => ({
            ...prev,
            place_of_apprehension: value,
            location_apprehended: value,
        }));
    }

    function submitEdit(e: FormEvent) {
        e.preventDefault();
        editForm.put(route("assets.update", asset.id), {
            preserveScroll: true,
            onSuccess: () => setShowEditModal(false),
        });
    }

    const jevOutForm = useForm({ jev_number: "" });

    function submitJevOut(e: FormEvent, disposalId: number) {
        e.preventDefault();
        jevOutForm.post(route("disposals.jev-out.store", disposalId), {
            preserveScroll: true,
            onSuccess: () => jevOutForm.reset(),
        });
    }

    const [editingAap, setEditingAap] = useState(false);
    const aapForm = useForm({ aap_number: asset.aap_number ?? "" });

    const [editingStcp, setEditingStcp] = useState(false);
    const stcpForm = useForm({ stcp_number: asset.stcp_number ?? "" });

    function submitStcp(e: FormEvent) {
        e.preventDefault();
        stcpForm.post(route("assets.stcp-number.update", asset.id), {
            preserveScroll: true,
            onSuccess: () => setEditingStcp(false),
        });
    }

    function submitAap(e: FormEvent) {
        e.preventDefault();
        aapForm.post(route("assets.aap-number.update", asset.id), {
            preserveScroll: true,
            onSuccess: () => setEditingAap(false),
        });
    }

    function handleSubmitAapForReview() {
        if (
            confirm(
                "Notify the Property Custodian to verify the AAP Scanned Document?",
            )
        ) {
            router.post(route("assets.submit-aap-review", asset.id));
        }
    }

    const currentRole = auth.user?.roles?.[0] ?? "User";

    function handleSignReceipt() {
        if (confirm("Sign acknowledgement receipt for this asset?")) {
            router.post(route("assets.sign-receipt", asset.id));
        }
    }

    function handleMarkStored() {
        if (
            confirm(
                "Confirm documents are verified and asset has been physically tagged with its QR sticker?",
            )
        ) {
            router.post(route("assets.mark-stored", asset.id));
        }
    }

    function handleSubmitForCustodyReview() {
        if (
            confirm(
                "Submit documents for custody review? The Property Custodian will be notified.",
            )
        ) {
            router.post(route("assets.submit-for-custody-review", asset.id));
        }
    }

    function handleUploadJevOut(disposalId: number) {
        if (
            confirm(
                "Confirm the JEV Out has been uploaded? This will generate the Release Order and Waybill.",
            )
        ) {
            router.post(route("disposals.jev-out.upload", disposalId));
        }
    }

    function handleReleaseDonation() {
        if (
            pendingDonationDisposal &&
            confirm("Mark this donation as released to the requester?")
        ) {
            router.post(
                route("disposals.release-donation", pendingDonationDisposal.id),
            );
        }
    }

    const releaseForm = useForm<{ photo: File | null }>({ photo: null });

    function submitRelease(e: FormEvent) {
        e.preventDefault();
        if (!pendingDonationDisposal) return;
        if (!confirm("Mark this donation as released to the requester?"))
            return;
        releaseForm.post(
            route("disposals.release-donation", pendingDonationDisposal.id),
            {
                forceFormData: true,
                preserveScroll: true,
            },
        );
    }

    const receiptUrl = documentUrl(asset.acknowledgement_receipt?.pdf_path);
    const disposals = asset.disposals ?? [];
    const totalDisposed = disposals.reduce((sum, d) => sum + d.quantity, 0);
    const remainingQuantity = Math.max(
        0,
        (asset.quantity ?? 1) - totalDisposed,
    );
    const showDisposalHistory =
        disposals.length > 0 ||
        asset.current_status === "for_disposal" ||
        [
            "pending_release",
            "donated",
            "decayed",
            "fabricated",
            "released",
            "forfeited",
            "damaged",
        ].includes(asset.current_status);
    const isPartiallyDisposed =
        asset.current_status === "for_disposal" &&
        (asset.disposed_quantity ?? 0) > 0 &&
        (asset.disposed_quantity ?? 0) < (asset.quantity ?? 1);
    // A donation disposal still awaiting physical release/confirmation, if any.
    const pendingDonationDisposal = disposals.find(
        (d) =>
            d.disposal_type === "donation" &&
            d.donation &&
            !d.donation.released_at,
    );
    // The Donation Release card should only appear once JEV Out has been
    // issued for this donation — the Release Order / Waybill (and the act of
    // physically releasing the item) only make sense after that step.
    const donationReadyForRelease = Boolean(
        pendingDonationDisposal?.donation &&
        pendingDonationDisposal.disposal_jev?.uploaded_at,
    );
    const dateOfApprehension = asset.incident?.date_of_apprehension
        ? new Date(asset.incident.date_of_apprehension).toLocaleDateString()
        : "—";
    const placeOfApprehension =
        asset.incident?.place_of_apprehension ??
        asset.location_apprehended ??
        "—";
    const stickerSpecies = asset.species ?? "—";
    const stickerPcs = asset.quantity ?? 1;

    function CustodianReviewPanel({
        asset,
        documentReviewStatus,
    }: {
        asset: ShowProps["asset"];
        documentReviewStatus: ShowProps["documentReviewStatus"];
    }) {
        const [remarks, setRemarks] = useState("");

        function submit(decision: "approved" | "returned") {
            if (decision === "returned" && !remarks.trim()) {
                alert("Please provide remarks when returning for revision.");
                return;
            }
            if (
                !confirm(
                    decision === "approved"
                        ? "Approve custody review?"
                        : "Return for revision?",
                )
            )
                return;
            router.post(route("assets.resolve-custody-review", asset.id), {
                decision,
                remarks,
            });
        }

        return (
            <div className="border border-blue-200 bg-blue-50 rounded p-3 space-y-2">
                <p className="text-sm font-semibold text-blue-800">
                    Action Required — Custody Review
                </p>
                <p className="text-xs text-blue-700">
                    {documentReviewStatus.all_verified
                        ? "All required documents are verified. You may now approve this asset."
                        : "Some documents were rejected. Return this asset to MES for corrections."}
                </p>

                {documentReviewStatus.can_return && (
                    <textarea
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        rows={2}
                        placeholder="Remarks (required if returning)"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                    />
                )}

                <div className="flex gap-2">
                    {documentReviewStatus.can_approve && (
                        <Button
                            size="sm"
                            onClick={() => submit("approved")}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            Approve
                        </Button>
                    )}
                    {documentReviewStatus.can_return && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => submit("returned")}
                            className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                            Return
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    function updateEditClaimant(i: number, fields: Partial<ClaimantForm>) {
        editForm.setData(
            "claimants",
            editForm.data.claimants.map((c: ClaimantForm, idx: number) => (idx === i ? { ...c, ...fields } : c)),
        );
    }
    const editClaimantError = (i: number, f: string) =>
        (editForm.errors as any)[`claimants.${i}.${f}`];

    function renderEditClaimant(c: ClaimantForm, i: number) {
        const config = VALID_IDS.find((id) => id.label === c.id_type);
        const idDisabled = !c.id_type && !c.id_type_other;
        const isPhilSys = c.id_type === "PhilSys (National ID)";

        function handleIdNumberChange(raw: string) {
            if (isPhilSys) {
                const digits = raw.replace(/\D/g, "").slice(0, 16);
                updateEditClaimant(i, { id_number: digits.replace(/(\d{4})(?=\d)/g, "$1-") });
            } else {
                updateEditClaimant(i, { id_number: raw });
            }
        }

        return (
            <div key={i} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Claimant {i + 1}</span>
                    {editForm.data.claimants.length > 1 && (
                        <Button type="button" variant="ghost" size="sm"
                            onClick={() =>
                                editForm.setData("claimants",
                                    editForm.data.claimants.filter((_: ClaimantForm, idx: number) => idx !== i))
                            }>
                            ✕ Remove
                        </Button>
                    )}
                </div>

                <div className="space-y-1">
                    <Label>Claimant / Offender Name</Label>
                    <Input value={c.name} onChange={(e) => updateEditClaimant(i, { name: e.target.value })} />
                    <InputError message={editClaimantError(i, "name")} />
                </div>

                <div className="space-y-1">
                    <Label>Claimant Address</Label>
                    <div className="flex gap-2">
                        <Input value={c.address} placeholder="Municipality, Barangay" readOnly className="cursor-default bg-white" />
                        <Button type="button" variant="outline"
                            onClick={() => {
                                const parts = c.address.split(", ");
                                setAddressMunicipality(parts[0] ?? "");
                                setAddressBarangay(parts[1] ?? "");
                                setAddressPickerIndex(i);
                            }}>
                            Pick Address
                        </Button>
                    </div>
                    <InputError message={editClaimantError(i, "address")} />
                </div>

                <div className="space-y-1">
                    <Label>Contact Number</Label>
                    <Input value={c.contact_number}
                        onChange={(e) => updateEditClaimant(i, { contact_number: e.target.value })} />
                    <InputError message={editClaimantError(i, "contact_number")} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label>Valid ID Type</Label>
                        {c.id_type_other ? (
                            <div className="flex gap-2">
                                <Input placeholder="Specify ID type" value={c.id_type} autoFocus
                                    onChange={(e) => updateEditClaimant(i, { id_type: e.target.value })} />
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => updateEditClaimant(i, { id_type_other: false, id_type: "", id_number: "" })}>
                                    Back
                                </Button>
                            </div>
                        ) : (
                            <select value={c.id_type} className={selectClass}
                                onChange={(e) => {
                                    const selected = e.target.value;
                                    if (selected === "Others") {
                                        updateEditClaimant(i, { id_type_other: true, id_type: "", id_number: "" });
                                    } else {
                                        updateEditClaimant(i, { id_type: selected, id_number: "" });
                                    }
                                }}>
                                <option value="" disabled>Select ID type…</option>
                                {VALID_IDS.map((id) => (
                                    <option key={id.label} value={id.label}>{id.label}</option>
                                ))}
                            </select>
                        )}
                        <InputError message={editClaimantError(i, "id_type")} />
                    </div>
                    <div className="space-y-1">
                        <Label>ID Number</Label>
                        <Input
                            value={c.id_number}
                            onChange={(e) => handleIdNumberChange(e.target.value)}
                            placeholder={idDisabled ? "Select an ID type first"
                                : c.id_type_other ? "Enter ID number"
                                : (config?.placeholder ?? "Enter ID number")}
                            disabled={idDisabled}
                            inputMode={isPhilSys ? "numeric" : undefined}
                            maxLength={isPhilSys ? 19 : undefined}
                            className={idDisabled ? "bg-gray-50 text-gray-400" : undefined}
                        />
                        <InputError message={editClaimantError(i, "id_number")} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">
                            Asset Detail
                        </h2>
                        <p className="text-sm text-gray-500">
                            {asset.asset_code}
                        </p>
                    </div>
                    <AssetStatusBadge
                        status={asset.current_status}
                        label={asset.current_status.replace(/_/g, " ")}
                        disposedQuantity={asset.disposed_quantity}
                        quantity={asset.quantity}
                        className="px-3 py-1.5 text-sm"
                    />
                </div>
            }
        >
            <Head title={`Asset ${asset.asset_code.slice(0, 8)}`} />

            <div className="mx-auto max-w-7xl space-y-6 overflow-x-hidden px-4 sm:px-6 lg:px-8">
                <div className="grid items-start gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">
                                Overview
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                {asset.incident && (
                                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                                        {asset.asset_code}
                                    </span>
                                )}
                                {can.edit && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowEditModal(true)}
                                        className="gap-1.5"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm md:grid-cols-2 break-words">
                            <p>
                                <span className="font-medium">Types:</span>{" "}
                                {[asset, ...relatedAssets]
                                    .map((i) => i.type)
                                    .filter((v, i, a) => a.indexOf(v) === i)
                                    .join(", ")}
                            </p>
                            <p>
                                <span className="font-medium">Mode:</span>{" "}
                                {asset.mode}
                            </p>
                            {asset.mode === "turned_over" ? (
                                <div>
                                    <span className="font-medium">
                                        STCP No.:
                                    </span>{" "}
                                    {editingStcp ? (
                                        <form
                                            onSubmit={submitStcp}
                                            className="mt-1 flex items-center gap-2"
                                        >
                                            <Input
                                                value={
                                                    stcpForm.data.stcp_number
                                                }
                                                onChange={(e) =>
                                                    stcpForm.setData(
                                                        "stcp_number",
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="e.g. STCP-2026-0001"
                                                className="max-w-xs"
                                                autoFocus
                                            />
                                            <Button
                                                type="submit"
                                                size="sm"
                                                disabled={stcpForm.processing}
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setEditingStcp(false)
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        </form>
                                    ) : (
                                        <>
                                            {asset.stcp_number ?? (
                                                <span className="text-gray-400">
                                                    Not yet received
                                                </span>
                                            )}
                                            {can.updateAap && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setEditingStcp(true)
                                                    }
                                                    className="ml-2 text-xs font-medium text-emerald-700 hover:underline"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <InputError
                                        message={stcpForm.errors.stcp_number}
                                        className="mt-1"
                                    />
                                </div>
                            ) : (
                                // ── AAP No. (apprehended only) ────────────────────────
                                <div>
                                    <span className="font-medium">
                                        AAP No.:
                                    </span>{" "}
                                    {editingAap ? (
                                        <form
                                            onSubmit={submitAap}
                                            className="mt-1 flex items-center gap-2"
                                        >
                                            <Input
                                                value={aapForm.data.aap_number}
                                                onChange={(e) =>
                                                    aapForm.setData(
                                                        "aap_number",
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="e.g. AAP-2026-0042"
                                                className="max-w-xs"
                                                autoFocus
                                            />
                                            <Button
                                                type="submit"
                                                size="sm"
                                                disabled={aapForm.processing}
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setEditingAap(false)
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        </form>
                                    ) : (
                                        <>
                                            {asset.aap_number ?? (
                                                <span className="text-gray-400">
                                                    Not yet received
                                                </span>
                                            )}
                                            {can.updateAap &&
                                                asset.aap_number && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setEditingAap(true)
                                                        }
                                                        className="ml-2 text-xs font-medium text-emerald-700 hover:underline"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                        </>
                                    )}
                                    <InputError
                                        message={aapForm.errors.aap_number}
                                        className="mt-1"
                                    />
                                </div>
                            )}
                            {asset.jev?.jev_number && (
                                <p>
                                    <span className="font-medium">
                                        JEV No. (IN):
                                    </span>{" "}
                                    {asset.jev.jev_number}
                                </p>
                            )}
                            {(asset as any).aap_review_requested && (
                                <div className="md:col-span-2">
                                    <p className="text-xs text-blue-600">
                                        Custodian notified to verify AAP —{" "}
                                        {(asset as any).aap_review_requested_at
                                            ? new Date(
                                                  (asset as any)
                                                      .aap_review_requested_at,
                                              ).toLocaleDateString()
                                            : ""}
                                    </p>
                                </div>
                            )}
                            {/* All items under this AAP */}
                            {(() => {
                                const allItems = [asset, ...relatedAssets];
                                return (
                                    <div className="md:col-span-2 mt-2 border-t border-b border-gray-100 pt-4 pb-4">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Items ({allItems.length})
                                        </p>

                                        {/* Mobile */}
                                        <div className="space-y-2 sm:hidden">
                                            {allItems.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedSibling(item)
                                                    }
                                                    className="w-full rounded-md border border-gray-200 p-3 text-left active:bg-gray-50"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-gray-900 capitalize">
                                                            {item.type}
                                                        </span>
                                                        <span className="text-xs font-medium text-emerald-700">
                                                            View
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Desktop */}
                                        <div className="hidden overflow-x-auto rounded-md border border-gray-200 sm:block">
                                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                                                            Item
                                                        </th>
                                                        <th className="px-3 py-2 text-right font-medium text-gray-500">
                                                            Action
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {allItems.map((item) => (
                                                        <tr
                                                            key={item.id}
                                                            className="hover:bg-gray-50"
                                                        >
                                                            <td className="px-3 py-2 text-gray-900 capitalize">
                                                                {item.type}
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setSelectedSibling(
                                                                            item,
                                                                        )
                                                                    }
                                                                    className="text-xs font-medium text-emerald-700 hover:underline"
                                                                >
                                                                    View
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}
                            <p>
                                <span className="font-medium">Location:</span>{" "}
                                {asset.location_apprehended}
                            </p>
                            <p>
                                <span className="font-medium">Agency:</span>{" "}
                                {asset.apprehending_agency}
                            </p>

                            <p>
                                <span className="font-medium">
                                    Ongoing case:
                                </span>{" "}
                                {asset.has_ongoing_case ? "Yes" : "No"}
                            </p>
                            <p>
                                <span className="font-medium">
                                    Confiscation order:
                                </span>{" "}
                                {asset.has_confiscation_order ? "Yes" : "No"}
                            </p>
                            {(asset.case_number || asset.court_branch || asset.next_hearing_date) && (
                                <>
                                    <div className="md:col-span-2 mt-1 border-t border-gray-100 pt-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Case Details
                                        </p>
                                    </div>
                                    {asset.case_number && (
                                        <p>
                                            <span className="font-medium">Case Number:</span>{" "}
                                            {asset.case_number}
                                        </p>
                                    )}
                                    {asset.court_branch && (
                                        <p>
                                            <span className="font-medium">Court / Branch:</span>{" "}
                                            {asset.court_branch}
                                        </p>
                                    )}
                                    {asset.next_hearing_date && (
                                        <p>
                                            <span className="font-medium">Next Hearing Date:</span>{" "}
                                            {new Date(asset.next_hearing_date).toLocaleDateString()}
                                        </p>
                                    )}
                                </>
                            )}

                            {asset.incident && (
                                <>
                                    <div className="md:col-span-2 mt-1 border-t border-gray-100 pt-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            From Incident Report
                                        </p>
                                    </div>
                                    <p>
                                        <span className="font-medium">Date of Apprehension:</span>{" "}
                                        {new Date(asset.incident.date_of_apprehension).toLocaleDateString()}
                                    </p>
                                    <p>
                                        <span className="font-medium">Place of Apprehension:</span>{" "}
                                        {asset.incident.place_of_apprehension}
                                    </p>
                                    {asset.incident.area && (
                                        <p>
                                            <span className="font-medium">Land Class:</span>{" "}
                                            {asset.incident.area}
                                        </p>
                                    )}
                                    {asset.incident.coordinates && (
                                        <p className="flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                            <span className="font-medium">Coordinates:</span>{" "}
                                            {asset.incident.coordinates}
                                        </p>
                                    )}
                                    <div className="md:col-span-2">
                                        <span className="font-medium">
                                            {incidentClaimants.length > 1 ? "Claimants / Offenders:" : "Claimant / Offender:"}
                                        </span>{" "}
                                        {incidentClaimants.length === 0 ? (
                                            asset.mode !== "turned_over" ? "Abandoned (no known claimant)" : "—"
                                        ) : incidentClaimants.length === 1 ? (
                                            incidentClaimants[0].name
                                        ) : (
                                            <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                                {incidentClaimants.map((c) => (
                                                    <li key={c.id}>{c.name} — {c.address}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <p>
                                        <span className="font-medium">Apprehending Party:</span>{" "}
                                        {asset.incident.apprehending_party}
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {asset.incident?.coordinates && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Apprehension Location
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <IncidentLocationMap
                                        coordinates={asset.incident.coordinates}
                                        placeName={
                                            asset.incident.place_of_apprehension
                                        }
                                        areaName={asset.incident.area}
                                    />
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                {/* Evidence, Actions, JEV */}
                <div className="grid items-start gap-6 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-base">
                                Evidence & Documents
                            </CardTitle>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={() => setShowRequiredDocsModal(true)}
                            >
                                <Upload className="h-3.5 w-3.5" />
                                Manage
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {requiredDocumentTypes.length > 0 &&
                                (() => {
                                    const docs = asset.documents ?? [];
                                    const latestFor = (type: string) =>
                                        docs
                                            .filter(
                                                (d) => d.document_type === type,
                                            )
                                            .sort((a, b) => b.id - a.id)[0];

                                    return (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                Required Documents
                                            </p>
                                            {requiredDocumentTypes.map(
                                                (type) => {
                                                    const doc = latestFor(
                                                        type.value,
                                                    );
                                                    const status = doc?.status;
                                                    return (
                                                        <div
                                                            key={type.value}
                                                            className="flex items-center gap-2.5"
                                                        >
                                                            {status ===
                                                            "verified" ? (
                                                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-[10px]">
                                                                    ✓
                                                                </span>
                                                            ) : status ===
                                                              "rejected" ? (
                                                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-[10px]">
                                                                    ✕
                                                                </span>
                                                            ) : status ===
                                                              "pending" ? (
                                                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-[10px]">
                                                                    ⏳
                                                                </span>
                                                            ) : (
                                                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-[10px]">
                                                                    –
                                                                </span>
                                                            )}
                                                            <span
                                                                className={`text-xs ${status === "verified" ? "text-gray-600" : status === "rejected" ? "text-red-700 font-medium" : !status ? "text-gray-400" : "text-amber-700"}`}
                                                            >
                                                                {type.label}
                                                            </span>
                                                            {status && (
                                                                <span
                                                                    className={`ml-auto text-[10px] font-medium ${status === "verified" ? "text-emerald-600" : status === "rejected" ? "text-red-600" : "text-amber-600"}`}
                                                                >
                                                                    {status
                                                                        .charAt(
                                                                            0,
                                                                        )
                                                                        .toUpperCase() +
                                                                        status.slice(
                                                                            1,
                                                                        )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                },
                                            )}
                                        </div>
                                    );
                                })()}

                            {(() => {
                                const requiredTypeValues = new Set(
                                    requiredDocumentTypes.map((t) => t.value),
                                );
                                const evidenceDocs = (
                                    asset.documents ?? []
                                ).filter(
                                    (d) =>
                                        !d.document_type ||
                                        !requiredTypeValues.has(
                                            d.document_type,
                                        ),
                                );
                                if (evidenceDocs.length === 0) return null;
                                return (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Additional Evidence
                                        </p>
                                        <div className="space-y-1.5">
                                            {evidenceDocs.map((doc) => {
                                                const url = documentUrl(
                                                    doc.file_path,
                                                );
                                                const isImage =
                                                    doc.mime_type?.startsWith(
                                                        "image/",
                                                    );
                                                const typeLabel = [
                                                    {
                                                        value: "confiscation_order",
                                                        label: "Confiscation Order",
                                                    },
                                                    {
                                                        value: "forfeiture_order",
                                                        label: "Forfeiture Order",
                                                    },
                                                    {
                                                        value: "regional_confiscation_order",
                                                        label: "Regional Confiscation Order",
                                                    },
                                                    {
                                                        value: "court_order",
                                                        label: "Court Order",
                                                    },
                                                    {
                                                        value: "certificate_of_finality",
                                                        label: "Certificate of Finality",
                                                    },
                                                    {
                                                        value: "other",
                                                        label: "Other Supporting Document",
                                                    },
                                                ].find(
                                                    (t) =>
                                                        t.value ===
                                                        doc.document_type,
                                                )?.label;

                                                return (
                                                    <a
                                                        key={doc.id}
                                                        href={url ?? "#"}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2.5 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 hover:bg-gray-100 transition"
                                                    >
                                                        {isImage ? (
                                                            <img
                                                                src={url ?? ""}
                                                                className="h-7 w-7 rounded object-cover shrink-0"
                                                            />
                                                        ) : (
                                                            <PdfBadge className="h-5 w-5 shrink-0" />
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-xs font-medium text-gray-700">
                                                                {
                                                                    doc.original_name
                                                                }
                                                            </p>
                                                            {typeLabel && (
                                                                <p className="text-[10px] text-gray-400">
                                                                    {typeLabel}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span
                                                            className={
                                                                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold " +
                                                                (doc.status ===
                                                                "verified"
                                                                    ? "bg-emerald-100 text-emerald-800"
                                                                    : doc.status ===
                                                                        "rejected"
                                                                      ? "bg-red-100 text-red-800"
                                                                      : "bg-amber-100 text-amber-800")
                                                            }
                                                        >
                                                            {doc.status}
                                                        </span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {(asset.documents ?? []).length === 0 &&
                                requiredDocumentTypes.length === 0 && (
                                    <p className="text-sm text-gray-500">
                                        No documents uploaded yet.
                                    </p>
                                )}

                            {can.submitForCustodyReview && (
                                <div className="border-t pt-4 space-y-2">
                                    {!hasAllRequiredDocuments ? (
                                        <p className="text-xs text-amber-700">
                                            Upload the required documents (DAO
                                            Form, Tally Sheet, Seizure Order)
                                            before submitting for custody
                                            review.
                                        </p>
                                    ) : aapDocumentUploaded &&
                                      !asset.aap_number ? (
                                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                                            <p className="font-medium">
                                                AAP Number required before
                                                submitting.
                                            </p>
                                            <p className="mt-0.5 text-xs text-amber-700">
                                                Upload the AAP Scanned Document
                                                with the AAP number filled in.
                                            </p>
                                        </div>
                                    ) : asset.custody_review_status ===
                                      "pending" ? (
                                        <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                                            <span>⏳</span>
                                            <span>
                                                Submitted for custody review —
                                                awaiting custodian.
                                            </span>
                                        </div>
                                    ) : asset.custody_review_status ===
                                      "approved" ? (
                                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                                            <span>✅</span>
                                            <span>
                                                Custody review approved.
                                            </span>
                                        </div>
                                    ) : asset.custody_review_status ===
                                      "returned" ? (
                                        <div className="flex flex-col gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                                            <span>
                                                ❌ Returned for revision.
                                                {asset.custody_review_remarks
                                                    ? ` Remarks: ${asset.custody_review_remarks}`
                                                    : ""}
                                            </span>
                                            <button
                                                type="button"
                                                className="text-xs underline text-red-800 hover:text-red-600 text-left"
                                                onClick={
                                                    handleSubmitForCustodyReview
                                                }
                                            >
                                                Re-submit for review
                                            </button>
                                        </div>
                                    ) : (
                                        <Button
                                            className="w-full"
                                            onClick={
                                                handleSubmitForCustodyReview
                                            }
                                        >
                                            Submit for Custody Review
                                        </Button>
                                    )}
                                </div>
                            )}
                            {can.resolveCustodyReview &&
                                asset.custody_review_status === "pending" &&
                                documentReviewStatus.show_panel && (
                                    <CustodianReviewPanel
                                        asset={asset}
                                        documentReviewStatus={
                                            documentReviewStatus
                                        }
                                    />
                                )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {![
                                "stored",
                                "intake_recorded",
                                "documents_uploaded",
                                "pending_custody_review",
                            ].includes(asset.current_status) && (
                                <a
                                    href={route(
                                        "assets.stickers.pdf",
                                        asset.id,
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button
                                        variant="outline"
                                        className="w-full mt-1 mb-2"
                                    >
                                        Print Stickers
                                    </Button>
                                </a>
                            )}
                            {can.markStored && (
                                <Button
                                    className="w-full"
                                    variant="secondary"
                                    onClick={handleMarkStored}
                                >
                                    Mark as Tagged
                                </Button>
                            )}
                            {asset.has_ongoing_case && (
                                <CaseDetailsModal asset={asset} can={can} />
                            )}
                            {asset.current_status ===
                                "pending_custody_review" &&
                                !can.markStored &&
                                requiredDocumentTypes.length > 0 && (
                                    <p className="text-xs text-amber-700">
                                        Waiting on document verification before
                                        this asset can be tagged. Ensure the AAP
                                        (Scanned Document) is uploaded and
                                        verified.
                                    </p>
                                )}
                            {can.processDisposal &&
                                asset.current_status === "for_disposal" && (
                                    <Link
                                        href={route(
                                            "disposals.create",
                                            asset.id,
                                        )}
                                    >
                                        <Button
                                            className="w-full mb-2"
                                            variant="outline"
                                        >
                                            Process Disposal
                                        </Button>
                                    </Link>
                                )}
                            {!can.signReceipt &&
                                !can.markStored &&
                                !can.resolveCase &&
                                !asset.has_ongoing_case &&
                                !(
                                    can.processDisposal &&
                                    asset.current_status === "for_disposal"
                                ) &&
                                !receiptUrl && (
                                    <p className="text-sm text-gray-500">
                                        No actions available for your role at
                                        this stage.
                                    </p>
                                )}
                            {receiptUrl && (
                                <a
                                    href={receiptUrl}
                                    className="block mt-3 text-center text-sm text-emerald-700 hover:underline"
                                >
                                    Download Acknowledgement Receipt
                                </a>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <RequiredDocumentsModal
                    show={showRequiredDocsModal}
                    onClose={() => setShowRequiredDocsModal(false)}
                    assetId={asset.id}
                    requiredTypes={requiredDocumentTypes}
                    documents={asset.documents ?? []}
                    canUpload={can.uploadEvidence}
                    canVerify={can.verifyDocuments}
                />

                {/* QR + Donation */}
                {donationReadyForRelease && (
                    <div className="grid items-start gap-6 lg:grid-cols-3">
                        {donationReadyForRelease &&
                            pendingDonationDisposal?.donation && (
                                <Card className="lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-base">
                                            {pendingDonationDisposal.donation
                                                .released_at
                                                ? "Donation Released"
                                                : "Donation Release"}
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        {!pendingDonationDisposal.donation
                                            .released_at && (
                                            <>
                                                <p className="text-sm text-gray-600">
                                                    Deed of Donation is on file
                                                    for{" "}
                                                    <span className="font-medium">
                                                        {
                                                            pendingDonationDisposal
                                                                .donation
                                                                .requester_name
                                                        }
                                                    </span>
                                                    . Mark as released once the
                                                    item has been handed over.
                                                </p>

                                                {documentUrl(
                                                    pendingDonationDisposal
                                                        .donation
                                                        .waybill_pdf_path,
                                                ) && (
                                                    <a
                                                        href={
                                                            documentUrl(
                                                                pendingDonationDisposal
                                                                    .donation
                                                                    .waybill_pdf_path,
                                                            ) ?? "#"
                                                        }
                                                        className="block text-sm text-emerald-700 hover:underline"
                                                    >
                                                        Download Donation
                                                        Waybill (
                                                        {
                                                            pendingDonationDisposal.quantity
                                                        }{" "}
                                                        piece
                                                        {pendingDonationDisposal.quantity ===
                                                        1
                                                            ? ""
                                                            : "s"}
                                                        )
                                                    </a>
                                                )}

                                                {(
                                                    pendingDonationDisposal.details as {
                                                        delivery_coordinates?: string;
                                                    }
                                                )?.delivery_coordinates && (
                                                    <IncidentLocationMap
                                                        coordinates={
                                                            (
                                                                pendingDonationDisposal.details as {
                                                                    delivery_coordinates?: string;
                                                                }
                                                            )
                                                                .delivery_coordinates
                                                        }
                                                        placeName={
                                                            pendingDonationDisposal
                                                                .donation
                                                                .requester_name
                                                        }
                                                        areaName="Delivery location"
                                                    />
                                                )}

                                                {can.releaseDonation && (
                                                    <form
                                                        onSubmit={submitRelease}
                                                        className="space-y-3"
                                                    >
                                                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
                                                            {releaseForm.data
                                                                .photo
                                                                ? releaseForm
                                                                      .data
                                                                      .photo
                                                                      .name
                                                                : "Attach release photo (opens camera on mobile)"}

                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                capture="environment"
                                                                className="hidden"
                                                                onChange={(e) =>
                                                                    releaseForm.setData(
                                                                        "photo",
                                                                        e.target
                                                                            .files?.[0] ??
                                                                            null,
                                                                    )
                                                                }
                                                                required
                                                            />
                                                        </label>

                                                        <Button
                                                            type="submit"
                                                            disabled={
                                                                releaseForm.processing
                                                            }
                                                        >
                                                            Mark Donation
                                                            Released
                                                        </Button>
                                                    </form>
                                                )}
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                    </div>
                )}

                {asset.type === "vehicle" && asset.appeal_deadline && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Appeal Window
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600">
                                Owner has until{" "}
                                <span className="font-medium">
                                    {new Date(
                                        asset.appeal_deadline,
                                    ).toLocaleDateString()}
                                </span>{" "}
                                (15 days from JEV upload) to appeal to the court
                                before release or forfeiture is decided.
                            </p>
                            <p className="mt-1 text-sm">
                                {new Date(asset.appeal_deadline) > new Date()
                                    ? "Appeal window is still open."
                                    : "Appeal window has closed."}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {showDisposalHistory && can.viewDisposalHistory && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Disposal History</CardTitle>
                            <p className="text-sm text-gray-500">
                                {totalDisposed} of {asset.quantity ?? 1} unit(s) disposed
                                {remainingQuantity > 0
                                    ? ` — ${remainingQuantity} remaining`
                                    : " — fully disposed"}
                                .
                            </p>
                        </CardHeader>
                        <CardContent>
                            <Link
                                href={route("disposals.history", asset.id)}
                                className="text-sm font-medium text-emerald-700 hover:underline"
                            >
                                View disposal history →
                            </Link>
                        </CardContent>
                    </Card>
                )}

                {isPartiallyDisposed && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <span className="font-medium">
                            {asset.disposed_quantity}/{asset.quantity} units
                            disposed so far
                        </span>{" "}
                        — see Disposal History above for partial actions. This
                        AAP stays "For Disposal" until fully processed.
                    </div>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Status History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const ADDITIONAL_TYPE_LABELS: Record<
                                string,
                                string
                            > = {
                                confiscation_order: "Confiscation Order",
                                forfeiture_order: "Forfeiture Order",
                                regional_confiscation_order:
                                    "Regional Confiscation Order",
                                court_order: "Court Order",
                                certificate_of_finality:
                                    "Certificate of Finality",
                                other: "Other Supporting Document",
                            };

                            const REQUIRED_TYPE_LABELS: Record<string, string> =
                                {
                                    dao_form: "DAO Form",
                                    tally_sheet: "Tally Sheet",
                                    seizure_order: "Seizure Order",
                                    aap_document: "AAP Document",
                                    stcp_document: "STCP Document",
                                };

                            const docEvents = (asset.documents ?? []).map(
                                (doc) => ({
                                    id: `doc-${doc.id}`,
                                    kind: "document" as const,
                                    doc,
                                    timestamp: new Date(doc.uploaded_at),
                                    label:
                                        REQUIRED_TYPE_LABELS[
                                            doc.document_type ?? ""
                                        ] ??
                                        ADDITIONAL_TYPE_LABELS[
                                            doc.document_type ?? ""
                                        ] ??
                                        doc.document_type ??
                                        "Document",
                                }),
                            );

                            const statusEvents = allStatusHistory.map(
                                (entry) => ({
                                    id: `status-${entry.id}`,
                                    kind: "status" as const,
                                    entry,
                                    timestamp: new Date(entry.changed_at),
                                }),
                            );

                            const timeline = [...statusEvents, ...docEvents].sort((a, b) => {
                                const diff = a.timestamp.getTime() - b.timestamp.getTime();
                                if (diff !== 0) return diff;
                                if (a.kind === "document" && b.kind === "status") return -1;
                                if (a.kind === "status" && b.kind === "document") return 1;
                                return 0;
                            });

                            type DocEvent = (typeof docEvents)[number];
                            type TimelineItem =
                                | { kind: "status"; id: string; entry: StatusHistoryEntry; docs: DocEvent[] }
                                | { kind: "info"; id: string; entry: StatusHistoryEntry }
                                | { kind: "documents"; id: string; docs: DocEvent[] };

                            const items: TimelineItem[] = [];
                            let buffer: DocEvent[] = [];

                            const flush = () => {
                                if (buffer.length > 0) {
                                    items.push({ kind: "documents", id: `docs-${buffer[0].id}`, docs: buffer });
                                    buffer = [];
                                }
                            };

                            for (const event of timeline) {
                                if (event.kind === "document") {
                                    buffer.push(event);
                                    continue;
                                }
                                if (event.entry.event_type === "info_updated") {
                                    flush();
                                    items.push({ kind: "info", id: event.id, entry: event.entry });
                                    continue;
                                }
                                if (event.entry.status === "documents_uploaded") {
                                    items.push({ kind: "status", id: event.id, entry: event.entry, docs: buffer });
                                    buffer = [];
                                } else {
                                    flush();
                                    items.push({ kind: "status", id: event.id, entry: event.entry, docs: [] });
                                }
                            }
                            flush();

                            return (
                                <div className="space-y-2">
                                    {items.map((item) => {
                                        if (item.kind === "documents") {
                                            if (item.docs.length === 1) {
                                                const d = item.docs[0];
                                                return <DocumentTimelineEntry key={item.id} doc={d.doc} label={d.label} />;
                                            }
                                            return (
                                                <div key={item.id} className="border-b border-gray-100 pb-2">
                                                    <DocumentGroup docs={item.docs} />
                                                </div>
                                            );
                                        }
                                        
                                        if (item.kind === "info") {
                                            return <InfoUpdateEntry key={item.id} entry={item.entry} />;
                                        }
                                        const entry = item.entry;
                                        return (
                                            <div
                                                key={item.id}
                                                className="flex flex-wrap justify-between gap-2 border-b border-gray-100 pb-2 text-sm"
                                            >
                                                <div className="min-w-0 flex-1 break-words">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <AssetStatusBadge
                                                            status={entry.status}
                                                            label={entry.status.replace(/_/g, " ")}
                                                        />
                                                        {entry.asset_type &&
                                                            [
                                                                "for_disposal",
                                                                "donation_pending_jev_out",
                                                                "pending_release",
                                                                "donated",
                                                            ].includes(entry.status) && (
                                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                                    {entry.asset_type}
                                                                </span>
                                                            )}
                                                    </div>
                                                    {entry.notes && (
                                                        <p className="mt-1 text-gray-600">{entry.notes}</p>
                                                    )}

                                                    {item.docs.length > 0 && <DocumentGroup docs={item.docs} />}
                                                </div>

                                                <div className="min-w-0 shrink-0 break-words text-right text-gray-500">
                                                    {entry.changed_by && (
                                                        <p className="text-xs font-medium text-gray-700">
                                                            {entry.changed_by.name}
                                                        </p>
                                                    )}
                                                    {entry.changed_by?.roles?.[0] && (
                                                        <p className="text-[11px] text-gray-400">
                                                            {(entry.changed_by.roles[0] as any).name}
                                                        </p>
                                                    )}
                                                    <p className="text-xs">
                                                        {new Date(entry.changed_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            </div>

            {/* ── Piece detail modal ──────────────────────────────────────── */}
            <Modal
                show={selectedPiece !== null}
                onClose={() => setSelectedPiece(null)}
                maxWidth="md"
            >
                {selectedPiece && (
                    <PieceModal
                        piece={selectedPiece}
                        asset={asset}
                        qrSvg={pieceQrSvgs[selectedPiece.id] ?? null}
                        canEdit={can.edit}
                        onClose={() => setSelectedPiece(null)}
                    />
                )}
            </Modal>

            {/* ── Sibling asset pieces modal ───────────────────────────────── */}
            <Modal
                show={selectedSibling !== null}
                onClose={() => {
                    setSelectedSibling(null);
                    setSelectedSiblingPiece(null);
                }}
                maxWidth="4xl"
            >
                {selectedSibling && (
                    <div
                        key={selectedSibling.id}
                        className="max-h-[85vh] overflow-y-auto"
                    >
                        {selectedSiblingPiece && (
                            <PieceModal
                                piece={selectedSiblingPiece}
                                asset={selectedSibling}
                                qrSvg={pieceQrSvgs[selectedSiblingPiece.id] ?? null}
                                canEdit={false}
                                onClose={() => setSelectedSiblingPiece(null)}
                            />
                        )}

                        {/* Kept mounted (just hidden) so search/expanded state survives */}
                        <div className={selectedSiblingPiece ? "hidden" : "p-4 sm:p-6"}>
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
                                        {selectedSibling.asset_code}
                                    </p>
                                    <h2 className="text-lg font-bold capitalize text-gray-900">
                                        {selectedSibling.type}
                                    </h2>
                                    <p className="text-xs text-gray-400">
                                        {selectedSibling.pieces?.length ?? 0} piece(s) ·{" "}
                                        {selectedSibling.municipality_of_origin}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    <AssetStatusBadge
                                        status={selectedSibling.current_status}
                                        label={selectedSibling.current_status.replace(/_/g, " ")}
                                        disposedQuantity={selectedSibling.disposed_quantity}
                                        quantity={selectedSibling.quantity}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedSibling(null);
                                            setSelectedSiblingPiece(null);
                                        }}
                                        className="text-lg leading-none text-gray-300 hover:text-gray-500"
                                        aria-label="Close"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div className="mb-4 h-px bg-gray-100" />

                            {selectedSibling.pieces && selectedSibling.pieces.length > 0 ? (
                                <GroupedPiecesTable
                                    asset={selectedSibling}
                                    onViewPiece={setSelectedSiblingPiece}
                                />
                            ) : (
                                <p className="text-sm italic text-gray-400">
                                    No pieces recorded yet.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                show={showEditModal}
                onClose={() => {
                    if (showCoordinatesPicker || addressPickerIndex !== null) return;
                    setShowEditModal(false);
                }}
                maxWidth="2xl"
            >
                <form
                    onSubmit={submitEdit}
                    className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[90dvh] overflow-y-auto"
                >
                    <h2 className="text-lg font-semibold text-gray-800">
                        Edit Asset
                    </h2>

                    {/* Mode */}
                    <div className="space-y-1">
                        <Label htmlFor="edit-mode">Mode</Label>
                        <select
                            id="edit-mode"
                            value={editForm.data.mode}
                            onChange={(e) =>
                                editForm.setData("mode", e.target.value)
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            {modes.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                        <InputError message={editForm.errors.mode} />
                    </div>

                    {/* Location / Agency */}
                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="edit-location">Location</Label>
                            <Input
                                id="edit-location"
                                value={editForm.data.location_apprehended}
                                onChange={(e) =>
                                    editForm.setData(
                                        "location_apprehended",
                                        e.target.value,
                                    )
                                }
                            />
                            <InputError
                                message={editForm.errors.location_apprehended}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-agency">Agency</Label>
                            <Input
                                id="edit-agency"
                                value={editForm.data.apprehending_agency}
                                onChange={(e) =>
                                    editForm.setData(
                                        "apprehending_agency",
                                        e.target.value,
                                    )
                                }
                            />
                            <InputError
                                message={editForm.errors.apprehending_agency}
                            />
                        </div>
                    </div>

                    {asset.incident && (
                        <>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 pt-1">
                                From Incident Report
                            </p>

                            {/* Date */}
                            <div className="space-y-1">
                                <Label htmlFor="edit-date-apprehension">
                                    {editIsTurnedOver ? "Date of Turn-Over" : "Date of Apprehension"}
                                </Label>
                                <Input
                                    id="edit-date-apprehension"
                                    type="date"
                                    value={editForm.data.date_of_apprehension}
                                    onChange={(e) =>
                                        editForm.setData("date_of_apprehension", e.target.value)
                                    }
                                />
                                <InputError message={(editForm.errors as any).date_of_apprehension} />
                            </div>

                            {/* Province / Municipality / Land Class */}
                            <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
                                <div className="space-y-1">
                                    <Label>Province</Label>
                                    <select className={selectClass} value="Catanduanes" disabled>
                                        <option value="Catanduanes">Catanduanes</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-place-apprehension">
                                        {editIsTurnedOver
                                            ? "Municipality (Place of Turn-Over)"
                                            : "Municipality (Place of Apprehension)"}
                                    </Label>
                                    <select
                                        id="edit-place-apprehension"
                                        value={editForm.data.place_of_apprehension}
                                        onChange={(e) => handleEditMunicipalityChange(e.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="" disabled>Select municipality…</option>
                                        {municipalities.map((m) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                    <InputError message={(editForm.errors as any).place_of_apprehension} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-area">Land Class</Label>
                                    <select
                                        id="edit-area"
                                        value={editForm.data.area}
                                        onChange={(e) => editForm.setData("area", e.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="" disabled>Select land class…</option>
                                        {LAND_CLASSES.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <InputError message={(editForm.errors as any).area} />
                                </div>
                            </div>

                            {/* Coordinates */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit-coordinates">
                                        {editIsTurnedOver
                                            ? "Turn-Over Site Coordinates"
                                            : "Apprehension Site Coordinates"}
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCoordsMode((m) => (m === "map" ? "manual" : "map"))
                                        }
                                        className="text-xs font-medium text-emerald-700 hover:underline"
                                    >
                                        {coordsMode === "map" ? "Type manually instead" : "Pick on map instead"}
                                    </button>
                                </div>
                                {coordsMode === "map" ? (
                                    <div className="flex gap-2">
                                        <Input
                                            id="edit-coordinates"
                                            placeholder="e.g. 13.5833, 124.2333"
                                            value={editForm.data.coordinates}
                                            readOnly
                                            className="bg-gray-50"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowCoordinatesPicker(true)}
                                        >
                                            Pick on Map
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <Input
                                            id="edit-coordinates"
                                            placeholder="e.g. 13.5833, 124.2333"
                                            value={editForm.data.coordinates}
                                            onChange={(e) => editForm.setData("coordinates", e.target.value)}
                                            autoFocus
                                        />
                                        <p className="text-xs text-gray-500">
                                            Format: latitude, longitude (e.g. 13.7481, 124.2439)
                                        </p>
                                    </>
                                )}
                                <InputError message={(editForm.errors as any).coordinates} />
                            </div>

                            {/* Apprehending parties */}
                            <div className="space-y-2">
                                <Label>{editIsTurnedOver ? "Turning-Over Party" : "Apprehending Party"}</Label>
                                {apprehendingParties.map((party, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input
                                            value={party}
                                            placeholder="e.g. PENRO Catanduanes MES"
                                            onChange={(e) => {
                                                const next = [...apprehendingParties];
                                                next[i] = e.target.value;
                                                syncParties(next);
                                            }}
                                        />
                                        {apprehendingParties.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    syncParties(apprehendingParties.filter((_, idx) => idx !== i))
                                                }
                                            >
                                                ✕
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => syncParties([...apprehendingParties, ""])}
                                >
                                    + {editIsTurnedOver ? "Add Another Turning-Over Party" : "Add Another Apprehending Party"}
                                </Button>
                                <InputError message={(editForm.errors as any).apprehending_party} />
                            </div>

                            {/* Claimant (apprehended only) */}
                            {!editIsTurnedOver && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                                    <Label className="block">Claimant</Label>
                                    <p className="text-xs text-gray-600">
                                        Did a claimant or offender come forward? If none, this apprehension will be recorded as{" "}
                                        <span className="font-semibold text-amber-700">abandoned</span>.
                                    </p>
                                    <div className="flex gap-2">
                                        {[true, false].map((val) => (
                                            <button
                                                key={String(val)}
                                                type="button"
                                                onClick={() => {
                                                    editForm.setData((prev: any) => ({
                                                        ...prev,
                                                        has_claimant: val,
                                                        claimants: val
                                                            ? (prev.claimants.length ? prev.claimants : [emptyClaimant()])
                                                            : [emptyClaimant()],
                                                    }));
                                                }}
                                                className={
                                                    "flex-1 rounded-md border px-4 py-2 text-sm font-medium transition " +
                                                    (editForm.data.has_claimant === val
                                                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                                                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50")
                                                }
                                            >
                                                {val ? "With Claimant" : "Without Claimant (Abandoned)"}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {editForm.data.has_claimant
                                            ? "A claimant/offender has come forward regarding this apprehension."
                                            : "Abandoned — no claimant came forward. This proceeds toward automatic confiscation per DAO 97-32."}
                                    </p>

                                    {editForm.data.has_claimant && (
                                        <div className="space-y-3">
                                            {editForm.data.claimants.map((c: ClaimantForm, i: number) => renderEditClaimant(c, i))}
                                            <Button type="button" variant="outline" size="sm"
                                                disabled={editForm.data.claimants.length >= 20}
                                                onClick={() => editForm.setData("claimants", [...editForm.data.claimants, emptyClaimant()])}>
                                                + Add claimant
                                            </Button>
                                            <InputError message={(editForm.errors as any).claimants} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Legal Status (apprehended only) */}
                    {!editIsTurnedOver && (
                        <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4 space-y-3">
                            <div>
                                <Label className="block">Legal Status</Label>
                                <p className="text-xs text-gray-600">Applies to all items in this incident.</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        editForm.setData("has_ongoing_case", !editForm.data.has_ongoing_case)
                                    }
                                    className={
                                        "rounded-md border px-4 py-2 text-sm font-medium transition " +
                                        (editForm.data.has_ongoing_case
                                            ? "border-amber-600 bg-amber-100 text-amber-900"
                                            : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50")
                                    }
                                >
                                    {editForm.data.has_ongoing_case ? "Ongoing case" : "No ongoing case"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        editForm.setData(
                                            "has_confiscation_order",
                                            !editForm.data.has_confiscation_order,
                                        )
                                    }
                                    className={
                                        "rounded-md border px-4 py-2 text-sm font-medium transition " +
                                        (editForm.data.has_confiscation_order
                                            ? "border-red-600 bg-red-100 text-red-900"
                                            : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50")
                                    }
                                >
                                    {editForm.data.has_confiscation_order
                                        ? "Confiscation / Forfeiture Order"
                                        : "No order yet"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t border-gray-100 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowEditModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={editForm.processing}>
                            {editForm.processing ? "Saving…" : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </Modal>
            <Modal show={addressPickerIndex !== null} onClose={() => setAddressPickerIndex(null)} maxWidth="sm">
                <div className="p-6 space-y-5">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Select Claimant Address</h2>
                        <p className="mt-0.5 text-sm text-gray-500">Choose municipality then barangay.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="addr-municipality">Municipality</Label>
                        <select
                            id="addr-municipality"
                            value={addressMunicipality}
                            onChange={(e) => {
                                setAddressMunicipality(e.target.value);
                                setAddressBarangay("");
                            }}
                            className={selectClass}
                        >
                            <option value="" disabled>Select municipality…</option>
                            {municipalities.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="addr-barangay">Barangay</Label>
                        <select
                            id="addr-barangay"
                            value={addressBarangay}
                            onChange={(e) => setAddressBarangay(e.target.value)}
                            disabled={!addressMunicipality}
                            className={selectClass + (!addressMunicipality ? " opacity-50 cursor-not-allowed" : "")}
                        >
                            <option value="" disabled>
                                {addressMunicipality ? "Select barangay…" : "Select a municipality first"}
                            </option>
                            {(barangaysByMunicipality[addressMunicipality] ?? []).map((b) => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                        <Button type="button" variant="outline" onClick={() => setAddressPickerIndex(null)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={!addressMunicipality || !addressBarangay}
                            onClick={() => {
                                if (addressPickerIndex !== null) {
                                    updateEditClaimant(addressPickerIndex, { address: `${addressMunicipality}, ${addressBarangay}` });
                                }
                                setAddressPickerIndex(null);
                            }}
                        >
                            Confirm Address
                        </Button>
                    </div>
                </div>
            </Modal>
            <CoordinatesPickerModal
                show={showCoordinatesPicker}
                onClose={() => setShowCoordinatesPicker(false)}
                onSelect={(coords) => editForm.setData("coordinates", coords)}
                initialCoordinates={editForm.data.coordinates}
            />
        </AuthenticatedLayout>
    );
}