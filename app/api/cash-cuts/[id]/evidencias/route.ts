import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import type { CashEvidenceType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

const VALID_TYPES: CashEvidenceType[] = [
  "DINERO_CONTADO",
  "SOBRE",
  "TICKET",
  "NOTA",
  "FACTURA",
  "OTRO",
];

async function checkAccessToCut(userId: string, role: string, cashCutId: string) {
  const cashCut = await prisma.cashCut.findUnique({
    where: { id: cashCutId },
    select: { branchId: true },
  });

  if (!cashCut) {
    return { ok: false, status: 404 as const, error: "Corte no encontrado" };
  }

  if (role === "GERENTE" || role === "ENCARGADO") {
    const hasAccess = await prisma.userBranch.findFirst({
      where: { userId, branchId: cashCut.branchId },
    });
    if (!hasAccess) {
      return { ok: false, status: 403 as const, error: "No autorizado" };
    }
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

  return NextResponse.json(evidences);
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

  if (typeof type !== "string" || !VALID_TYPES.includes(type as CashEvidenceType)) {
    return NextResponse.json({ error: "Tipo de evidencia inválido" }, { status: 400 });
  }

  const blob = await put(
    `cash-cuts/${id}/${Date.now()}-${file.name}`,
    file,
    { access: "public" }
  );

  const evidence = await prisma.cashCutEvidence.create({
    data: {
      cashCutId: id,
      type: type as CashEvidenceType,
      url: blob.url,
      notes: typeof notes === "string" && notes ? notes : undefined,
    },
  });

  return NextResponse.json(evidence);
}
