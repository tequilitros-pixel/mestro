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

function isTequilitrosEventMetadata(notes: string | null): boolean {
  if (!notes) return false;

  try {
    const metadata: unknown = JSON.parse(notes);
    return Boolean(
      metadata &&
        typeof metadata === "object" &&
        (metadata as Record<string, unknown>).type === "TEQUILITROS_QUOTE",
    );
  } catch {
    return false;
  }
}

interface StoredQuoteData extends TequilitrosQuoteMetadata {
  id: string;
  code: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  location: string;
  eventDate: string;
  guestCount: number;
  saleAmount: number;
  status: "DRAFT" | "CONFIRMED";
  createdAt: string;
}

function parseStoredQuote(metadata: unknown): StoredQuoteData | null {
  if (!metadata || typeof metadata !== "object") return null;
  const obj = metadata as Record<string, unknown>;
  if (obj.type !== "TEQUILITROS_QUOTE" || typeof obj.code !== "string") return null;
  return obj as unknown as StoredQuoteData;
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

    if (!input.clientPhone?.trim()) {
      return { success: false, error: "El teléfono o WhatsApp del cliente es obligatorio." };
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
    let extraHours = 0;
    let extraHoursCost = 0;
    let totalAmount = 0;
    let depositRequired = 0;
    let balanceRemaining = 0;

    if (input.modality === "libre") {
      pricePerGuest = 90;
      extraHours = Math.max(0, input.durationHours - 4);
      extraHoursCost = extraHours * (input.guestCount * 20);
      totalAmount = input.guestCount * pricePerGuest + extraHoursCost + viaticos.cost;
      depositRequired = Math.round(totalAmount * 0.5);
      balanceRemaining = totalAmount - depositRequired;
    } else if (input.modality === "consumo") {
      // Barra a Consumo: Solo se cobran las horas pactadas ($250/hr) + viáticos para congelar la fecha.
      // El producto consumido se cobra al finalizar el evento según la lista oficial.
      const atencion = input.durationHours * 250;
      totalAmount = atencion + viaticos.cost;
      depositRequired = totalAmount; // Se liquida el servicio pactado para congelar la fecha
      balanceRemaining = 0;
      pricePerGuest = 0;
    } else {
      totalAmount = input.guestCount * 90 + viaticos.cost;
      depositRequired = Math.round(totalAmount * 0.5);
      balanceRemaining = totalAmount - depositRequired;
    }

    const { start, end } = getUtcDayBounds(eventDate);
    const result = await prisma.$transaction(
      async (tx) => {
        // Validar límite de 3 eventos confirmados para este día
        const sameDayConfirmedEvents = await tx.serviceEvent.findMany({
          where: {
            eventDate: { gte: start, lte: end },
            status: { notIn: ["CANCELLED", "DRAFT"] },
          },
          select: { notes: true },
        });

        if (
          sameDayConfirmedEvents.filter((event) => isTequilitrosEventMetadata(event.notes)).length >=
          MAX_CONFIRMED_EVENTS_PER_DAY
        ) {
          throw new Error("La fecha ya alcanzó el máximo de 3 eventos confirmados.");
        }

        const countTotal = await tx.auditEvent.count({
          where: { entityType: "TequilitrosQuote" },
        });
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

        const storedQuote: StoredQuoteData = {
          ...metadata,
          id: code,
          code,
          clientName: input.clientName.trim(),
          clientPhone: input.clientPhone?.trim() || null,
          clientEmail: input.clientEmail?.trim() || null,
          location: input.location.trim() || viaticos.label,
          eventDate: eventDate.toISOString(),
          guestCount: input.guestCount,
          saleAmount: totalAmount,
          status: "DRAFT",
          createdAt: new Date().toISOString(),
        };

        // Se guarda en AuditEvent para NO contaminar el Inventario de Eventos con cotizaciones borrador
        await tx.auditEvent.create({
          data: {
            actorId: user.id,
            action: "TEQUILITROS_QUOTE_CREATED",
            entityType: "TequilitrosQuote",
            entityId: code,
            metadata: storedQuote as unknown as object,
          },
        });

        return { code, metadata };
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/cotizador-tequilitros");
    revalidatePath("/cotizador-tequilitros/calendario");
    revalidatePath("/cotizador-tequilitros/historial");

    return {
      success: true,
      id: result.code,
      code: result.code,
      metadata: result.metadata,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido al crear la cotización.";
    return { success: false, error: message };
  }
}

export async function registerDepositAction(input: {
  eventId: string; // Folio o id de la cotización
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

    // Buscar la cotización en AuditEvent
    const auditRecord = await prisma.auditEvent.findFirst({
      where: {
        entityType: "TequilitrosQuote",
        OR: [{ entityId: input.eventId }, { id: input.eventId }],
      },
      orderBy: { createdAt: "desc" },
    });

    if (!auditRecord) {
      return { success: false, error: "Cotización no encontrada." };
    }

    const currentQuote = parseStoredQuote(auditRecord.metadata);
    if (!currentQuote) {
      return { success: false, error: "Datos de cotización corruptos." };
    }

    const depositPaid = Math.round(Number(input.depositPaid) * 100) / 100;
    const saleAmount = Number(currentQuote.saleAmount ?? 0);
    if (!Number.isFinite(depositPaid) || depositPaid <= 0 || depositPaid > saleAmount) {
      return { success: false, error: "Ingresa un anticipo válido que no exceda el total del servicio." };
    }

    const eventDate = new Date(currentQuote.eventDate);
    const dateStr = eventDate.toISOString().slice(0, 10).replace(/-/g, "");
    const contractFolio = `CTR-${dateStr}-${currentQuote.code.replace(/[^0-9]/g, "").slice(-4) || "0001"}`;

    const { start, end } = getUtcDayBounds(eventDate);

    const result = await prisma.$transaction(
      async (tx) => {
        // Validar límite de 3 eventos confirmados para ese día
        const sameDayConfirmed = await tx.serviceEvent.findMany({
          where: {
            eventDate: { gte: start, lte: end },
            status: { notIn: ["CANCELLED", "DRAFT"] },
          },
          select: { notes: true },
        });

        if (
          sameDayConfirmed.filter((event) => isTequilitrosEventMetadata(event.notes)).length >=
          MAX_CONFIRMED_EVENTS_PER_DAY
        ) {
          throw new Error("Esta fecha ya cuenta con 3 eventos confirmados. No es posible confirmar otro evento.");
        }

        const updatedMetadata: StoredQuoteData = {
          ...currentQuote,
          isContractConfirmed: true,
          contractFolio,
          depositPaid,
          depositMethod: input.depositMethod || "Efectivo en Sucursal",
          depositPaidAt: new Date().toISOString(),
          depositReceivedById: user.id,
          depositReceivedByName: user.name,
          depositBranchName: input.branchName || user.name,
          contractNotes: input.contractNotes?.trim() || undefined,
          status: "CONFIRMED",
        };

        // 1. Actualizar el registro en AuditEvent
        await tx.auditEvent.update({
          where: { id: auditRecord.id },
          data: {
            action: "TEQUILITROS_QUOTE_CONFIRMED",
            metadata: updatedMetadata as unknown as object,
          },
        });

        // 2. AHORA Y SOLO AHORA QUE HAY ANTICIPO, CREAR EL EVENTO OFICIAL EN EL INVENTARIO DE EVENTOS
        const serviceEvent = await tx.serviceEvent.create({
          data: {
            code: contractFolio,
            clientName: currentQuote.clientName,
            clientPhone: currentQuote.clientPhone || null,
            location: currentQuote.location,
            eventDate,
            guestCount: currentQuote.guestCount,
            saleAmount,
            status: "PREPARING", // Oficialmente en preparación en el inventario
            notes: JSON.stringify(updatedMetadata),
          },
        });

        return { contractFolio, metadata: updatedMetadata, serviceEventId: serviceEvent.id };
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/cotizador-tequilitros");
    revalidatePath("/cotizador-tequilitros/calendario");
    revalidatePath("/cotizador-tequilitros/historial");
    revalidatePath("/cotizador-tequilitros/contratos");
    revalidatePath("/administration/inventory/eventos");
    revalidatePath("/administration/inventory/events");

    return {
      success: true,
      contractFolio: result.contractFolio,
      metadata: result.metadata,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar anticipo.";
    return { success: false, error: message };
  }
}

export async function getQuotesListAction() {
  const user = await getCurrentUser();
  if (!user) return [];

  // Leer todas las cotizaciones guardadas en AuditEvent
  const records = await prisma.auditEvent.findMany({
    where: { entityType: "TequilitrosQuote" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return records.flatMap((rec) => {
    const quote = parseStoredQuote(rec.metadata);
    if (!quote) return [];

    return [{
      id: quote.code || rec.id,
      code: quote.code,
      clientName: quote.clientName,
      clientPhone: quote.clientPhone,
      location: quote.location,
      eventDate: quote.eventDate,
      guestCount: quote.guestCount,
      saleAmount: Number(quote.saleAmount ?? 0),
      status: quote.status,
      createdAt: quote.createdAt || rec.createdAt.toISOString(),
      metadata: quote,
      isConfirmed: Boolean(quote.isContractConfirmed || quote.status === "CONFIRMED"),
    }];
  });
}

export async function getCalendarMonthAction(year: number, month: number) {
  const user = await getCurrentUser();
  if (!user || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  // 1. Eventos confirmados en ServiceEvent
  const confirmedEvents = await prisma.serviceEvent.findMany({
    where: {
      eventDate: { gte: start, lte: end },
    status: { notIn: ["CANCELLED", "DRAFT"] },
    },
    orderBy: { eventDate: "asc" },
  });

  // 2. Cotizaciones pendientes en AuditEvent
  const quoteRecords = await prisma.auditEvent.findMany({
    where: { entityType: "TequilitrosQuote" },
  });

  const mapByDay = new Map<string, DayAvailability>();

  // Inicializar días del mes
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

  // Contabilizar eventos confirmados oficiales
  for (const ev of confirmedEvents) {
    if (!isTequilitrosEventMetadata(ev.notes)) continue;
    const dateStr = ev.eventDate.toISOString().slice(0, 10);
    const dayItem = mapByDay.get(dateStr);
    if (!dayItem) continue;

    dayItem.confirmedCount += 1;
    dayItem.events.push({
      id: ev.id,
      code: ev.code,
      clientName: ev.clientName,
      guestCount: ev.guestCount,
      status: ev.status,
      creatorName: "Evento Confirmado",
      isConfirmed: true,
    });
  }

  // Contabilizar cotizaciones tentativas
  for (const rec of quoteRecords) {
    const quote = parseStoredQuote(rec.metadata);
    if (!quote) continue;
    if (quote.isContractConfirmed || quote.status === "CONFIRMED") continue; // Ya contabilizado en ServiceEvent

    const dateStr = quote.eventDate.slice(0, 10);
    const dayItem = mapByDay.get(dateStr);
    if (!dayItem) continue;

    dayItem.pendingCount += 1;
    dayItem.events.push({
      id: quote.code || rec.id,
      code: quote.code,
      clientName: quote.clientName,
      guestCount: quote.guestCount,
      status: "PENDING",
      creatorName: quote.creatorName || "Sucursal",
      isConfirmed: false,
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

  const records = await prisma.auditEvent.findMany({
    where: { entityType: "TequilitrosQuote" },
    select: {
      actorId: true,
      metadata: true,
    },
  });

  const workerMap = new Map<string, EmployeeLeaderboardItem>();

  for (const rec of records) {
    const quote = parseStoredQuote(rec.metadata);
    if (!quote || !quote.createdById) continue;

    const key = quote.createdById;
    const existing = workerMap.get(key) ?? {
      userId: key,
      userName: quote.creatorName || "Empleado",
      quotesCount: 0,
      confirmedContractsCount: 0,
      totalQuotedAmount: 0,
      totalConfirmedAmount: 0,
    };

    const amount = Number(quote.saleAmount ?? 0);
    existing.quotesCount += 1;
    existing.totalQuotedAmount += amount;

    if (quote.isContractConfirmed || quote.status === "CONFIRMED") {
      existing.confirmedContractsCount += 1;
      existing.totalConfirmedAmount += amount;
    }

    workerMap.set(key, existing);
  }

  return Array.from(workerMap.values()).sort(
    (a, b) => b.quotesCount - a.quotesCount || b.totalQuotedAmount - a.totalQuotedAmount
  );
}
