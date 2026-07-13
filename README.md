# LogTrack Insight

**A QR-Based Forest Asset Inventory System with Data Analytics**
Developed for DENR-PENRO Catanduanes (Provincial Environment and Natural Resources Office)

---

## About

LogTrack Insight replaces the manual, paper-based tracking of confiscated forest
assets — logs, equipment (chainsaws and similar tools), and vehicles — with a
centralized, role-restricted, QR-code-driven web platform.

Every confiscated asset gets a unique QR code that links to its live digital
profile: confiscation details, origin, species, legal status, custody history,
and every generated document. The system tracks each asset from **intake at
MES** through **Property custody**, **Accounting (JEV processing)**, and
**final disposition** (donation, decay, fabrication, release, or forfeiture),
with a full audit trail at every step.

This project was built to close a documented accountability gap: COA audits
have repeatedly flagged DENR field offices, including PENRO Catanduanes, for
lacking a clear inventory system for seized and confiscated assets — resulting
in millions of pesos in confiscated logs and equipment left to deteriorate,
untracked, in government custody.

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
- **Incident mapping** — apprehension locations plotted on an interactive
  map of Catanduanes, with asset-type and abandonment-status legends
- **Reports & analytics** — inventory summaries, municipality-based
  confiscation stats, and month-over-month trend charts
- **Append-only audit log** — every create/update/status-change/scan is
  recorded with user, timestamp, IP, and before/after values

## Domain Flow (summary)

1. **MES Intake** — asset is received as Apprehended, Abandoned, or Turned
   Over; MES encodes the details and generates an Acknowledgement Receipt
2. **Property Custody** — the Property Custodian verifies documentation,
   signs the receipt, generates the QR tag, and marks the asset as stored
3. **Case Branch** — assets with an ongoing court case remain in custody
   only; assets with a confiscation/forfeiture order proceed to Accounting
4. **Property & Accounting** — Accounting issues a JEV; once uploaded, the
   asset status moves to "For Disposal"
5. **Disposal**, branched by asset type:
   - **Logs** — donation, decay report, or fabrication into other items
   - **Equipment** — damaged/disabled to prevent reuse
   - **Conveyance** — released to owner (within a 15-day appeal window) or
     forfeited to government

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | PHP 8.3+, Laravel 13 |
| Frontend | Inertia.js, React (TypeScript), Tailwind CSS, shadcn/ui |
| Database | PostgreSQL (Docker) |
| Auth & RBAC | Laravel Breeze + Spatie `laravel-permission` |
| PDF generation | `barryvdh/laravel-dompdf` |
| QR codes | `chillerlan/php-qrcode` (generation), `html5-qrcode` (scanning) |
| Maps | Leaflet |
| Charts | Recharts |

## User Roles

| Role | Responsibilities |
|---|---|
| System Admin | Full access, user/role management, audit log visibility |
| MES Officer | Records intake, generates receipts, uploads JEV, updates case status |
| Property Custodian | Verifies documentation, signs receipts, generates/prints QR codes |
| Accounting Officer | Creates JEVs, processes disposal documentation |
| PENRO Management | Read-only dashboard, analytics, compliance report generation |

## Local Development

> **Note:** this project is served through an ngrok tunnel during development,
> which means the Vite dev server (`npm run dev`) is not reachable remotely.
> The working frontend workflow is `npm run build` followed by a hard refresh
> (`Ctrl+Shift+R`) after every source change.

```bash
# Install dependencies
composer install
npm install

# Environment setup
cp .env.example .env
php artisan key:generate

# Database
php artisan migrate
php artisan db:seed   # seeds roles/permissions + demo data

# Frontend build
npm run build
```

Then serve with `php artisan serve` (or your configured ngrok tunnel).

## Project Status

Actively in development. The system flow is being finalized in coordination
with the DENR-PENRO Catanduanes system analyst; some workflow steps
(notably JEV creation) are expected to be simplified in an upcoming revision
and are intentionally on hold pending sign-off.

## Documentation

- [`docs/MVP_DEVELOPMENT_PROMPT.md`](docs/MVP_DEVELOPMENT_PROMPT.md) — full
  MVP scope, data model, and security requirements
- [`docs/BACKUP_PLAN.md`](docs/BACKUP_PLAN.md) — backup/restore plan for
  government records

## Academic Context

LogTrack Insight is a thesis project developed under the College of
Information and Communications Technology (CICT), Catanduanes State
University, in partnership with DENR-PENRO Catanduanes, and evaluated
against ISO/IEC 25010 software quality characteristics (Functional
Suitability, Usability, Security, Reliability, Performance Efficiency).