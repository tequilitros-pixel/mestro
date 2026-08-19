import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import type { CashEvidenceType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { getCashCutScope, withCashCutScope } from "@/lib/cash-cuts/access";
import { randomUUID } from "crypto";
import { validateUploadedFile } from "@/lib/uploads";

const VALID_TYPES: CashEvidenceType[] = [
  "DINERO_CONTADO",
  "SOBRE",
  "TICKET",
  "NOTA",
  "FACTURA",
  "OTRO",
];

async function checkAccessToCut(userId: string, role: string, cashCutId: string) {
  /*
   * El alcance se resuelve desde la sesion, no desde los parametros.
   * Los argumentos solo se usan para comprobar que coinciden con la
   * sesion real; si no, se rechaza.
   */
  const scope = await getCashCutScope();
  if (!scope || scope.user.id !== userId || scope.user.role !== role) {
    return { ok: false, status: 401 as const, error: "No autorizado", cashCut: null };
  }

  const cashCut = await prisma.cashCut.findFirst({
    where: withCashCutScope(scope, { id: cashCutId }),
    select: { branchId: true },
  });

  if (!cashCut) {
    return { ok: false, status: 404 as const, error: "Corte no encontrado" };
  }


  return { ok: true as const };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const access = await checkAccessToCut(user.id, user.role, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const evidences = await prisma.cashCutEvidence.findMany({
    where: { cashCutId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(evidences.map((evidence) => ({
    ...evidence,
    url: evidence.url.startsWith("http")
      ? evidence.url
      : `/api/cash-cuts/${id}/evidencias/${evidence.id}/file?name=${encodeURIComponent(evidence.url)}`,
  })));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const access = await checkAccessToCut(user.id, user.role, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const type = formData.get("type");
  const notes = formData.get("notes");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }

  const validated = await validateUploadedFile(file, {
    maxBytes: 10 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  });
  if (!validated) {
    return NextResponse.json(
      { error: "Usa una imagen JPG, PNG, WebP o PDF válido de máximo 10 MB." },
      { status: 400 },
    );
  }

  if (typeof type !== "string" || !VALID_TYPES.includes(type as CashEvidenceType)) {
    return NextResponse.json({ error: "Tipo de evidencia inválido" }, { status: 400 });
  }

  const blob = await put(
    `cash-cuts/${id}/${randomUUID()}.${validated.extension}`,
    validated.bytes,
    { access: "private", contentType: validated.contentType }
  );

  const evidence = await prisma.cashCutEvidence.create({
    data: {
      cashCutId: id,
      type: type as CashEvidenceType,
      url: blob.pathname,
      notes: typeof notes === "string" && notes ? notes : undefined,
    },
  });

  return NextResponse.json({
    ...evidence,
    url: `/api/cash-cuts/${id}/evidencias/${evidence.id}/file?name=${encodeURIComponent(evidence.url)}`,
  });
}
