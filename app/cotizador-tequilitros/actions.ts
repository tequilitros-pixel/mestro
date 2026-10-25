"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  DRINKS_CATALOG,
  EVENT_TYPES,
  type TequilitrosQuoteMetadata,
  type DayAvailability,
  type EmployeeLeaderboardItem,
  MAX_CONFIRMED_EVENTS_PER_DAY,
  VIATICOS_OPTIONS,
} from "@/lib/tequilitros/quote-types";

const EVENT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getEventDate(dateStr: string): Date | null {
  if (!EVENT_DATE_PATTERN.test(dateStr)) return null;

  const eventDate = new Date(`${dateStr}T12:00:00.000Z`);
  return Number.isNaN(eventDate.getTime()) ? null : eventDate;
}

function getUtcDayBounds(eventDate: Date) {
  const start = new Date(eventDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(eventDate);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function parseQuoteMetadata(notes: string | null): TequilitrosQuoteMetadata | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && parsed.type === "TEQUILITROS_QUOTE") {
      return parsed as TequilitrosQuoteMetadata;
    }
    return null;
  } catch {
    return null;
  }
}

export type QuoteCreationInput = {
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  eventType: string;
  dateStr: string; // YYYY-MM-DD
  location: string;
  guestCount: number;
  durationHours: number;
  modality: "libre" | "consumo" | "personalizado";
  selectedDrinks: string[];
  viaticosId: string;
  viaticosZone: string;
  viaticosCost: number;
  specialNotes?: string;
  branchName?: string;
};

