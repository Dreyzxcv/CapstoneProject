export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    roles: string[];
    permissions: string[];
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User | null;
    };
    flash: {
        success?: string;
        error?: string;
    };
};

export interface Incident {
    id: number;
    incident_code: string;
    date_of_apprehension: string;
    place_of_apprehension: string;
    area: string | null;
    coordinates: string | null;
    claimant_offender_name: string | null;
    is_abandoned: boolean;
    apprehending_party: string;
    date_report_submitted: string | null;
}

export interface Asset {
    id: number;
    asset_code: string;
    type: string;
    species: string | null;
    description: string | null;
    municipality_of_origin: string;
    location_apprehended: string;
    apprehending_agency: string;
    mode: string;
    has_ongoing_case: boolean;
    has_confiscation_order: boolean;
    appeal_deadline: string | null;
    current_status: string;
    qr_code_token: string;
    created_at: string;
    incident?: Incident;
    creator?: User;
    acknowledgement_receipt?: AcknowledgementReceipt;
    status_history?: StatusHistoryEntry[];
    jev?: Jev;
    disposal?: Disposal;
    qr_scans?: QrScan[];
}

export interface AcknowledgementReceipt {
    id: number;
    receipt_number: string;
    signed_at: string | null;
    pdf_path: string | null;
    signed_by_custodian?: User;
}

export interface StatusHistoryEntry {
    id: number;
    status: string;
    notes: string | null;
    changed_at: string;
    changed_by?: User;
}

export interface JevLineItem {
    account_title: string;
    account_code: string | null;
    sub_object_code: string | null;
    debit: number | string | null;
    credit: number | string | null;
}

export interface Jev {
    id: number;
    jev_number: string;
    funding_source_code: string | null;
    funding_source_label: string | null;
    transaction_type: string | null;
    transaction_code: string | null;
    responsibility_center: string | null;
    document_no: string | null;
    particulars: string | null;
    prepared_by_name: string | null;
    approved_by_name: string | null;
    line_items: JevLineItem[] | null;
    pdf_path: string | null;
    uploaded_at: string | null;
    uploaded_by_mes?: User;
}

export interface Donation {
    id: number;
    requester_name: string;
    deed_of_donation_path: string | null;
    released_at: string | null;
}

export interface Disposal {
    id: number;
    disposal_type: string;
    processed_at: string;
    details?: Record<string, unknown>;
    donation?: Donation;
}

export interface QrScan {
    id: number;
    scan_location_note: string | null;
    resulting_status: string;
    scanned_at: string;
    scanned_by?: User;
}
