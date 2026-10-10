# ForestTrack User Guide

This guide explains the main tasks available to ForestTrack users. The
navigation and available actions depend on the account's assigned role and
permissions. If an expected action is missing, contact the System Admin rather
than using another person's account.

## Sign in and navigate

1. Open the ForestTrack URL provided by the system administrator.
2. Sign in with your assigned account.
3. Use the sidebar to open **Dashboard**, **Assets**, **New Incident**,
   **Scan QR**, **JEV**, **Disposals**, **Reports**, or **Audit Logs** when
   those sections are available to your role.
4. Use the account menu to open your profile or sign out.

The dashboard summarizes current records and role-specific work queues. Check
it for tasks that need attention. A notification or dashboard count indicates
work to review; open the corresponding record to see its current status and
available actions.

## Record a new incident (MES Officer)

Use **New Incident** when recording assets received through apprehension or
turn-over. The intake form is a four-step wizard:

1. **Intake Mode** — select how the asset came into MES custody.
2. **Incident Details** — enter the incident, parties, and location
   information. Record the apprehension location accurately; it is used for
   map and reporting views.
3. **Assets & Pieces** — add each asset and its pieces. Select the appropriate
   type and enter identifying details, measurements, and other requested
   information. Review the entries carefully, especially quantities and
   measurements.
4. **Review** — confirm the incident and asset details. Submit using
   **Confirm & Record** only after checking the information.

After submission, open the resulting asset record to verify the saved details
and continue any follow-up work available to your role. Correct mistakes using
the record's permitted edit actions; do not create a duplicate incident to
work around an incorrect entry.

## Find and review an asset

1. Open **Assets** to search and review inventory records available to your
   account.
2. Open an asset to view its identifiers, incident and location details,
   custody/status information, supporting documents, and available actions.
3. Check the current status and activity before updating the record. Only
   perform actions that match your role and the actual supporting paperwork.
4. Use the record's document and history sections to review existing
   attachments and prior workflow activity.

## Verify custody and assign QR tags (Property Custodian)

1. Open the asset record that is awaiting custody action.
2. Verify the asset details and required documents against the physical asset
   and source paperwork.
3. Complete the available receipt or custody-review action. Return or flag a
   record for correction when the information or documentation is incomplete;
   do not approve details you have not verified.
4. Use **Mark Stored** only when the asset has actually been received into
   storage.
5. Generate and print the QR sticker from the asset record when that action is
   available. Attach the tag to the correct asset and check that its code
   corresponds to the record.

The QR code identifies the live ForestTrack record; it is not a replacement
for required signed receipts or original legal documents.

## Scan a QR code

1. Open **Scan QR** on a device with a camera.
2. Allow the browser to use the camera when prompted. Camera access requires
   HTTPS or `localhost`.
3. Scan the ForestTrack QR code and open the result to review the linked asset.
4. If scanning is unavailable, use the record's asset code search where
   permitted, or ask the administrator to check the device's HTTPS/certificate
   setup.

Treat QR codes and scan results as government records. Do not share record
links or screenshots with unauthorized people.

## Review cases and supporting documents

MES Officers update case details and submit available reviews from the asset
record when new official information is received. Upload supporting documents
to the correct asset and use the verification action only if your role permits
it and you have checked the document. Keep physical originals according to
office procedure.

An asset subject to a pending case must remain in the appropriate custody
workflow. Do not advance it to accounting or disposal unless the case has been
resolved and the required official authority is recorded.

## Process JEV tasks (Accounting Officer)

1. Open **JEV** to see assets cleared for custodian/accounting processing and
   JEV records awaiting action.
2. Select the asset and verify its identifiers and supporting records.
3. Issue or record the JEV using the available action and enter the official
   reference accurately.
4. Upload the corresponding JEV document when requested, then confirm it is
   attached to the correct record.
5. Review disposal-related JEV tasks from the relevant disposal record when
   applicable.

Do not create a JEV based solely on a dashboard count; verify the record and
the required authorization first.

## Record a disposal or release

MES Officers and other authorized staff can open **Disposals** and the
relevant asset record to review the eligible actions. Available options depend
on asset type, legal/custody status, and permissions.

1. Verify the asset, legal status, supporting authority, and required
   accounting documents.
2. Choose only the disposition supported by the official decision and the
   workflow shown in ForestTrack.
3. Enter the requested recipient, delivery, or outcome information accurately
   and attach the required documents.
4. Confirm the disposition details before submitting. Review the asset's
   status and disposal history afterward.

Do not release, donate, destroy, fabricate, or otherwise dispose of property
without the required approval and completed paperwork. Follow current DENR and
PENRO procedures where they are more specific than this guide.

## Reports, exports, and audit history

- Open **Reports** to review inventory summaries, trends, maps, and available
  exports. Apply the displayed filters before exporting.
- Use **Audit Logs** only when your role has access. Audit entries provide a
  record of system activity; they do not replace official case files.
- Handle downloaded CSV, PDF, map, and audit exports as sensitive records.
  Store and share them only through approved office channels.

## System Admin tasks

- **Users** — create accounts with the correct role, update user details,
  deactivate access when it is no longer needed, and use the password-reset
  action according to office procedure. Assign each person an individual
  account; do not share credentials.
- **Market Prices** — maintain reference prices only from authorized sources.
- **Backup** — run or schedule backups and review the last backup status.
  Follow the [backup guide](BACKUP_PLAN.md) for server setup, off-device
  copies, and restore procedures.

## Protect records and accounts

- Sign out when leaving a shared workstation and do not save passwords in a
  shared browser profile.
- Never share passwords, QR links, exported reports, or case documents outside
  authorized channels.
- Report incorrect, duplicated, missing, or unexpectedly changed records to
  the System Admin promptly. Do not edit records to conceal an error.
- Keep the physical asset, signed paperwork, and digital record aligned.
