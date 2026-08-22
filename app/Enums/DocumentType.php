<?php

namespace App\Enums;

enum DocumentType: string
{
    case DaoForm = 'dao_form';
    case TallySheet = 'tally_sheet';
    case SeizureOrder = 'seizure_order';
    case AapDocument = 'aap_document';
    case StcpDocument = 'stcp_document';
    case ConfiscationOrder = 'confiscation_order';
    case ForfeitureOrder = 'forfeiture_order';
    case RegionalConfiscationOrder = 'regional_confiscation_order';
    case CourtOrder = 'court_order';
    case CertificateOfFinality = 'certificate_of_finality';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::DaoForm => 'DAO Form',
            self::TallySheet => 'Tally Sheet',
            self::SeizureOrder => 'Seizure Order',
            self::AapDocument => 'AAP (Scanned Document)',
            self::StcpDocument => 'STCP Document',
            self::ConfiscationOrder => 'Confiscation Order',
            self::ForfeitureOrder => 'Forfeiture Order',
            self::RegionalConfiscationOrder => 'Regional Confiscation Order (Uploaded)',
            self::CourtOrder => 'Court Order',
            self::CertificateOfFinality => 'Certificate of Finality',
            self::Other => 'Other Supporting Document',
        };
    }
}