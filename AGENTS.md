# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier (writes in place)
npm run typecheck    # tsc --noEmit

# Testing
npm test             # Run all Vitest tests
npm test -- crypto   # Run a single test file by name pattern

# Database
npm run db:push      # Push schema changes without a migration (dev)
npm run db:reset     # Drop and re-apply all migrations + seed
npm run db:seed      # Seed only (creates admin@sbma.legal via auth.api.createUser)
npm run db:studio    # Open Prisma Studio
```

## Environment Variables

All vars are validated at build time via `@t3-oss/env-nextjs` in [env.ts](env.ts). Required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Auth server config |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | S3-compatible storage (MinIO locally) |
| `REDIS_URL` | Redis connection (ioredis) |
| `MASTER_ENCRYPTION_KEY` | Base64-encoded 32-byte key for envelope encryption |

Run `docker compose up -d` to start PostgreSQL, MinIO, and Redis locally. The `app` container also includes LibreOffice headless for file conversion.

## Architecture

### Tech Stack
- **Next.js 16** App Router, React 19, TypeScript 6
- **Prisma 7** with PostgreSQL — client generated to `generated/prisma/` (configured via `prisma.config.ts`)
- **better-auth** with email/password and admin plugin
- **TanStack Query v5** for client-side server state; **TanStack Form** for forms
- **shadcn/ui** (Base UI primitives) + Tailwind CSS 4; **@remixicon/react** for icons

### Route Groups
```
app/
  (auth)/           # Unauthenticated shell — login
  (app)/            # Authenticated shell with sidebar
    admin/          # Admin-only (users, audit logs)
    cases/          # Case list + case detail ([caseId]/)
  api/              # REST API routes
```

### Data Flow Pattern
The app uses a hybrid mutation/query split per feature:

1. **Server Actions** (`_actions.ts` co-located with route segments) handle all mutations. They call `requireAdmin()` / `requireAuth()` at the top, validate with Zod schemas from `lib/schemas.ts`, then call Prisma directly.
2. **API routes** (`app/api/`) handle GET queries consumed by TanStack Query hooks in `hooks/`.
3. **Custom hooks** (`hooks/`) wrap both, and implement **optimistic updates** with rollback via `onMutate`/`onError`/`onSettled`.

### Auth & Authorization
- `lib/auth-guards.ts` — `requireAuth()` and `requireAdmin()` are called at the top of Server Components/layouts and redirect on failure.
- `lib/permissions.ts` — Pure functions (`canViewCase`, `canUploadToCase`, `canDownloadDocument`, `canManageCase`, `canManageUsers`) encode the two-tier role system.
- Two-tier roles: `UserRole` (admin/member system-wide, from `lib/constants.ts`) and `MembershipRole` (viewer/uploader per-case).
- `lib/auth-client.ts` — Client-side better-auth instance for `"use client"` components.

### Parallel Routes & Modals
Case detail and admin pages use Next.js parallel routes (`@modal` slot) with intercepting routes (`(.)route`) to render modals without leaving the current page. Each feature directory includes `@modal/default.tsx` returning `null`.

### Document Pipeline (partially implemented)

**Upload flow** (planned in `app/(app)/cases/[caseId]/upload/_actions.ts`):
1. Convert non-PDF files to PDF via LibreOffice headless (`lib/convert.ts` — `soffice --headless --convert-to pdf`).
2. Generate a UUID control number and a per-file AES-256-GCM key.
3. Encrypt original PDF → store at `documents/{caseId}/{controlNumber}/original.enc` in S3.
4. Add control-number-only watermark via `lib/watermark.ts` (pdf-lib) → encrypt → store at `documents/{caseId}/{controlNumber}/viewer.enc` in S3.
5. Cache viewer copy in Redis: `viewer:{controlNumber}` (TTL 1 hour).
6. Write `Document` record to DB with `encryptionKey` (master-encrypted), `storedOriginalKey`, `storedViewerKey`.
7. Write `UPLOAD` audit log.

**Viewer API** (planned at `app/api/documents/[documentId]/viewer/route.ts`):
- Checks `canViewCase`; fetches viewer copy from Redis (`viewer:{controlNumber}`) or S3 on miss; decrypts; streams as `application/pdf inline`. Writes `VIEW` audit log.

**Download API** (planned at `app/api/documents/[documentId]/download/route.ts`):
- Checks `canDownloadDocument`; rate-limits via Redis (`download:{userId}:{documentId}`, 30/hr); fetches original from S3; decrypts; burns unique forensic watermark (`controlNumber | user name | email | IP | timestamp`) via pdf-lib; streams as `attachment`. Writes `DOWNLOAD` audit log.

### Document Encryption
`lib/crypto.ts` implements envelope encryption: `generateFileKey()` → `encryptFile(buffer, key)` / `decryptFile(encrypted, key)` use AES-256-GCM with a random IV prepended as `[iv(16) | authTag(16) | ciphertext]`. `encryptKey(fileKey)` / `decryptKey(encryptedKey)` wrap the per-file key with `MASTER_ENCRYPTION_KEY`.

### Prisma Client Import
Import Prisma types/enums from `@/generated/prisma/client`. Import the singleton client from `@/lib/prisma`. Do **not** import from `@prisma/client`.

### Query Keys
All TanStack Query cache keys are centralized in `lib/query-keys.ts`. Add new keys there when creating new queries.

### Audit Logging
`lib/audit.ts` — `logAudit(opts)` is fire-and-forget: it does not throw or block the caller on failure. Always call it after any action that should be tracked (`UPLOAD`, `VIEW`, `DOWNLOAD`, `PRINT`, `LOGIN`, `LOGOUT`).
