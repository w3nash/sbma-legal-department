import "dotenv/config";
import { runDocumentProcessingWorker } from "@/lib/document-processing";

console.log("Starting document processing worker runtime");

runDocumentProcessingWorker().catch((error) => {
  console.error("Document processing worker crashed:", error);
  process.exit(1);
});
