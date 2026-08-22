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

export interface AssetPiece {
    id: number;
    asset_id: number;
    piece_number: number;
    qr_code_token: string;
    species: string | null;
    equipment_type?: string | null;
    vehicle_type?: string | null;
    description: string | null;
    length: number | null;
    width: number | null;
    height: number | null;
    volume_bd_ft: number | null;
    volume_cu_m: number | null;
    estimated_value: number | null;
    plate_number: string | null;
    disposal_id: number | null;
    disposed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Asset {
    id: number;
    asset_code: string;
    item_number: number;
    aap_number: string | null;
    type: string;
    species: string | null;
    vehicle_type?: string | null;
    equipment_type?: string | null;
    description: string | null;
    quantity: number;
    quantity_unit?: string | null;
    length?: number | string | null;
    width?: number | string | null;
    height?: number | string | null;
    volume_bd_ft?: number | string | null;
    volume_cu_m?: number | string | null;
    disposed_quantity: number;
    estimated_value?: number | string | null;
    plate_number?: string | null;
    remaining_quantity?: number;
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
    case_number: string | null;
    court_branch: string | null;
    next_hearing_date: string | null;
    documents?: DocumentItem[];
    jev?: Jev;
    disposals?: Disposal[];
    qr_scans?: QrScan[];
    pieces?: AssetPiece[];
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
    created_by_accounting?: User;
    uploaded_by_mes?: User;
}

export interface Donation {
    id: number;
    requester_name: string;
    organization_type: string | null;
    organization_type_other: string | null;
    agency_name: string | null;
    municipality: string | null;
    barangay: string | null;
    street: string | null;
    deed_of_donation_path: string | null;
    release_photo_path: string | null;
    release_order_pdf_path: string | null;
    waybill_pdf_path: string | null;
    released_at: string | null;
}

export interface DisposalDocumentRecord {
    id: number;
    document_number: string;
    pdf_path: string | null;
    issued_at: string;
}

export interface Disposal {
    id: number;
    disposal_type: string;
    quantity: number;
    volume_bd_ft: string | null;
    processed_at: string;
    report_pdf_path: string | null;
    details?: Record<string, unknown>;
    donation?: Donation;
    disposal_jev?: DisposalJev;
    ics_record?: DisposalDocumentRecord;
    par_record?: DisposalDocumentRecord;
}

export interface DisposalJev {
    id: number;
    jev_number: string;
    pdf_path: string | null;
    uploaded_at: string | null;
    issued_by_accounting?: User;
    uploaded_by_mes?: User;
}

export interface DocumentItem {
    id: number;
    document_type: string | null;
    file_path: string;
    original_name: string;
    mime_type: string | null;
    status: 'pending' | 'verified' | 'rejected';
    remarks: string | null;
    uploaded_at: string;
    uploaded_by?: User;
    verified_by?: User;
    verified_at: string | null;
}