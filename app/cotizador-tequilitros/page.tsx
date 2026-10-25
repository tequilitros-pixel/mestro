import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CotizadorForm from "./CotizadorForm";

export default async function CotizadorPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Limpieza preventiva de cotizaciones borrador en ServiceEvent
  try {
    await prisma.serviceEvent.deleteMany({
      where: {
        code: { startsWith: "COT-" },
        status: "DRAFT",
      },
    }).catch(() => {});
  } catch {
    // Continuar
  }

  // Obtener sucursales activas
  const branches = await prisma.branch.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Pre-cargar eventos y cotizaciones de los próximos 90 días
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureLimit = new Date();
  futureLimit.setDate(futureLimit.getDate() + 90);

  // 1. Eventos confirmados en ServiceEvent
  const confirmedEvents = await prisma.serviceEvent.findMany({
    where: {
      eventDate: {
        gte: today,
        lte: futureLimit,
      },
      status: { notIn: ["CANCELLED", "DRAFT"] },
    },
    select: {
      eventDate: true,
    },
  });

  // 2. Cotizaciones tentativas en AuditEvent
  const quoteRecords = await prisma.auditEvent.findMany({
    where: { entityType: "TequilitrosQuote" },
    select: { metadata: true },
  });

  const availabilityMap: Record<string, { confirmedCount: number; pendingCount: number }> = {};

  for (const ev of confirmedEvents) {
    const dateStr = ev.eventDate.toISOString().slice(0, 10);
    if (!availabilityMap[dateStr]) {
      availabilityMap[dateStr] = { confirmedCount: 0, pendingCount: 0 };
    }
    availabilityMap[dateStr].confirmedCount += 1;
  }

  for (const rec of quoteRecords) {
    if (!rec.metadata || typeof rec.metadata !== "object") continue;
    const meta = rec.metadata as Record<string, unknown>;
    if (meta.isContractConfirmed || meta.status === "CONFIRMED") continue;
    if (typeof meta.eventDate !== "string") continue;

    const dateStr = meta.eventDate.slice(0, 10);
    if (!availabilityMap[dateStr]) {
      availabilityMap[dateStr] = { confirmedCount: 0, pendingCount: 0 };
    }
    availabilityMap[dateStr].pendingCount += 1;
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
