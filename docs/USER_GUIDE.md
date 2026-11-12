# ForesTrack User Guide

This guide covers the workflows currently available in ForesTrack. The
navigation and actions shown depend on the account's role and permissions. If
an expected action is missing, contact the System Admin; do not use another
person's account. Follow current DENR-PENRO procedures and required approvals
when handling official records or physical assets.

## Sign in and navigate

1. Open the ForesTrack URL provided by the system administrator and sign in
   with your assigned account.
2. Use the navigation menu to open **Dashboard**, **Assets**, **New
   Incident**, **Scan QR**, **JEV**, **Disposals**, or **Reports** when your
   permissions allow it. **Audit Logs** and administration pages are limited
   to authorized accounts.
3. The dashboard summarizes inventory, workflow stages, and alerts. Selected
   summary and alert data refreshes periodically; open an asset record to
   confirm its latest saved status and available actions.

## Record an incident (MES Officer)

Incident encoding is available on desktop browsers; the intake page blocks
mobile devices.

1. Open **New Incident** and select **Apprehended** or **Turned Over**. For an
   apprehension, indicate whether a claimant came forward; when there is no
   claimant, the record is classified as abandoned.
2. Enter incident dates, location, coordinates, apprehending or turning-over
   party, claimant details when applicable, and case information.
3. Add each asset and its pieces. Select the asset type and enter the
   identifying details, quantities, measurements, and other requested
   information. Review grouped piece quantities carefully.
4. Review the incident and asset information, then select **Confirm & Record**.
5. Open the resulting asset record and check that the saved information is
   correct. Use the permitted edit actions to correct mistakes; do not create
   a duplicate incident to work around an error.

## Find and review an asset

1. Open **Assets** to browse the inventory. Available filters include status
   and asset type; search can match asset code, AAP number, species, or
   municipality.
2. Open the matching asset record to review incident details, pieces,
   claimant and location information, case/custody status, documents, and
   workflow history.
3. Use the record's available actions only when permitted by your role and
   supported by the official paperwork. Some items sharing an asset code are
   shown together.

## Upload documents and request custody review (MES Officer)

1. Open the asset record and review its required-document checklist.
2. Upload each required document to the correct asset record. Check that the
   file is legible and belongs to that record.
3. Enter or verify any requested AAP information and submit the record for
   custody review when the action is available.
4. Monitor the record and notifications. If the submission is returned,
   address the custodian's remarks and submit it again when complete.

## Review custody, sign receipts, and tag assets (Property Custodian)

1. Open a record awaiting custody review and compare its details and uploaded
   documents with the physical asset and source paperwork.
2. Verify required documents and approve the review only when they are
   complete and correct. Return the record with clear remarks when it needs
   correction.
3. Complete receipt, tagging, and storage-related actions shown on the record
   when their prerequisites are satisfied. Required documents must be
   verified before the asset can be tagged.
4. Generate and print the QR sticker PDF when the action is available.
   Confirm that the sticker is attached to the correct asset or piece.

The QR code links to the current ForesTrack record; it does not replace signed
receipts, source paperwork, or original legal documents.

## Scan a QR code

1. Sign in, open **Scan QR**, and allow browser camera access.
2. Camera scanning requires HTTPS or `localhost`. Scan the ForesTrack sticker
   and open the linked asset or piece record.
3. If camera scanning is unavailable, check the device's camera permission
   and HTTPS setup. You can also search the Assets page by asset code if your
   role permits it.

QR links require an authorized signed-in account. Treat codes, scan results,
and record links as government records; do not share them with unauthorized
people. Scans are recorded in the system.

## Record case information and outcomes

MES Officers can update case details and submit supported case information
from the asset record. Upload the relevant official documents to the correct
record. An asset with an unresolved legal or court matter may remain under
trial; do not proceed with accounting or disposal unless the recorded outcome
and required authority allow it.

## Process JEV work (Accounting Officer)

1. Open **JEV** to review pending and issued JEV records. Confirm the
   asset/disposal, reference numbers, dates, and supporting records before
   acting.
2. Create JEV IN information for an asset cleared for accounting, using the
   available form and official reference details.
3. For donation disposals awaiting JEV OUT, review the donation/disposal
   record and issue or upload the JEV OUT using the available action.
4. Review the record afterward and ensure any requested document is attached
   to the correct asset or disposal.

Do not create a duplicate JEV to work around an existing record or a
dashboard count. Follow the workflow and authorization shown for the record.

## Process a disposition or release

Only assets in the appropriate workflow status can be processed. The
available disposition options depend on asset type:

- **Logs/lumber** — donation, decay, or fabrication. Quantity-based
  dispositions may be processed in parts; verify the remaining quantity and
  selected pieces.
- **Vehicles** — release to the owner or forfeiture, as supported by the
  legal outcome.
- **Equipment/tools** — mark damaged/disabled.

1. Open **Disposals** or the relevant asset record and review the eligible
   asset and action.
2. Verify the legal/custody status, official decision, quantity or pieces,
   recipient/outcome details, and required documents.
3. Enter the requested details and submit the appropriate action. Donation
   processing may require Accounting to issue JEV OUT before release
   documents and delivery can be completed.
4. Review the disposal history and resulting status. Confirm that partial
   dispositions leave only the undisposed remainder available for further
   processing.

Do not release, donate, destroy, fabricate, or otherwise dispose of property
without the required approval and completed paperwork.

## Reports, maps, exports, and audit history

- **Reports** provides inventory summaries, asset-type and municipality
  breakdowns, monthly intake trends, recent status activity, and a map of
  incidents with recorded coordinates. Use the map's available filters and
  normal, satellite, or heat-map views. Map points represent incident
  locations recorded at intake, not the current physical locations of assets.
- Available tools may include inventory CSV and compliance PDF reports,
  chart PNGs, map KML, donation records, and an attribute table. Export
  controls depend on your permissions. Review an export before sharing it;
  handle downloaded files as sensitive records.
- **Audit Logs** is restricted to authorized users (System Admin by default).
  Audit entries supplement but do not replace official case files.

## System Admin tasks

- **Users** — create accounts, assign or update roles and permissions,
  deactivate access, and send password-reset instructions. Use individual
  accounts; do not share credentials.
- **Market Prices** — maintain reference prices only from authorized
  sources. Intake may use these prices for estimates when a matching entry
  exists.
- **Backup** — review backup status, configure the available schedule and
  retention settings, or start a manual backup. A queue worker must be
  running for queued backup jobs to complete. Follow the
  [backup plan](BACKUP_PLAN.md) for server setup and restore procedures.

## Protect records and accounts

- Sign out when leaving a shared workstation. Do not save passwords in a
  shared browser profile.
- Do not share passwords, QR links, exported reports, or case documents
  outside authorized channels.
- Report incorrect, duplicated, missing, or unexpectedly changed records to
  the System Admin promptly. Do not edit records to conceal an error.
- Keep the physical asset, signed paperwork, and digital record aligned.
