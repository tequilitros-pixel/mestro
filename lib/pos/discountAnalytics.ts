import "server-only";

import type { DiscountAnalytics, DiscountRanking } from "@/components/pos/DiscountAnalyticsDashboard";
import { withRlsContext, type RlsUser } from "@/lib/rls";

export type DiscountReportMode = "courtesies" | "employees" | "products";

type Event = {
  id: string;
  saleId: string;
  code: string;
  date: Date;
  giver: string;
  branch: string;
  subject: string;
  amount: number;
  reason: string;
};

const REASONS: Record<string, string> = {
  CLIENTE_FRECUENTE: "Cliente frecuente",
  PROMOCION: "Promoción",
  COMPENSACION: "Compensación",
  CONVENIO: "Convenio",
  AUTORIZACION_GERENTE: "Autorización de gerente",
  CUMPLEANOS: "Cumpleaños",
  EVENTO: "Evento",
  INVITADO: "Invitado",
  OTRO: "Otro",
};

function reasonLabel(code: string | null, note: string | null) {
  if (note?.trim()) return note.trim();
  return code ? (REASONS[code] ?? code) : "Sin motivo capturado";
}

function ranking(events: Event[], field: "giver" | "branch" | "subject"): DiscountRanking[] {
  const values = new Map<string, { amount: number; count: number }>();
  for (const event of events) {
    const key = event[field];
    const current = values.get(key) ?? { amount: 0, count: 0 };
    current.amount += event.amount;
    current.count += 1;
    values.set(key, current);
  }
  return Array.from(values, ([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
}

export async function getDiscountAnalytics({
  mode,
  from,
  branchIds,
  selectedBranchId,
  user,
}: {
  mode: DiscountReportMode;
  from: Date;
  branchIds: string[] | null;
  selectedBranchId: string;
  user: RlsUser;
}): Promise<DiscountAnalytics> {
  const accessibleIds = branchIds ?? undefined;
  const filteredIds = selectedBranchId
    ? accessibleIds
      ? accessibleIds.includes(selectedBranchId) ? [selectedBranchId] : []
      : [selectedBranchId]
    : accessibleIds;

  const kind = mode === "courtesies"
    ? "CORTESIA"
    : mode === "employees"
      ? "DESCUENTO_EMPLEADO"
      : "DESCUENTO_NORMAL";

  const sales = await withRlsContext(user, (tx) => tx.posSale.findMany({
    where: {
      status: "COMPLETADA",
      createdAt: { gte: from },
      ...(filteredIds ? { branchId: { in: filteredIds } } : {}),
      OR: [
        { items: { some: { discountKind: kind } } },
        ...(mode === "products" ? [{ discountKind: "DESCUENTO_NORMAL" as const }] : []),
      ],
    },
    select: {
      id: true,
      code: true,
      createdAt: true,
      discountAmount: true,
      discountKind: true,
      discountReason: true,
      discountReasonCode: true,
      branch: { select: { name: true } },
      soldBy: { select: { name: true } },
      items: {
        where: { discountKind: kind },
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: true,
          originalUnitPrice: true,
          benefitAmount: true,
          discountReason: true,
          discountReasonNote: true,
          beneficiaryEmployee: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  }));

  const events: Event[] = [];
  for (const sale of sales) {
    for (const item of sale.items) {
      const calculated = Math.max(0, ((item.originalUnitPrice ?? item.unitPrice) - item.unitPrice) * item.quantity);
      const amount = item.benefitAmount ?? calculated;
      events.push({
        id: item.id,
        saleId: sale.id,
        code: sale.code,
        date: sale.createdAt,
        giver: sale.soldBy.name,
        branch: sale.branch.name,
        subject: mode === "employees"
          ? (item.beneficiaryEmployee?.name ?? "Trabajador no identificado")
          : item.name,
        amount,
        reason: reasonLabel(item.discountReason, item.discountReasonNote),
      });
    }

    if (mode === "products" && sale.discountKind === "DESCUENTO_NORMAL" && sale.discountAmount > 0) {
      events.push({
        id: `${sale.id}:general`,
        saleId: sale.id,
        code: sale.code,
        date: sale.createdAt,
        giver: sale.soldBy.name,
        branch: sale.branch.name,
        subject: "Descuento general de venta",
        amount: sale.discountAmount,
        reason: reasonLabel(sale.discountReasonCode, sale.discountReason),
      });
    }
  }

  const amount = events.reduce((sum, event) => sum + event.amount, 0);
  const byGiver = ranking(events, "giver");
  const byBranch = ranking(events, "branch");

  return {
    amount,
    count: events.length,
    average: events.length ? amount / events.length : 0,
    topGiver: byGiver[0]?.name ?? "Sin datos",
    topBranch: byBranch[0]?.name ?? "Sin datos",
    byGiver,
    byBranch,
    bySubject: ranking(events, "subject"),
    recent: events.slice(0, 50).map((event) => ({
      ...event,
      date: event.date.toISOString(),
    })),
  };
}