export async function createQuoteAction(input: QuoteCreationInput) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Debes iniciar sesión para crear cotizaciones." };
    }

    if (!input.clientName.trim()) {
      return { success: false, error: "El nombre del cliente es obligatorio." };
    }

    const eventDate = getEventDate(input.dateStr);
    if (!eventDate) {
      return { success: false, error: "Selecciona una fecha de evento válida." };
    }

    if (!Number.isInteger(input.guestCount) || input.guestCount < 1 || input.guestCount > 1000) {
      return { success: false, error: "Ingresa una cantidad válida de personas." };
    }

    if (!Number.isInteger(input.durationHours) || input.durationHours < 4 || input.durationHours > 10) {
      return { success: false, error: "El servicio debe tener entre 4 y 10 horas." };
    }

    if (input.modality !== "libre" && input.modality !== "consumo") {
      return { success: false, error: "Selecciona una modalidad de servicio válida." };
    }

    const viaticos = VIATICOS_OPTIONS.find((option) => option.id === input.viaticosId);
    if (!viaticos) {
      return { success: false, error: "Selecciona una zona de viáticos válida." };
    }

    const selectedDrinks = input.selectedDrinks.filter((drink): drink is (typeof DRINKS_CATALOG)[number] =>
      DRINKS_CATALOG.includes(drink as (typeof DRINKS_CATALOG)[number]),
    );

    // Calcular importes de la cotización
    let pricePerGuest = 90;
    let extraHours = Math.max(0, input.durationHours - 4);
    let extraHoursCost = 0;
    let totalAmount = 0;

    if (input.modality === "libre") {
      pricePerGuest = 90;
      extraHoursCost = extraHours * (input.guestCount * 20);
      totalAmount = input.guestCount * pricePerGuest + extraHoursCost + viaticos.cost;
    } else if (input.modality === "consumo") {
      const atencion = input.durationHours * 250;
      const consumoEstimado = Math.round(input.guestCount * 78.5);
      totalAmount = atencion + consumoEstimado + viaticos.cost;
      pricePerGuest = Math.round(totalAmount / input.guestCount);
    } else {
      totalAmount = input.guestCount * 90 + viaticos.cost;
    }

    const depositRequired = Math.round(totalAmount * 0.5);
    const balanceRemaining = totalAmount - depositRequired;

    const { start, end } = getUtcDayBounds(eventDate);
    const result = await prisma.$transaction(
      async (tx) => {
        const sameDayEvents = await tx.serviceEvent.findMany({
          where: { eventDate: { gte: start, lte: end }, status: { not: "CANCELLED" } },
          select: { notes: true, status: true },
        });
        const confirmedCount = sameDayEvents.filter((event) => {
          const metadata = parseQuoteMetadata(event.notes);
          return Boolean(metadata && (metadata.isContractConfirmed || event.status !== "DRAFT"));
        }).length;

        if (confirmedCount >= MAX_CONFIRMED_EVENTS_PER_DAY) {
          throw new Error("La fecha ya alcanzó el máximo de 3 eventos confirmados.");
        }

        const countTotal = await tx.serviceEvent.count();
        const folioNumber = String(countTotal + 1).padStart(4, "0");
        const code = `COT-${new Date().getFullYear()}-${folioNumber}`;
        const metadata: TequilitrosQuoteMetadata = {
          version: 1,
          type: "TEQUILITROS_QUOTE",
          folio: code,
          clientEmail: input.clientEmail?.trim() || undefined,
          eventType: EVENT_TYPES.includes(input.eventType as (typeof EVENT_TYPES)[number]) ? input.eventType : "Boda",
          modality: input.modality,
          durationHours: input.durationHours,
          extraHours,
          extraHoursCost,
          pricePerGuest,
          viaticosId: viaticos.id,
          viaticosZone: viaticos.label,
          viaticosCost: viaticos.cost,
          selectedDrinks,
          depositRequired,
          balanceRemaining,
          specialNotes: input.specialNotes?.trim() || undefined,
          createdById: user.id,
          creatorName: user.name,
          branchName: input.branchName?.trim() || "Sucursal",
          isContractConfirmed: false,
        };

        const newEvent = await tx.serviceEvent.create({
          data: {
            code,
            clientName: input.clientName.trim(),
            clientPhone: input.clientPhone?.trim() || null,
            location: input.location.trim() || viaticos.label,
            eventDate,
            guestCount: input.guestCount,
            saleAmount: totalAmount,
            status: "DRAFT",
            notes: JSON.stringify(metadata),
          },
        });

        return { newEvent, metadata };
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/cotizador-tequilitros");
    revalidatePath("/cotizador-tequilitros/calendario");
    revalidatePath("/cotizador-tequilitros/historial");
    revalidatePath("/administration/inventory/eventos");

    return {
      success: true,
      id: result.newEvent.id,
      code: result.newEvent.code,
      metadata: result.metadata,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido al crear la cotización.";
    return { success: false, error: message };
  }
}

export async function registerDepositAction(input: {
  eventId: string;
  depositPaid: number;
  depositMethod: string;
  contractNotes?: string;
  branchName?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Debes iniciar sesión para registrar el anticipo." };
    }

    const event = await prisma.serviceEvent.findUnique({
      where: { id: input.eventId },
    });

    if (!event) {
      return { success: false, error: "Cotización no encontrada." };
    }

    const depositPaid = Math.round(Number(input.depositPaid) * 100) / 100;
    const saleAmount = Number(event.saleAmount ?? 0);
    if (!Number.isFinite(depositPaid) || depositPaid <= 0 || depositPaid > saleAmount) {
      return { success: false, error: "Ingresa un anticipo válido que no exceda el total del servicio." };
    }

    const currentMeta = parseQuoteMetadata(event.notes) || ({
      version: 1,
      type: "TEQUILITROS_QUOTE",
      folio: event.code,
      eventType: "Evento",
      modality: "libre",
      durationHours: 4,
      extraHours: 0,
      extraHoursCost: 0,
      pricePerGuest: 90,
      viaticosId: "colotlan",
      viaticosZone: "Colotlán",
      viaticosCost: 0,
      selectedDrinks: ["Cantarito", "Paloma", "Vampiro"],
      depositRequired: Math.round(Number(event.saleAmount ?? 0) * 0.5),
      balanceRemaining: Math.round(Number(event.saleAmount ?? 0) * 0.5),
      createdById: user.id,
      creatorName: user.name,
    } as TequilitrosQuoteMetadata);

    const dateStr = event.eventDate.toISOString().slice(0, 10).replace(/-/g, "");
    const contractFolio = `CTR-${dateStr}-${event.code.replace(/[^0-9]/g, "").slice(-4) || "0001"}`;

    const { start, end } = getUtcDayBounds(event.eventDate);
    const metadata = await prisma.$transaction(
      async (tx) => {
        const sameDayEvents = await tx.serviceEvent.findMany({
          where: {
            id: { not: event.id },
            eventDate: { gte: start, lte: end },
            status: { not: "CANCELLED" },
          },
          select: { notes: true, status: true },
        });
        const confirmedCount = sameDayEvents.filter((otherEvent) => {
          const otherMeta = parseQuoteMetadata(otherEvent.notes);
          return Boolean(otherMeta && (otherMeta.isContractConfirmed || otherEvent.status !== "DRAFT"));
        }).length;

        if (confirmedCount >= MAX_CONFIRMED_EVENTS_PER_DAY) {
          throw new Error("La fecha ya alcanzó el máximo de 3 eventos confirmados.");
        }

        const updatedMeta: TequilitrosQuoteMetadata = {
          ...currentMeta,
          isContractConfirmed: true,
          contractFolio,
          depositPaid,
          depositMethod: input.depositMethod?.trim() || "Efectivo en Sucursal",
          depositPaidAt: new Date().toISOString(),
          depositReceivedById: user.id,
          depositReceivedByName: user.name,
          depositBranchName: input.branchName?.trim() || currentMeta.branchName || "Sucursal",
          contractNotes: input.contractNotes?.trim() || undefined,
        };

        await tx.serviceEvent.update({
          where: { id: event.id },
          data: {
            status: "PREPARING",
            notes: JSON.stringify(updatedMeta),
          },
        });

        return updatedMeta;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/cotizador-tequilitros");
    revalidatePath("/cotizador-tequilitros/calendario");
    revalidatePath("/cotizador-tequilitros/historial");
    revalidatePath("/cotizador-tequilitros/contratos");

    return {
      success: true,
      contractFolio,
      metadata,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar anticipo.";
    return { success: false, error: message };
  }
}

export async function getQuotesListAction() {
  const user = await getCurrentUser();
  if (!user) return [];

  const events = await prisma.serviceEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return events.flatMap((event) => {
    const meta = parseQuoteMetadata(event.notes);
    if (!meta) return [];

    return [{
      id: event.id,
      code: event.code,
      clientName: event.clientName,
      clientPhone: event.clientPhone,
      location: event.location,
      eventDate: event.eventDate.toISOString(),
      guestCount: event.guestCount,
      saleAmount: Number(event.saleAmount ?? 0),
      status: event.status,
      createdAt: event.createdAt.toISOString(),
      metadata: meta,
      isConfirmed: Boolean(meta?.isContractConfirmed || (event.status !== "DRAFT" && event.status !== "CANCELLED")),
    }];
  });
}

export async function getCalendarMonthAction(year: number, month: number) {
  const user = await getCurrentUser();
  if (!user || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const events = await prisma.serviceEvent.findMany({
    where: {
      eventDate: {
        gte: start,
        lte: end,
      },
      status: { not: "CANCELLED" },
    },
    orderBy: { eventDate: "asc" },
  });

  const mapByDay = new Map<string, DayAvailability>();

  // Días del mes
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dayPadded = String(d).padStart(2, "0");
    const monthPadded = String(month).padStart(2, "0");
    const dateStr = `${year}-${monthPadded}-${dayPadded}`;
    mapByDay.set(dateStr, {
      dateStr,
      confirmedCount: 0,
      pendingCount: 0,
      status: "GREEN",
      events: [],
    });
  }

  for (const ev of events) {
    const dateStr = ev.eventDate.toISOString().slice(0, 10);
    const dayItem = mapByDay.get(dateStr);
    if (!dayItem) continue;

    const meta = parseQuoteMetadata(ev.notes);
    if (!meta) continue;
    const isConfirmed = Boolean(meta?.isContractConfirmed || ev.status !== "DRAFT");

    if (isConfirmed) {
      dayItem.confirmedCount += 1;
    } else {
      dayItem.pendingCount += 1;
    }

    dayItem.events.push({
      id: ev.id,
      code: ev.code,
      clientName: ev.clientName,
      guestCount: ev.guestCount,
      status: ev.status,
      creatorName: meta?.creatorName || "Sucursal",
      isConfirmed,
    });
  }

  // Asignar semáforos: RED si confirmed >= MAX (3), YELLOW si pending > 0 y confirmed < MAX, sino GREEN
  for (const day of mapByDay.values()) {
    if (day.confirmedCount >= MAX_CONFIRMED_EVENTS_PER_DAY) {
      day.status = "RED";
    } else if (day.pendingCount > 0) {
      day.status = "YELLOW";
    } else {
      day.status = "GREEN";
    }
  }

  return Array.from(mapByDay.values());
}

export async function getEmployeeMetricsAction(): Promise<EmployeeLeaderboardItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const events = await prisma.serviceEvent.findMany({
    where: { status: { not: "CANCELLED" } },
    select: {
      id: true,
      saleAmount: true,
      status: true,
      notes: true,
      createdAt: true,
    },
  });

  const workerMap = new Map<string, EmployeeLeaderboardItem>();

  for (const ev of events) {
    const meta = parseQuoteMetadata(ev.notes);
    if (!meta || !meta.createdById) continue;

    const key = meta.createdById;
    const existing = workerMap.get(key) ?? {
      userId: key,
      userName: meta.creatorName || "Empleado",
      quotesCount: 0,
      confirmedContractsCount: 0,
      totalQuotedAmount: 0,
      totalConfirmedAmount: 0,
    };

    const amount = Number(ev.saleAmount ?? 0);
    existing.quotesCount += 1;
    existing.totalQuotedAmount += amount;

    if (meta.isContractConfirmed || ev.status !== "DRAFT") {
      existing.confirmedContractsCount += 1;
      existing.totalConfirmedAmount += amount;
    }

    workerMap.set(key, existing);
  }

  return Array.from(workerMap.values()).sort(
    (a, b) => b.quotesCount - a.quotesCount || b.totalQuotedAmount - a.totalQuotedAmount
  );
}
