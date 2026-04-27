# SBMA Legal Affairs

Internal legal affairs document archive for managing case files with encrypted storage, access control, audit logging, and forensic watermarking.

## Overview

- **Case-centric** — documents are organized under cases, each with its own member roster
- **Encrypted at rest** — every file is AES-256-GCM encrypted; S3 compromise alone does not expose documents
- **Forensic watermarking** — viewer copies show only a control number; downloads burn a unique per-user watermark (name, email, IP, timestamp) into the PDF
- **Full audit trail** — every upload, view, download, login, and logout is logged

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL via Prisma 7 |
| Auth | better-auth (email/password) |
| Storage | MinIO (local) / AWS S3 (cloud) |
| Cache | Redis |
| PDF processing | pdf-lib, LibreOffice headless |
| Client state | TanStack Query v5 |
| UI | shadcn/ui + Tailwind CSS 4 |

## Getting Started

### Prerequisites

- Node.js 22+
- Docker & Docker Compose

### 1. Start the infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL, MinIO (S3-compatible storage), and Redis.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in `BETTER_AUTH_SECRET` and `MASTER_ENCRYPTION_KEY`. For local development the other values can stay as-is.

Generate a master encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Install dependencies and migrate

```bash
npm install
npm run db:reset   # applies migrations
npm run db:seed    # seeds admin@sbma.legal
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with `admin@sbma.legal` / `changeme123` (seed default).

## Scripts

```bash
npm run dev          # Dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript check
npm test             # Vitest unit tests
npm run db:push      # Push schema without a migration (dev only)
npm run db:reset     # Drop, re-migrate, and seed
npm run db:studio    # Prisma Studio GUI
```

## Roles

| Role | Scope | Capabilities |
|---|---|---|
| **Admin** | System-wide | All cases, all documents, user management, audit logs |
| **Member / Viewer** | Per-case | View and download documents in assigned cases |
| **Member / Uploader** | Per-case | View, download, and upload documents in assigned cases |

## Deployment

The app is designed for self-hosted Docker Compose deployment. The production `Dockerfile` bundles the Next.js server with LibreOffice for file conversion. See `docker-compose.yml` for the full service configuration.
