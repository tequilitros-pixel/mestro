"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  DRINKS_CATALOG,
  EVENT_TYPES,
  type TequilitrosQuoteMetadata,
  type QuoteStatus,
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
  status: QuoteStatus;
  createdAt: string;
}

function parseStoredQuote(metadata: unknown): StoredQuoteData | null {
  if (!metadata) return null;
  let obj = metadata;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;

  const code =
    typeof rec.code === "string"
      ? rec.code
      : typeof rec.folio === "string"
        ? rec.folio
        : null;
  if (!code) return null;

  const rawStatus = String(rec.status || (rec.isContractConfirmed ? "CONFIRMED" : "PENDING")).toUpperCase();
  const status: QuoteStatus =
    rawStatus === "CONFIRMED"
      ? "CONFIRMED"
      : rawStatus === "APPROVED"
        ? "APPROVED"
        : rawStatus === "REJECTED"
          ? "REJECTED"
          : rawStatus === "CANCELLED"
            ? "CANCELLED"
            : "PENDING";

  return {
    ...rec,
    id: typeof rec.id === "string" ? rec.id : code,
    code,
    type: "TEQUILITROS_QUOTE",
    status,
  } as unknown as StoredQuoteData;
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
        // count() está filtrado por RLS y puede repetir folios entre empleados.
        const code = `COT-${new Date().getFullYear()}-${folioNumber}-${randomUUID().slice(0,8).toUpperCase()}`;

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

export type UpdateQuoteStatusInput = {
  eventId: string; // Folio o id de la cotización (ej. COT-2026-0001)
  status: QuoteStatus; // "PENDING" | "APPROVED" | "CONFIRMED" | "REJECTED" | "CANCELLED"
  depositPaid?: number; // Monto entregado de anticipo
  depositPaidAt?: string; // Cuándo pusieron el anticipo (YYYY-MM-DD o ISO)
  depositMethod?: string; // Efectivo en Sucursal, Transferencia Bancaria, Tarjeta
  contractNotes?: string;
  branchName?: string;
};

export async function updateQuoteStatusAndDepositAction(input: UpdateQuoteStatusInput) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Debes iniciar sesión para actualizar la cotización." };
    }

    const searchId = input.eventId?.trim();
    if (!searchId) {
      return { success: false, error: "Folio o ID de cotización no especificado." };
    }

    // Preferir el ID inmutable: antes dos empleados podían tener el mismo folio.
    let auditRecord = await prisma.auditEvent.findFirst({
      where: { id: searchId, entityType: "TequilitrosQuote" },
    });
    if (!auditRecord) {
      const matches = await prisma.auditEvent.findMany({
        where: { entityType: "TequilitrosQuote", entityId: searchId },
        orderBy: { createdAt: "desc" },
        take: 2,
      });
      if (matches.length > 1) return { success: false, error: "Folio duplicado. Abre la cotización desde Historial para elegir el registro correcto." };
      auditRecord = matches[0] ?? null;
    }
    if (!auditRecord) {
      const records = await prisma.auditEvent.findMany({
        where: { entityType: "TequilitrosQuote" },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      const matches = records.filter((rec) => {
        const q = parseStoredQuote(rec.metadata);
        return q && [q.code, q.folio, q.contractFolio].some((folio) => folio?.toUpperCase() === searchId.toUpperCase());
      });
      if (matches.length > 1) return { success: false, error: "Este folio es ambiguo. Abre la cotización desde Historial para elegir el registro exacto." };
      auditRecord = matches[0] ?? null;
    }
    if (!auditRecord) {
      return { success: false, error: `No se encontró la cotización con folio: ${searchId}` };
    }

    const currentQuote = parseStoredQuote(auditRecord.metadata);
    if (!currentQuote) {
      return { success: false, error: "No se pudieron leer los datos de la cotización." };
    }

    const saleAmount = Number(currentQuote.saleAmount ?? 0);
    const eventDate = new Date(currentQuote.eventDate);
    const dateStr = !Number.isNaN(eventDate.getTime())
      ? eventDate.toISOString().slice(0, 10).replace(/-/g, "")
      : new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const codeNum = currentQuote.code.match(/^COT-[0-9]{4}-([0-9]+)/)?.[1] || "0001";
    // IDs de documento estables y únicos incluso para folios históricos duplicados.
    const uniquePart = createHash("sha256").update(auditRecord.id).digest("hex").slice(0, 8).toUpperCase();
    const contractFolio = currentQuote.contractFolio || `CTR-${dateStr}-${codeNum}-${uniquePart}`;
    const receiptFolio = currentQuote.receiptFolio || `REC-${dateStr}-${codeNum}-${uniquePart}`;

    // Procesar fecha del anticipo (cuándo lo pusieron)
    let depositPaidAt: string | undefined = undefined;
    if (input.depositPaidAt) {
      const parsedDate = new Date(
        input.depositPaidAt.includes("T") ? input.depositPaidAt : `${input.depositPaidAt}T12:00:00Z`
      );
      depositPaidAt = !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
    } else if (currentQuote.depositPaidAt) {
      depositPaidAt = currentQuote.depositPaidAt;
    } else {
      depositPaidAt = new Date().toISOString();
    }

    // Procesar monto del anticipo
    let depositPaid = currentQuote.depositPaid ?? 0;
    if (input.depositPaid !== undefined && input.depositPaid !== null) {
      const parsed = Math.round(Number(input.depositPaid) * 100) / 100;
      if (!Number.isFinite(parsed) || parsed < 0) {
        return { success: false, error: "Ingresa un monto recibido válido." };
      }
      // Un cliente puede cubrir más del anticipo sugerido o adelantar pagos
      // posteriores. Se conserva el monto real recibido; la vista muestra el
      // excedente como saldo a favor en lugar de convertirlo en saldo negativo.
      depositPaid = parsed;
    } else if (input.status === "CONFIRMED" && (!depositPaid || depositPaid <= 0)) {
      depositPaid = currentQuote.modality === "consumo" ? saleAmount : Math.round(saleAmount * 0.5);
    }

    const depositMethod = input.depositMethod?.trim() || currentQuote.depositMethod || "Efectivo en Sucursal";
    const depositBranchName = input.branchName?.trim() || currentQuote.depositBranchName || user.name;
    const contractNotes = input.contractNotes !== undefined ? input.contractNotes.trim() : currentQuote.contractNotes;

    const isConfirmed = input.status === "CONFIRMED";
    const isApproved = input.status === "APPROVED";
    const isRejected = input.status === "REJECTED";
    const isCancelled = input.status === "CANCELLED";
    if (isConfirmed && (depositPaid <= 0 || Number.isNaN(eventDate.getTime()))) {
      return { success: false, error: "Para confirmar registra un anticipo mayor a cero y una fecha de evento válida." };
    }

    const updatedMetadata: StoredQuoteData = {
      ...currentQuote,
      status: input.status,
      isContractConfirmed: isConfirmed,
      contractFolio: isConfirmed ? contractFolio : currentQuote.contractFolio,
      receiptFolio: isConfirmed || depositPaid > 0 ? receiptFolio : currentQuote.receiptFolio,
      depositPaid: isConfirmed || depositPaid > 0 ? depositPaid : currentQuote.depositPaid,
      depositPaidAt: isConfirmed || depositPaid > 0 ? depositPaidAt : currentQuote.depositPaidAt,
      depositMethod: isConfirmed || depositPaid > 0 ? depositMethod : currentQuote.depositMethod,
      depositReceivedById: isConfirmed || depositPaid > 0 ? user.id : currentQuote.depositReceivedById,
      depositReceivedByName: isConfirmed || depositPaid > 0 ? user.name : currentQuote.depositReceivedByName,
      depositBranchName: isConfirmed || depositPaid > 0 ? depositBranchName : currentQuote.depositBranchName,
      contractNotes: contractNotes || undefined,
      approvedAt: isApproved ? currentQuote.approvedAt || new Date().toISOString() : currentQuote.approvedAt,
      rejectedAt: isRejected ? currentQuote.rejectedAt || new Date().toISOString() : currentQuote.rejectedAt,
    };

    // No marcar como confirmada si falla el registro oficial en inventario.
    await prisma.$transaction(async (tx) => {
      if (isConfirmed) {
        const existingEvent = await tx.serviceEvent.findUnique({ where: { code: contractFolio } });
        if (existingEvent) {
          await tx.serviceEvent.update({
            where: { id: existingEvent.id },
            data: {
              clientName: currentQuote.clientName,
              clientPhone: currentQuote.clientPhone || null,
              location: currentQuote.location,
              eventDate,
              guestCount: currentQuote.guestCount,
              saleAmount,
              status: ["DRAFT", "CANCELLED"].includes(existingEvent.status) ? "PREPARING" : existingEvent.status,
              notes: JSON.stringify(updatedMetadata),
            },
          });
        } else {
          const { start, end } = getUtcDayBounds(eventDate);
          const confirmedOnDate = await tx.serviceEvent.findMany({
            where: { eventDate: { gte: start, lte: end }, status: { notIn: ["DRAFT", "CANCELLED"] } },
            select: { notes: true },
          });
          if (confirmedOnDate.filter((event) => isTequilitrosEventMetadata(event.notes)).length >= MAX_CONFIRMED_EVENTS_PER_DAY) {
            throw new Error("Esta fecha ya tiene el máximo de eventos confirmados.");
          }
          await tx.serviceEvent.create({
            data: {
              code: contractFolio,
              clientName: currentQuote.clientName,
              clientPhone: currentQuote.clientPhone || null,
              location: currentQuote.location,
              eventDate,
              guestCount: currentQuote.guestCount,
              saleAmount,
              status: "PREPARING",
              notes: JSON.stringify(updatedMetadata),
            },
          });
        }
      } else if (isCancelled || isRejected) {
        const existingEvent = await tx.serviceEvent.findUnique({ where: { code: contractFolio } });
        if (existingEvent) await tx.serviceEvent.update({ where: { id: existingEvent.id }, data: { status: "CANCELLED" } });
      }
      await tx.auditEvent.update({
        where: { id: auditRecord.id },
        data: {
          action: isConfirmed
            ? "TEQUILITROS_QUOTE_CONFIRMED"
            : isApproved
              ? "TEQUILITROS_QUOTE_APPROVED"
              : isRejected
                ? "TEQUILITROS_QUOTE_REJECTED"
                : "TEQUILITROS_QUOTE_UPDATED",
          metadata: updatedMetadata as unknown as object,
        },
      });
    }, { isolationLevel: "Serializable" });

    // Revalidación protegida
    const pathsToRevalidate = [
      "/cotizador-tequilitros",
      "/cotizador-tequilitros/calendario",
      "/cotizador-tequilitros/historial",
      "/cotizador-tequilitros/contratos",
      "/administration/inventory/eventos",
      "/administration/inventory/events",
    ];
    for (const p of pathsToRevalidate) {
      try {
        revalidatePath(p);
      } catch {
        // Ignorar
      }
    }

    return {
      success: true,
      status: input.status,
      contractFolio: updatedMetadata.contractFolio,
      receiptFolio: updatedMetadata.receiptFolio,
      metadata: updatedMetadata,
    };
  } catch (err: unknown) {
    console.error("Error al actualizar estatus de cotización:", err);
    const message = err instanceof Error ? err.message : "Error al actualizar la cotización.";
    return { success: false, error: message };
  }
}

