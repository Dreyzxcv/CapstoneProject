import type { DocumentItem, StatusHistoryEntry } from "@/types";

export const AAP_DOCUMENT_TYPE = "aap_document";

export const isAapDocument = (doc: Pick<DocumentItem, "document_type">) =>
    doc.document_type === AAP_DOCUMENT_TYPE;

export type DocEvent = {
    id: string;
    kind: "document";
    doc: DocumentItem;
    timestamp: Date;
    label: string;
};

type StatusEvent = {
    id: string;
    kind: "status";
    entry: StatusHistoryEntry;
    timestamp: Date;
};

export type TimelineItem =
    | {
          kind: "status";
          id: string;
          at: number;
          entry: StatusHistoryEntry;
          docs: DocEvent[]; // required custody docs only (this is what gets counted)
          aapDocs: DocEvent[]; // shown inside the dropdown, never counted
      }
    | { kind: "info"; id: string; at: number; entry: StatusHistoryEntry }
    | { kind: "documents"; id: string; at: number; docs: DocEvent[] }
    | { kind: "aap"; id: string; at: number; event: DocEvent }; // fallback only

export function buildStatusTimeline(
    documents: DocumentItem[],
    history: StatusHistoryEntry[],
    labelFor: (documentType: string | null | undefined) => string,
): TimelineItem[] {
    const allDocEvents: DocEvent[] = documents.map((doc) => ({
        id: `doc-${doc.id}`,
        kind: "document",
        doc,
        timestamp: new Date(doc.uploaded_at),
        label: labelFor(doc.document_type),
    }));

    // AAP has its own verification flow: pulled out before grouping/counting.
    const aapEvents = allDocEvents.filter((e) => isAapDocument(e.doc));
    const docEvents = allDocEvents.filter((e) => !isAapDocument(e.doc));

    const statusEvents: StatusEvent[] = history.map((entry) => ({
        id: `status-${entry.id}`,
        kind: "status",
        entry,
        timestamp: new Date(entry.changed_at),
    }));

    const timeline = [...statusEvents, ...docEvents].sort((a, b) => {
        const diff = a.timestamp.getTime() - b.timestamp.getTime();
        if (diff !== 0) return diff;
        if (a.kind === "document" && b.kind === "status") return -1;
        if (a.kind === "status" && b.kind === "document") return 1;
        return 0;
    });

    const items: TimelineItem[] = [];
    let buffer: DocEvent[] = [];

    const flush = () => {
        if (buffer.length > 0) {
            items.push({
                kind: "documents",
                id: `docs-${buffer[0].id}`,
                at: buffer[0].timestamp.getTime(),
                docs: buffer,
            });
            buffer = [];
        }
    };

    for (const event of timeline) {
        if (event.kind === "document") {
            buffer.push(event);
            continue;
        }
        const at = event.timestamp.getTime();
        if (event.entry.event_type === "info_updated") {
            flush();
            items.push({ kind: "info", id: event.id, at, entry: event.entry });
            continue;
        }
        if (event.entry.status === "documents_uploaded") {
            items.push({
                kind: "status",
                id: event.id,
                at,
                entry: event.entry,
                docs: buffer,
                aapDocs: [],
            });
            buffer = [];
        } else {
            flush();
            items.push({
                kind: "status",
                id: event.id,
                at,
                entry: event.entry,
                docs: [],
                aapDocs: [],
            });
        }
    }
    flush();

    // Attach AAP to the first "Documents Uploaded" entry, regardless of upload time.
    if (aapEvents.length > 0) {
        const anchor = items.find(
            (i) => i.kind === "status" && i.entry.status === "documents_uploaded",
        );
        if (anchor && anchor.kind === "status") {
            anchor.aapDocs = aapEvents;
        } else {
            // No "Documents Uploaded" entry yet: show AAP standalone, in time order.
            for (const e of aapEvents) {
                const at = e.timestamp.getTime();
                const idx = items.findIndex((i) => i.at > at);
                const aapItem: TimelineItem = { kind: "aap", id: e.id, at, event: e };
                if (idx === -1) items.push(aapItem);
                else items.splice(idx, 0, aapItem);
            }
        }
    }

    return items;
}