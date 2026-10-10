# ForestTrack

**A QR-Based Forest Asset Inventory and GIS Mapping System**
Developed for DENR-PENRO Catanduanes (Provincial Environment and Natural Resources Office)

---

## About

ForestTrack is a web-based asset inventory and monitoring system designed to
streamline the tracking of confiscated forest resources and related government
property. It replaces manual documentation with a centralized, role-based
platform that uses QR codes, GIS mapping, and analytics to support secure and
transparent custody monitoring.

Each confiscated asset is assigned a unique QR code linked to its digital
record, including its origin, species, legal status, custody history, and
supporting documents. The system follows the asset from **intake at MES** to
**property custody**, **accounting and JEV processing**, and **final disposal**
(donation, decay, fabrication, release, or forfeiture), while maintaining a
complete audit trail at every step. Apprehension locations are also captured
and mapped to provide spatial visibility into confiscation trends across
Catanduanes.

The project addresses the accountability gap in managing seized and
confiscated forest assets, where limited documentation and inconsistent
tracking often lead to missing records, delays, and loss of value in public
custody.

## Core Features

- **QR code generation & tagging** — each asset gets an opaque, signed QR
  token; scanning it always shows the current record, not a static snapshot
- **Role-Based Access Control (RBAC)** — System Admin, MES Officer, Property
  Custodian, Accounting Officer, and PENRO Management each see only what
  their role permits, enforced at both the controller and UI level
- **Full asset lifecycle tracking** — intake → custody review → receipt
  signing → storage → (case branch) → accounting → disposal, with every
  transition logged
- **Document generation (PDF)** — Acknowledgement Receipt, Journal Entry
  Voucher (JEV), Inventory Custodian Slip (ICS), Property Acknowledgement
  Receipt (PAR), Deed of Donation, Decay Report, and DAO 97-32 compliance
  reports
- **Real-time inventory dashboard** — role-specific views of asset counts,
  pipeline stages, and actionable alerts (appeal deadlines, decay risk,
  stalled paperwork)
- **GIS incident mapping** — apprehension coordinates logged at intake are
  plotted on an interactive Leaflet map of Catanduanes, with Normal/Satellite
  basemap toggle, asset-type color coding, and abandonment-status markers;
  donation delivery points and individual asset locations are similarly
  mapped on their respective records
- **Reports & analytics** — inventory summaries, municipality-based
  confiscation stats, and month-over-month trend charts
- **Append-only audit log** — every create/update/status-change/scan is
  recorded with user, timestamp, IP, and before/after values

## System Workflow

1. **Incident Intake** — the asset is recorded as apprehended, abandoned, or
   turned over, with location and supporting details captured at MES
2. **QR Tagging & Validation** — the Property Custodian verifies the record,
   generates and assigns the QR tag, and confirms storage or custody status
3. **Case Review & Monitoring** — assets under legal action remain in custody
   while status updates, documents, and audit records are tracked
4. **Accounting & Disposal Preparation** — accounting reviews the asset and
   prepares required JEV and disposition documents before final action
5. **Disposal & Reporting** — the asset is released, donated, forfeited,
   fabricated, or reported as decayed, with the result reflected in the
   dashboard and audit trail

   - **Logs** — donation, decay report, or fabrication into other items
   - **Equipment** — damaged/disabled to prevent reuse
   - **Conveyance** — released to owner within the appeal period or forfeited
     to government

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | PHP 8.3+, Laravel 13 |
| Frontend | Inertia.js, React (TypeScript), Tailwind CSS, shadcn/ui |
| Database | PostgreSQL (Docker) |
| Auth & RBAC | Laravel Breeze + Spatie `laravel-permission` |
| PDF generation | `barryvdh/laravel-dompdf` |
| QR codes | `chillerlan/php-qrcode` (generation), `html5-qrcode` (scanning) |
| GIS / Mapping | Leaflet, with CartoDB/Esri satellite and OpenStreetMap basemaps |
| Charts | Recharts |

## User Roles

| Role | Responsibilities |
|---|---|
| System Admin | Full access, user/role management, audit log visibility |
| MES Officer | Records intake, generates receipts, uploads JEV, updates case status |
| Property Custodian | Verifies documentation, signs receipts, generates/prints QR codes |
| Accounting Officer | Creates JEVs, processes disposal documentation |
| PENRO Management | Read-only dashboard, analytics, compliance report generation |

## Installation and Local Development

See the [installation guide](docs/INSTALLATION.md) for required tools,
PHP extensions, PostgreSQL Docker setup, environment configuration, and
commands to run the application locally or make it available on the LAN over
HTTPS using Caddy and the host computer's IP address.

## Project Status

Actively in development. The system flow is being finalized in coordination
with the DENR-PENRO Catanduanes system analyst; some workflow steps
(notably JEV creation) are expected to be simplified in an upcoming revision
and are intentionally on hold pending sign-off.

## Documentation

- [`docs/INSTALLATION.md`](docs/INSTALLATION.md) — prerequisites and
  step-by-step local installation
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — role-based instructions for
  staff using ForestTrack
- [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) — LAN host
  startup, maintenance, and operational checks
- [`docs/MVP_DEVELOPMENT_PROMPT.md`](docs/MVP_DEVELOPMENT_PROMPT.md) — full
  MVP scope, data model, and security requirements
- [`docs/BACKUP_PLAN.md`](docs/BACKUP_PLAN.md) — backup/restore plan for
  government records

## Academic Context

ForestTrack is a thesis project developed under the College of Information
and Communications Technology (CICT), Catanduanes State University, in
partnership with DENR-PENRO Catanduanes, and evaluated against ISO/IEC 25010
software quality characteristics (Functional Suitability, Usability,
Security, Reliability, Performance Efficiency).