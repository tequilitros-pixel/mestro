import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const cuts = await prisma.cashCut.findMany({
    where: {
     status: "CERRADO", // solo cortes cerrados

      ...(branchId ? { branchId } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              gte: dateFrom ? new Date(dateFrom) : undefined,
              lte: dateTo ? new Date(dateTo) : undefined,
            },
          }
        : {}),
      envelopeAmount: { gt: 0 }, // ajusta al nombre real del campo
    },
    include: { branch: true, responsible: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(
    cuts.map((c) => ({
      id: c.id,
      branch: c.branch.name,
      date: c.date,
      envelopeAmount: c.envelopeAmount,
      envelopeNumber: c.envelopeNumber,
      envelopeNotes: c.envelopeNotes,
      responsible: c.responsible?.name,
    }))
  );
}
