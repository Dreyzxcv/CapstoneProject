# ForesTrack

**A QR-Based Forest Asset Inventory and GIS Mapping System**
Developed for DENR-PENRO Catanduanes (Provincial Environment and Natural Resources Office)

## About

ForesTrack is a web application for recording and monitoring forest assets
received by DENR-PENRO Catanduanes through apprehension or turn-over,
including apprehended items with no claimant. It keeps incident, claimant,
asset, piece, custody, case, and disposal information in a shared inventory
so authorized staff can follow records through the supported office workflows.

The system supports logs/lumber, equipment/tools, and conveyances/vehicles.
Incident records can include location coordinates for mapping and reporting.
QR stickers link to the current asset or piece record; users must sign in and
have permission to access the linked record. Workflow transitions appear in
status history, and QR scans and other supported actions are recorded in
audit logs.

## Core Features

- **Asset and incident intake** — record apprehensions (including abandoned
  cases with no claimant) and turn-overs, including incident details,
  claimant information where applicable, coordinates, supporting documents,
  and item-level measurements.
- **QR tagging and scanning** — generate printable QR stickers for assets and
  pieces, then scan them to open the corresponding current record.
- **Custody and document review** — upload required documents, submit records
  for Property Custodian review, record review decisions, and track receipt,
  tagging, and storage-related actions.
- **Case and accounting workflow** — record case details and holds, resolve
  case status, and create or upload Journal Entry Voucher (JEV) records for
  eligible assets and donation disposals.
- **Type-specific dispositions** — process log donations, decay, or
  fabrication; vehicle release or forfeiture; and equipment damage/disablement.
  Log dispositions can be recorded by quantity or selected pieces.
- **Dashboard and alerts** — show inventory counts, role-specific workflow
  summaries, and alerts for items needing attention. Selected dashboard data
  refreshes periodically; open the asset record to confirm its latest saved
  status.
- **Reports and maps** — review inventory summaries, asset-type and
  municipality breakdowns, monthly intake trends, and incident locations with
  normal, satellite, and heat-map views. Map points are based on recorded
  incident coordinates.
- **Exports and documents** — available outputs include inventory CSV and
  compliance PDF reports, map KML, chart PNGs, and workflow documents such as
  acknowledgement receipts, JEVs, decay reports, donation documents, asset
  tags, and ICS/PAR documents where applicable.
- **Role-based access and audit history** — restrict available actions by
  role and permission. Supported audit events record the actor, time, IP
  address, and before/after values where available; audit-log access is
  reserved for authorized users.
- **Administration** — manage users and permissions, maintain reference
  market prices, and run or configure database backups.

## System Workflow

1. **Incident intake** — an authorized staff member records the incident and
   one or more assets, including pieces and available location and case
   details.
2. **Documents and custody review** — required supporting documents are
   uploaded and submitted for Property Custodian review. The custodian can
   approve or return a submission for correction.
3. **Receipt, tagging, and case handling** — custody actions are recorded on
   the asset record. Assets with unresolved legal or court matters can remain
   under trial; eligible assets proceed to accounting.
4. **Accounting** — the Accounting Officer records JEV IN information for
   assets cleared for accounting. Donation disposals may also require a JEV
   OUT before release documents are completed.
5. **Disposition and follow-up** — authorized staff record the disposition
   supported by the asset type and workflow. Some log dispositions can be
   processed in partial quantities; the asset remains available for further
   processing until fully disposed.

The actions available at each stage depend on the asset's status, type, and
the user's permissions. Follow current DENR-PENRO procedures and required
official approvals when processing records.

## Technology

| Layer | Technology |
|---|---|
| Backend | PHP 8.3+, Laravel 13 |
| Frontend | Inertia.js, React (TypeScript), Tailwind CSS, shadcn/ui |
| Database | PostgreSQL (Docker for local development) |
| Authorization | Laravel authentication and Spatie `laravel-permission` |
| PDF generation | `barryvdh/laravel-dompdf` |
| QR codes | `chillerlan/php-qrcode` (generation), `html5-qrcode` (scanning) |
| GIS / Mapping | Leaflet, OpenStreetMap and Esri basemap tiles |
| Charts | Recharts |

## Default User Roles

These are the roles and permissions created by the default role seeder.
Navigation and available actions are permission-based and may be changed by
the System Admin.

| Role | Main responsibilities |
|---|---|
| System Admin | User and permission administration, system settings, backup, audit logs, and access to all seeded permissions |
| MES Officer | Incident intake, asset updates, case details, document uploads, custody-review submissions, and permitted disposal processing |
| Property Custodian | Custody review, receipt signing, document verification, storage/tagging actions, and QR sticker generation |
| Accounting Officer | JEV IN/OUT work, JEV uploads, disposal and report viewing, and report exports |
| PENRO Management | Read-only inventory and disposal views, reports, and report exports |

## Installation and Local Development

See the [installation guide](docs/INSTALLATION.md) for requirements,
PostgreSQL setup, environment configuration, and local development or office
LAN instructions.

## Documentation

- [`docs/INSTALLATION.md`](docs/INSTALLATION.md) — prerequisites and
  step-by-step installation
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — role-aware instructions for
  staff using ForesTrack
- [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) — LAN host
  startup, maintenance, and operational checks
- [`docs/MVP_DEVELOPMENT_PROMPT.md`](docs/MVP_DEVELOPMENT_PROMPT.md) — MVP
  scope, data model, and requirements
- [`docs/BACKUP_PLAN.md`](docs/BACKUP_PLAN.md) — backup and restore plan for
  government records

## Academic Context

ForesTrack is a thesis project developed under the College of Information and
Communications Technology (CICT), Catanduanes State University, in
partnership with DENR-PENRO Catanduanes, and evaluated against ISO/IEC 25010
software quality characteristics (Functional Suitability, Usability,
Security, Reliability, Performance Efficiency).
