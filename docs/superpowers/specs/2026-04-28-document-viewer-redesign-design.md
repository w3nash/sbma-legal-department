# Document Viewer Redesign Design

## Summary

Replace the browser-native PDF `iframe` viewer with a read-only in-app PDF renderer, add a global per-document download copy counter, change the download watermark to a multi-line block, and simplify the document-view page navigation.

This design applies to the existing document viewer and download flows on `feature/document-viewer-download`.

## Goals

- Remove the browser PDF toolbar and native manipulation controls from document viewing.
- Preserve an inline reading experience similar to the current embedded PDF flow.
- Track a global copy number for downloads per document.
- Stamp each downloaded PDF with a readable forensic watermark block.
- Make the document view page feel focused and standalone.

## Non-Goals

- Adding a per-user download cooldown.
- Changing the existing hourly download rate limit.
- Building a full PDF application with annotations, search panels, or thumbnails.
- Reworking case-level navigation outside the document view page.

## User Experience

### Document View Page

The document view page should become a focused reading surface.

- Remove the case tab navigation from document view.
- Remove the `Back to case` button.
- Add a breadcrumb at the top of the page:
  - `Cases > Documents > [fileName]`
- Keep document metadata visible in a document info section.
- Add `Copies downloaded` to the document info section.
- Move the `Download` action into the viewer section instead of the page header.

### PDF Viewer

The viewer should behave like an inline embedded document, but without browser-native PDF controls.

- Replace the `iframe` with a custom read-only PDF renderer using `react-pdf`.
- Render pages in a continuous vertical flow.
- Size the rendered page container around a US Letter aspect ratio (`8.5:11`).
- Allow only minimal reading controls that we own, such as zoom and page rendering behavior if needed for usability.
- Do not expose browser-native print/download/edit/manipulation UI.

### Unavailable States

The existing unavailable-state handling should remain, with the document page only rendering the viewer when the viewer artifact exists.

- If the document is still processing, show the processing state.
- If the document failed processing, show the failure state.
- If the document is marked ready but the backing artifact is unavailable, suppress the viewer and download action and show an unavailable message.

## Data Model

Add a new field to `Document`:

- `downloadCount Int @default(0)`

Purpose:

- This field is the authoritative global download copy counter for the document.
- It is not a replacement for audit history.

`AuditLog` remains unchanged as the source of per-download history.

## Download Flow

### Counter Source

Use the `Document.downloadCount` column for copy numbering.

- On each successful download attempt, atomically increment `downloadCount`.
- Use the incremented value as the `Copy Number` stamped into the watermark.
- Also include that copy number in `DOWNLOAD` audit metadata.

### Counter Semantics

- Copy numbering is global per document, not per user.
- Gaps in numbering are acceptable if a copy number is allocated and a later step fails.

Rationale:

- Atomic counters are fast and concurrency-safe.
- Counting `DOWNLOAD` audit log rows on each request is slower and more error-prone under concurrent downloads.

## Watermark Design

The current single-line slanted watermark should be replaced with a readable multi-line block.

Desired format:

```text
Control Number: 6be1edfe-e71b-4b3b-af24-1b1c191b0412
Copy Number: 12
User: Admin User
Email: admin@sbma.com
IP: ::1
Timestamp: 2026-04-28T05:00:02.839Z
```

### Watermark Requirements

- One field per row.
- Readable left-aligned block.
- No slanted text treatment.
- Continue applying the watermark to downloaded PDFs, not the viewer copy.

### Text Safety

Watermark text must remain compatible with the PDF text-rendering path.

- User-derived fields should be normalized into a PDF-safe representation before rendering.
- The output should remain readable even when the original values contain non-ASCII characters.

## IP Address Behavior

The current local-development value `::1` is expected.

- `::1` is the IPv6 loopback address.
- In local development, requests originate from the same machine, so the captured client IP may be `::1` rather than a public address.
- Production deployments behind a real proxy or load balancer should typically provide a client IP or proxy chain through `x-forwarded-for`.

This behavior should not be changed as part of this phase.

## Architecture

### Viewer Rendering

Frontend:

- Introduce a client-side viewer component that uses `react-pdf`.
- Fetch the existing `/api/documents/[documentId]/viewer` endpoint as the PDF source.
- Render the document in a vertically scrollable paper-style layout.

Server page:

- Keep the current document-view page as the server entry point for auth, document lookup, permissions, and metadata.
- Update the page structure to remove case tabs and adopt breadcrumb navigation.
- Pass only the information needed by the viewer component.

### Download Processing

Backend:

- Keep the existing authorization, rate limit, decrypt, watermark, and audit sequence.
- Add the atomic `downloadCount` increment into the download path.
- Use the new count value to populate `Copy Number`.

Persistence:

- Store the updated counter on `Document`.
- Store the copy number in the corresponding `DOWNLOAD` audit log metadata for traceability.

## Acceptance Criteria

- The document page no longer uses an `iframe`.
- The document page no longer shows case tabs.
- The document page shows a breadcrumb `Cases > Documents > [fileName]`.
- The document page does not show a `Back to case` button.
- The `Download` action appears inside the viewer section.
- The document info section shows `Copies downloaded`.
- Downloaded PDFs include the new multi-line watermark block.
- Downloaded PDFs include a global `Copy Number`.
- `Document.downloadCount` increments atomically per successful download flow.
- `DOWNLOAD` audit metadata records the copy number used for that download.
- The viewer remains read-only and does not expose the browser-native PDF toolbar.

## Risks

- Client-side PDF rendering is more complex than a native browser `iframe` and may require careful sizing for large documents.
- Very large PDFs may need render throttling or incremental loading considerations.
- Using a counter column means copy numbers can have gaps if a request fails after allocation; this is acceptable by design.

## Recommended Implementation Direction

1. Add the Prisma schema change for `Document.downloadCount`.
2. Update the watermark helper to render a multi-line block.
3. Update the download route to atomically increment `downloadCount`, stamp `Copy Number`, and record it in audit metadata.
4. Replace the `iframe` document viewer with a `react-pdf` read-only component.
5. Restructure the document page layout to remove tabs, add breadcrumbs, move the download action, and show `Copies downloaded`.
