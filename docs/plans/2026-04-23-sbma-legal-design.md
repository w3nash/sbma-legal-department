# SBMA Legal Affairs — Document Archive Design

**Date:** 2026-04-23
**Status:** Approved

## 1. Overview

SBMA Legal Affairs is an internal legal document archive for a legal team. It allows uploading, organizing, viewing, and downloading case-related documents with strong access control, audit logging, and forensic watermarking.

The app is a **single Next.js 16 application** deployed via **Docker Compose** alongside PostgreSQL, MinIO (S3-compatible object storage), and Redis. Every document is encrypted at rest. Viewing uses a cached, control-number-only watermarked copy. Downloading/printing generates a unique hard-baked watermark per user per request.

---

## 2. Goals

- Case-centric document storage (Hierarchical: Case → Document)
- Role-based access: Admin and Member
- Upload any file format, auto-convert to PDF for viewing/watermarking
- Encrypt all stored files
- Audit every view, download, print, upload, and login/logout
- Forensic watermarking: control number visible to all; on download/print, watermark includes user name, email, IP, timestamp
- Self-hosted via Docker Compose

---

## 3. Non-Goals (V1)

- Client portal (external client access)
- Full-text search inside PDFs
- Versioning (multiple versions of the same document)
- Email notifications
- 2FA / MFA (future iteration)
- Master key rotation without re-encryption

---

## 4. Architecture

### 4.1 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | BetterAuth |
| Storage | MinIO (local), AWS S3 (cloud, env-switchable) |
| Cache | Redis |
| Client State | TanStack React Query |
| PDF Processing | `pdf-lib` (Node.js, server-side) |
| File Conversion | LibreOffice headless (`soffice`) |
| Encryption | AES-256-GCM per file, key encrypted by master env key |
| Viewer | `react-pdf` or iframe to PDF blob URL |
| Testing | Vitest (unit + integration), no E2E |

### 4.2 Deployment

Docker Compose orchestrates:
- `app`: Next.js server
- `db`: PostgreSQL
- `storage`: MinIO
- `cache`: Redis

All services on an internal Docker network. No external dependencies required for local use.

### 4.3 High-Level Flows

**Upload**
1. Member/Admin uploads via Server Action.
2. Server converts to PDF (LibreOffice for non-PDFs).
3. Generates UUID-based control number.
4. Encrypts PDF with AES-256-GCM.
5. Stores encrypted original in MinIO/S3.
6. Generates **viewer copy**: hard-bakes control number watermark only. Encrypts and stores in S3.
7. Caches viewer copy in Redis (TTL: 1 hour, keyed by `documentId`).
8. Writes metadata to PostgreSQL via Prisma.
9. Writes audit log: `UPLOAD`.

**View**
1. Client requests via TanStack Query → API route.
2. Server checks case membership (Admin bypasses, Member must be in `CaseMember`).
3. Fetches viewer copy from Redis cache (or S3 on miss). Decrypts in memory.
4. Streams to browser.
5. Client renders via `react-pdf` or iframe.
6. Writes audit log: `VIEW`.

**Download / Print**
1. Client requests download via API route.
2. Server checks permissions.
3. Fetches **original encrypted PDF** from S3. Decrypts in memory.
4. Hard-bakes unique watermark: `Control Number | User Full Name | User Email | IP Address | Timestamp`.
5. Streams watermarked PDF to browser (`Content-Disposition: attachment`).
6. Writes audit log: `DOWNLOAD` or `PRINT`.
7. No caching of unique watermarked copies (or very short TTL, e.g., 5 minutes, keyed by `userId:documentId`).

---

## 5. Data Model (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  emailVerified Boolean  @default(false)
  image         String?
  role          UserRole @default(member)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  uploadedDocuments Document[] @relation("UploadedBy")
  caseMemberships   CaseMember[]
  auditLogs         AuditLog[]
}

enum UserRole {
  admin
  member
}

model Case {
  id          String     @id @default(uuid())
  title       String
  caseNumber  String?
  description String?
  status      CaseStatus @default(open)
  createdById String
  createdBy   User       @relation(fields: [createdById], references: [id])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  members   CaseMember[]
  documents Document[]
  auditLogs AuditLog[]
}

enum CaseStatus {
  open
  closed
  archived
}

model CaseMember {
  id     String         @id @default(uuid())
  caseId String
  case   Case           @relation(fields: [caseId], references: [id])
  userId String
  user   User           @relation(fields: [userId], references: [id])
  role   CaseMemberRole @default(viewer)
  createdAt DateTime    @default(now())

  @@unique([caseId, userId])
}

enum CaseMemberRole {
  viewer
  uploader
}

model Document {
  id                String   @id @default(uuid())
  caseId            String
  case              Case     @relation(fields: [caseId], references: [id])
  controlNumber     String   @unique
  originalFilename  String
  storedOriginalKey String
  storedViewerKey   String
  fileSizeBytes     BigInt?
  mimeType          String?
  encryptionKey     String
  uploadedById      String
  uploadedBy        User     @relation("UploadedBy", fields: [uploadedById], references: [id])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  auditLogs AuditLog[]
}

model AuditLog {
  id         String      @id @default(uuid())
  action     AuditAction
  userId     String
  user       User        @relation(fields: [userId], references: [id])
  documentId String?
  document   Document?   @relation(fields: [documentId], references: [id])
  caseId     String?
  case       Case?       @relation(fields: [caseId], references: [id])
  ipAddress  String?
  userAgent  String?
  timestamp  DateTime    @default(now())
  metadata   Json?
}

