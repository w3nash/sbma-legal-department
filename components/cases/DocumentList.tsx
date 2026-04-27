import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Document {
  id: string;
  controlNumber: string;
  originalFilename: string;
  createdAt: Date;
  fileSizeBytes: bigint | null;
}

export function DocumentList({
  documents,
  caseId,
}: {
  documents: Document[];
  caseId: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Control #</TableHead>
          <TableHead>Filename</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Size</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="font-mono text-xs">
              {doc.controlNumber}
            </TableCell>
            <TableCell>
              <Link
                href={`/cases/${caseId}/documents/${doc.id}`}
                className="hover:underline"
              >
                {doc.originalFilename}
              </Link>
            </TableCell>
            <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
            <TableCell>{formatBytes(Number(doc.fileSizeBytes ?? 0))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
