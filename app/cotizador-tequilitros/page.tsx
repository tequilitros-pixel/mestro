import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CotizadorForm from "./CotizadorForm";

export default async function CotizadorPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Obtener sucursales activas
  const branches = await prisma.branch.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Pre-cargar eventos de los próximos 90 días para el chequeo de disponibilidad en tiempo real
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureLimit = new Date();
  futureLimit.setDate(futureLimit.getDate() + 90);

  const events = await prisma.serviceEvent.findMany({
    where: {
      eventDate: {
        gte: today,
        lte: futureLimit,
      },
      status: { not: "CANCELLED" },
    },
    select: {
      eventDate: true,
      status: true,
      notes: true,
    },
  });

  const availabilityMap: Record<string, { confirmedCount: number; pendingCount: number }> = {};

  for (const ev of events) {
    let isConfirmed = ev.status !== "DRAFT";
    let isTequilitrosQuote = false;
    if (ev.notes) {
      try {
        const meta = JSON.parse(ev.notes);
        isTequilitrosQuote = meta?.type === "TEQUILITROS_QUOTE";
        if (meta?.isContractConfirmed) isConfirmed = true;
      } catch {
        // Ignore non-quote notes from the shared ServiceEvent table.
      }
    }
    if (!isTequilitrosQuote) continue;

    const dateStr = ev.eventDate.toISOString().slice(0, 10);
    if (!availabilityMap[dateStr]) {
      availabilityMap[dateStr] = { confirmedCount: 0, pendingCount: 0 };
    }

    if (isConfirmed) {
      availabilityMap[dateStr].confirmedCount += 1;
    } else {
      availabilityMap[dateStr].pendingCount += 1;
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <CotizadorForm
        currentUser={{
          id: user.id,
          name: user.name,
          role: user.role,
        }}
        branches={branches}
        initialAvailabilityMap={availabilityMap}
      />
    </div>
  );
}
