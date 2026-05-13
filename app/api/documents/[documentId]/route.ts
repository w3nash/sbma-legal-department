import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guards";
import { MembershipRole, UserRole } from "@/lib/constants";
import { serializeDocumentDetail } from "@/lib/document-detail";
import { canDownloadDocument, canViewCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const session = await requireAuth();
  const user = session.user;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      caseId: true,
      controlNumber: true,
      downloadCount: true,
      originalFilename: true,
      fileSizeBytes: true,
      mimeType: true,
      processingError: true,
      status: true,
      storedOriginalKey: true,
      createdAt: true,
      case: {
        select: {
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json(
      { message: "Document not found" },
      { status: 404 }
    );
  }

  const membership =
    document.case.members.find((member) => member.userId === user.id) ?? null;
  const memberRole = membership
    ? { role: membership.role as MembershipRole }
    : null;
  const userRole = { role: user.role as UserRole };

  if (!canViewCase(userRole, memberRole)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json(
    serializeDocumentDetail(document, canDownloadDocument(userRole, memberRole))
  );
}
