import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CaseCardProps {
  id: string;
  title: string;
  caseNumber?: string | null;
  status: string;
  documentCount: number;
}

export function CaseCard({
  id,
  title,
  caseNumber,
  status,
  documentCount,
}: CaseCardProps) {
  return (
    <Link href={`/cases/${id}`}>
      <Card className="hover:bg-accent">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {caseNumber && (
            <p className="text-sm text-muted-foreground">{caseNumber}</p>
          )}
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={status === "open" ? "default" : "secondary"}>
            {status}
          </Badge>
          <span>&middot;</span>
          <span>{documentCount} documents</span>
        </CardContent>
      </Card>
    </Link>
  );
}