export async function registerDepositAction(input: {
  eventId: string; // Folio o id de la cotización
  depositPaid: number;
  depositPaidAt?: string;
  depositMethod: string;
  contractNotes?: string;
  branchName?: string;
}) {
  return updateQuoteStatusAndDepositAction({
    eventId: input.eventId,
    status: "CONFIRMED",
    depositPaid: input.depositPaid,
    depositPaidAt: input.depositPaidAt,
    depositMethod: input.depositMethod,
    contractNotes: input.contractNotes,
    branchName: input.branchName,
  });
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
      id: rec.id, // Usar la PK del AuditEvent, nunca el folio potencialmente duplicado.
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
    if (quote.status === "REJECTED" || quote.status === "CANCELLED") continue; // Descartar canceladas y rechazadas

    const dateStr = quote.eventDate.slice(0, 10);
    const dayItem = mapByDay.get(dateStr);
    if (!dayItem) continue;

    dayItem.pendingCount += 1;
    dayItem.events.push({
      id: quote.code || rec.id,
      code: quote.code,
      clientName: quote.clientName,
      guestCount: quote.guestCount,
      status: quote.status || "PENDING",
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

export type PublicQuoteViewData = {
  code: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  location: string;
  eventDate: string;
  guestCount: number;
  saleAmount: number;
  status: QuoteStatus;
  isConfirmed: boolean;
  createdAt: string;
  metadata: TequilitrosQuoteMetadata;
};

export async function getPublicQuoteByCode(rawCode: string): Promise<PublicQuoteViewData | null> {
  const code = decodeURIComponent(rawCode || "").trim().toUpperCase();
  if (!code) return null;

  // 1. Buscar coincidencia directa en AuditEvent (entityId)
  let auditRecord = await prisma.auditEvent.findFirst({
    where: {
      entityType: "TequilitrosQuote",
      OR: [{ entityId: code }, { id: code }],
    },
    orderBy: { createdAt: "desc" },
  });

  // 2. Si no coincide con entityId (por ejemplo si buscan por folio de contrato CTR-...)
  if (!auditRecord) {
    const records = await prisma.auditEvent.findMany({
      where: { entityType: "TequilitrosQuote" },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    auditRecord =
      records.find((rec) => {
        const q = parseStoredQuote(rec.metadata);
        if (!q) return false;
        return (
          q.code.toUpperCase() === code ||
          (q.contractFolio && q.contractFolio.toUpperCase() === code) ||
          (q.folio && q.folio.toUpperCase() === code)
        );
      }) ?? null;
  }

  if (!auditRecord) return null;

  const quote = parseStoredQuote(auditRecord.metadata);
  if (!quote) return null;

  return {
    code: quote.code,
    clientName: quote.clientName,
    clientPhone: quote.clientPhone,
    clientEmail: quote.clientEmail,
    location: quote.location,
    eventDate: quote.eventDate,
    guestCount: quote.guestCount,
    saleAmount: Number(quote.saleAmount ?? 0),
    status: quote.status,
    isConfirmed: Boolean(quote.isContractConfirmed || quote.status === "CONFIRMED"),
    createdAt: quote.createdAt || auditRecord.createdAt.toISOString(),
    metadata: quote,
  };
}
