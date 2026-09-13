import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Eventos elegibles para vincular a un nuevo corte de caja: aquellos
 * cuyo inventario aún no se ha descontado (stockDeductedAt null) y
 * que no están cancelados. Se listan del más próximo al más lejano.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const events = await prisma.serviceEvent.findMany({
      where: {
        stockDeductedAt: null,
        status: { notIn: ["CANCELLED"] },
      },
      select: {
        id: true,
        code: true,
        clientName: true,
        location: true,
        eventDate: true,
        guestCount: true,
        status: true,
        _count: { select: { items: true } },
      },
      orderBy: { eventDate: "asc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    // No bloqueamos "abrir corte" por esto: si la migración de
    // `stockDeductedAt` todavía no corrió en esta base de datos,
    // simplemente no se ofrece la opción de vincular un evento.
    console.error("Error listing eligible events for cash cut:", error);
    return NextResponse.json([]);
  }
}
