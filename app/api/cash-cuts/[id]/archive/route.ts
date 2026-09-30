import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.cashCut.findUnique({
      where: { id },
      select: { status: true, archivedAt: true },
    });
    if (!existing) return NextResponse.json({ error: "Corte no encontrado" }, { status: 404 });
    if (existing.archivedAt) return NextResponse.json({ archived: true });
    if (existing.status === "ABIERTO") {
      return NextResponse.json({ error: "Cierra el corte antes de archivarlo" }, { status: 409 });
    }

    const updated = await tx.cashCut.updateMany({
      where: { id, archivedAt: null, status: { in: ["CERRADO", "AUDITADO"] } },
      data: { archivedAt: new Date(), archivedById: user.id, updatedById: user.id },
    });
    if (updated.count === 1) {
      await tx.cashCutAuditEntry.create({
        data: { cashCutId: id, action: "ARCHIVADO", userId: user.id },
      });
    }
    return NextResponse.json({ archived: true });
  });
}
