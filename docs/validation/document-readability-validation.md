# Document Readability Validation — Acceptance Criteria & Quality Tradeoffs

> **SBMA-29** | Stakeholder Validation  
> Last updated: 2026-05-26

---

## 1. Purpose

The Legal Department identified a risk that over-compression or faulty conversion could render scanned legal documents unreadable when printed or reviewed on screen. This document defines the **readability acceptance criteria** enforced by the automated validation pipeline and documents the **quality tradeoffs** involved.

---

## 2. Readability Acceptance Criteria

The following checks are automatically performed **twice** during document processing:

1. **After conversion** (Office → PDF via LibreOffice)
2. **After watermarking** (viewer copy with control number overlay)

If any check fails, the document is **rejected** and marked as `failed` with a descriptive error message. It will not be stored or served.

### 2.1 Structural Integrity

| Check | Threshold | Rationale |
|---|---|---|
| PDF parseable | Must load without errors via `pdf-lib` | Detects corrupt files, truncated uploads, and conversion failures |

### 2.2 Page Count

| Check | Threshold | Rationale |
|---|---|---|
| Minimum pages | ≥ 1 page | Prevents empty documents from entering the system |
| Page count preservation | Same page count before and after watermarking | Ensures watermarking doesn't accidentally drop pages |

### 2.3 Page Dimensions

| Check | Threshold | Rationale |
|---|---|---|
| Minimum width | ≥ 72 pt (1 inch) | Catches degenerate or collapsed page layouts |
| Minimum height | ≥ 72 pt (1 inch) | Same — ensures pages are physically printable |

### 2.4 File Size per Page

| Check | Threshold | Rationale |
|---|---|---|
| Minimum bytes/page | ≥ 256 bytes | Detects pages that are blank or stripped of content during conversion |
| Maximum total size | ≤ 50 MB | Prevents oversized files from overwhelming storage and download bandwidth |

---

## 3. What We Can Detect

| Category | Detection Method | Confidence |
|---|---|---|
| Corrupt/malformed PDFs | Structural parse via pdf-lib | **High** |
| Empty conversions (0 pages) | Page count check | **High** |
| Degenerate page sizes | Dimension validation | **High** |
| Over-compressed/blank pages | Bytes-per-page heuristic | **Medium** — catches gross issues but not subtle quality loss |
| Conversion fidelity (layout) | Page count preservation | **Medium** — verifies page count, not layout accuracy |

## 4. What We Cannot Detect (Limitations)

| Category | Why | Mitigation |
|---|---|---|
| **Text readability** (font clarity, character recognition) | No OCR engine in the stack; pdf-lib cannot extract rasterized text from scanned images | Manual review of sample documents before deploying conversion settings |
| **Image quality degradation** | No image analysis library; we cannot measure DPI or compression artifacts | Rely on LibreOffice's default conversion quality (no additional compression applied) |
| **Layout fidelity** | Complex Office documents may lose formatting during conversion | Use PDF uploads whenever possible; limit Office format acceptance to simple documents |
| **Color accuracy** | No color profile validation | Not critical for legal text documents |

---

## 5. Compression Approach & Tradeoffs

### Current Approach: No Additional Compression

The system currently **does not apply any post-conversion compression**. LibreOffice converts Office files to PDF using its default settings, and the resulting PDF is stored as-is (after encryption).

| Aspect | Current Setting | Tradeoff |
|---|---|---|
| Conversion quality | LibreOffice default (high fidelity) | Larger file sizes, but maximum readability |
| PDF compression | None applied | No risk of compression artifacts; higher storage usage |
| Image resampling | None | Scanned documents retain original resolution |
| Maximum file size | 50 MB upload limit | Generous enough for most legal documents; extremely large scans may need pre-processing |

### Why No Compression

1. **Legal requirement**: Documents must be readable when printed — any lossy compression risks making fine text or stamps illegible.
2. **Forensic integrity**: Watermarks and control numbers must remain crisp for audit purposes.
3. **Storage is cheap**: S3 storage costs are negligible compared to the legal risk of unreadable documents.

### Future Considerations

If compression becomes necessary (e.g., to meet bandwidth constraints for remote offices):

- **Lossless PDF optimization** (e.g., `qpdf --linearize`) is safe and reduces size by 5–15%
- **Image resampling** above 300 DPI to 300 DPI is generally safe for printed text
- **JPEG2000 re-compression** at quality 50+ maintains readability for scanned pages
- **Always re-run readability validation** after any compression step

> ⚠️ **Any compression change must be tested against the sample document set and approved by the Legal Department before deployment.**

---

## 6. Test Methodology

### Sample Documents Used

All tests use **synthetic, non-confidential PDF documents** generated programmatically via `pdf-lib`:

| Sample | Description | Purpose |
|---|---|---|
| Single-page with text | US Letter (612×792 pt) with drawn text | Baseline valid document |
| Multi-page (10+ pages) | 10 pages with text content | Simulates large legal filings |
| Blank pages | Pages with no content | Tests minimum size detection |
| Tiny dimensions | Pages smaller than 1 inch | Tests dimension validation |
| Zero pages | Empty PDF container | Tests page count validation |
| Corrupt buffer | Non-PDF binary data | Tests structural validation |
| Watermarked document | Valid PDF + control number watermark | Tests post-watermark readability |
| Round-trip pipeline | Create → validate → watermark → validate | Tests full pipeline flow |

### Test Commands

```bash
# Run readability validation tests
npm test -- readability

# Run document processing pipeline tests (includes readability integration)
npm test -- document-processing

# Run all tests
npm test:run
```

---

## 7. Recommendations for the Legal Department

1. **Prefer PDF uploads** over Office formats when possible — this avoids conversion entirely and preserves the exact document layout.

2. **Review scanned documents at 300 DPI or higher** — the system preserves the original scan resolution, so lower-quality scans will remain low quality.

3. **Report any unreadable documents** — if a document passes automated validation but is visually unreadable, please report it so we can tighten the acceptance thresholds.

4. **Do not apply external compression** to documents before uploading — the system handles storage efficiently and any pre-compression risks quality loss.

5. **Watermarks are intentionally subtle** — viewer and forensic watermarks use light gray text at 85% opacity (`rgb(0.35, 0.35, 0.35)`), diagonal background branding at 9% opacity, and an optional SBMA seal at 7% opacity in `lib/watermark.ts`.

---

## 8. Approval

| Role | Name | Date | Status |
|---|---|---|---|
| Development | — | 2026-05-26 | ✅ Implemented |
| Legal Department | — | Pending | ⬜ Review required |
| Project Lead | — | Pending | ⬜ Sign-off required |
