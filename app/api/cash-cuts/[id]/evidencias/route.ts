import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import type { CashEvidenceType } from "@prisma/client";

const VALID_TYPES: CashEvidenceType[] = [
  "DINERO_CONTADO",
  "SOBRE",
  "TICKET",
  "NOTA",
  "FACTURA",
  "OTRO",
];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const evidences = await prisma.cashCutEvidence.findMany({
    where: { cashCutId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(evidences);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    `cash-cuts/${params.id}/${Date.now()}-${file.name}`,
    file,
    { access: "public" }
  );

  const evidence = await prisma.cashCutEvidence.create({
    data: {
      cashCutId: params.id,
      type: type as CashEvidenceType,
      url: blob.url,
      notes: typeof notes === "string" && notes ? notes : undefined,
    },
  });

  return NextResponse.json(evidence);
}
