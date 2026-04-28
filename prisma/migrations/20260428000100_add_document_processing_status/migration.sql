CREATE TYPE "DocumentStatus" AS ENUM ('processing', 'ready', 'failed');

ALTER TABLE "document"
  ADD COLUMN "status" "DocumentStatus" NOT NULL DEFAULT 'ready',
  ADD COLUMN "storedSourceKey" TEXT,
  ADD COLUMN "processingError" TEXT;

ALTER TABLE "document"
  ALTER COLUMN "storedOriginalKey" DROP NOT NULL,
  ALTER COLUMN "storedViewerKey" DROP NOT NULL;

ALTER TABLE "document"
  ALTER COLUMN "status" SET DEFAULT 'processing';