enum AuditAction {
  UPLOAD
  VIEW
  DOWNLOAD
  PRINT
  DELETE
  SHARE
  LOGIN
  LOGOUT
}
```

---

## 6. API / Server Design

### 6.1 Server Actions (Mutations)

- `createCase(formData)` — Admin only
- `updateCase(id, formData)` — Admin only
- `addCaseMember(caseId, userId, role)` — Admin or case creator
- `removeCaseMember(caseId, userId)` — Admin or case creator
- `uploadDocument(caseId, file)` — Member with `uploader` role on case, or Admin
- `deleteDocument(documentId)` — Admin or original uploader (configurable)
- `createUser(email, name, role)` — Admin only
- `toggleUserActive(userId)` — Admin only

### 6.2 API Routes (Queries / Streaming)

- `GET /api/cases` — list cases (scoped by membership)
- `GET /api/cases/[caseId]` — case detail + documents
- `GET /api/cases/[caseId]/documents` — document list for case
- `GET /api/documents/[documentId]/viewer` — stream viewer copy (Redis cache)
- `GET /api/documents/[documentId]/download` — generate and stream unique watermarked PDF
- `GET /api/audit-logs` — Admin only, paginated + filterable

### 6.3 Permission Model

| Action | Admin | Case Member (viewer) | Case Member (uploader) |
|---|---|---|---|
| View all cases | Yes | No (assigned only) | No (assigned only) |
| Upload to case | Yes | No | Yes |
| Download from case | Yes | Yes | Yes |
| Print from case | Yes | Yes | Yes |
| Manage case members | Yes | No | No |
| Manage users | Yes | No | No |
| View audit logs | Yes | No | No |
| Delete document | Yes | Own uploads | Own uploads |

---

## 7. UI Structure (App Router)

| Route | Description |
|---|---|
| `/` | Landing or redirect to `/cases` |
| `/login` | BetterAuth login |
| `/cases` | Case list (Admin: all; Member: assigned) |
| `/cases/[caseId]` | Case detail, document list, upload button |
| `/cases/[caseId]/documents/[documentId]` | Document viewer + download button |
| `/admin/users` | Admin: user management |
| `/admin/audit-logs` | Admin: audit log viewer |
| `/profile` | User profile |

**Key Components:**
- `CaseCard` — summary card
- `DocumentList` — table with actions
- `DocumentViewer` — `react-pdf` or iframe viewer
- `UploadDropzone` — drag-and-drop upload
- `AuditLogTable` — sortable/filterable logs
- `UserManager` — create/edit/disable users
- `CaseMemberManager` — assign members and roles

**Layout:** Sidebar navigation with collapsible sections, breadcrumbs on detail pages.

---

## 8. Security & Error Handling

### 8.1 Security

- **Encryption at rest:** AES-256-GCM per file. The per-file key is stored in the DB, encrypted by `MASTER_ENCRYPTION_KEY` (env var). S3 compromise alone does not expose documents.
- **Separate keys:** `storedOriginalKey` and `storedViewerKey` are distinct S3 objects. Viewer key exposure does not reveal the original.
- **No direct S3 URLs:** All file access routes through Next.js API routes.
- **Rate limiting:** Redis-backed rate limit on downloads per user (e.g., 30/hour).
- **Fail-safe:** If decryption fails, no file is served. Log critical alert.
- **BetterAuth defaults:** Secure session cookies, bcrypt hashing.

### 8.2 Error Handling

- **Upload failure:** Retry LibreOffice conversion once. If it fails again, return clear error. Do not store orphaned files.
- **Permission denied:** Return `403` with generic message. Do not leak existence of unauthorized resources.
- **Audit log write failure:** Fire-and-forget async. Do NOT block user action if audit log DB write fails. Fallback to stderr logging.
- **Cache miss:** Gracefully fall back to S3 fetch.

---

## 9. Testing Strategy

### 9.1 Unit Tests (Vitest)

- Encryption/decryption round-trip helpers
- Key derivation logic
- Watermark generation (correct control number placement)
- Permission helper functions (`canViewCase`, `canUploadToCase`, etc.)

### 9.2 Integration Tests (Vitest + Prisma + testcontainers)

- Upload Server Action: file converts, encrypts, stores, writes Prisma record
- Viewer API route: fetches viewer copy, decrypts, streams
- Download API route: fetches original, decrypts, applies unique watermark, streams
- Audit logging: action triggers correct `AuditLog` entry
- Permission boundaries: unauthenticated/unauthorized requests rejected

### 9.3 Not in V1

- End-to-end tests (Playwright) — deferred to reduce scope.

---

## 10. Environment Variables

```
# Database
DATABASE_URL=postgresql://user:pass@db:5432/sbmalegal

# BetterAuth
BETTER_AUTH_SECRET=<random_32_byte_hex>
BETTER_AUTH_URL=http://localhost:3000

# S3 / MinIO
S3_ENDPOINT=http://storage:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=sbma-legal
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# Redis
REDIS_URL=redis://cache:6379

# Encryption
MASTER_ENCRYPTION_KEY=<32_byte_base64>

# App
PORT=3000
NODE_ENV=development
```

---

## 11. Open Questions / Future Work

- **Master key rotation:** Requires re-encrypting all `Document.encryptionKey` values. Not in V1.
- **2FA for admin accounts:** Recommended for production, add via BetterAuth plugins in v2.
- **Full-text search:** PostgreSQL `pg_trgm` or dedicated search index in v2.
- **Document versioning:** Track multiple versions of the same logical document.
- **Email notifications:** Notify case members on new uploads.

---

## 12. Approval

| Section | Status |
|---|---|
| Architecture & Data Flow | Approved |
| Data Model (Prisma) | Approved |
| Components & UI Structure | Approved |
| Error Handling & Security | Approved |
| Testing Strategy | Approved |
