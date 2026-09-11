import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, CashSafeEnvelope, CashSafeEnvelopeStatus } from "@prisma/client";
import { Money } from "@/lib/domain/money";
import { DomainError } from "@/lib/domain/errors";
import type { CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch, lockCashSession } from "@/lib/pos2/cash/guards";
import { formatDateOnly } from "@/lib/dateOnly";
import { requireFinancialMovementCategory } from "@/lib/financialMovementCategories";

/*
 * ============================================================
 * Sobres en Caja Fuerte -- logica de dominio
 * ------------------------------------------------------------
 * Reglas que este archivo protege:
 * - Un corte = un sobre, siempre (idempotente ante reintentos).
 * - currentBalance nunca queda negativo.
 * - Ningun movimiento se edita ni se borra jamas.
 * - El saldo de una sucursal tiene una sola formula, aqui.
 * ============================================================
 */

const ROLES_QUE_PUEDEN_RETIRAR: string[] = ["ADMIN", "GERENTE"];
/** Un ajuste corrige un error: mas restringido que un retiro normal. */
const ROLES_QUE_PUEDEN_AJUSTAR: string[] = ["ADMIN"];
const ROLES_QUE_PUEDEN_RECIBIR: string[] = ["ADMIN", "GERENTE", "ENCARGADO"];
const MAX_WRITE_ATTEMPTS = 5;
const TRANSFER_ROLES = ["ADMIN", "GERENTE", "ENCARGADO"];

function isWriteConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const code = "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "P2034" || code === "40001") {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  const message = "message" in error ? String((error as { message: unknown }).message) : "";

  // Prisma puede envolver un 40001 de Postgres en P2010 para
  // consultas raw. En ese caso el SQLSTATE solo llega en el mensaje
  // ("Raw query failed. Code: `40001`"). Sigue siendo el mismo
  // conflicto serializable y debe reintentarse como P2034.
  if (
    code === "P2010" &&
    message.includes("Raw query failed") &&
    /Code:\s*`?40001`?/.test(message) &&
    message.includes("could not serialize access")
  ) {
    return true;
  }

  if (typeof cause !== "object" || cause === null) return false;

  const kind = "kind" in cause ? String((cause as { kind: unknown }).kind) : "";
  const originalCode = "originalCode" in cause
    ? String((cause as { originalCode: unknown }).originalCode)
    : "";
  return kind === "TransactionWriteConflict" || originalCode === "40001";
}

async function withEnvelopeWriteTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isWriteConflict(error) || attempt === MAX_WRITE_ATTEMPTS - 1) throw error;
      const backoffMs = 10 * (attempt + 1) + Math.floor(Math.random() * 25);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error("No se pudo completar la operacion del sobre");
}

type TransferEndpoint = { type: "CASH_SESSION" | "ENVELOPE"; id: string };
const legacyAmount = (value: Money) => Number(value.toString());

export async function transferCash(params: { operationId: string; source: TransferEndpoint; destination: TransferEndpoint; amount: string; reason: string; actor: CommandActor }) {
  if (!TRANSFER_ROLES.includes(params.actor.role)) throw new DomainError("PERMISSION_DENIED");
  if (params.source.type === params.destination.type && params.source.id === params.destination.id) throw new DomainError("VALIDATION_ERROR", { field: "destination" });
  if (!params.reason.trim()) throw new DomainError("VALIDATION_ERROR", { field: "reason" });
  let amount: Money;
  try { amount = Money.nonNegative(params.amount); } catch { throw new DomainError("VALIDATION_ERROR", { field: "amount" }); }
  if (amount.equals(Money.zero())) throw new DomainError("VALIDATION_ERROR", { field: "amount" });
  return withEnvelopeWriteTransaction(async (tx) => {
    const replay = await tx.cashTransfer.findUnique({ where: { operationId: params.operationId } });
    if (replay) {
      const same = replay.sourceType === params.source.type && replay.sourceId === params.source.id && replay.destinationType === params.destination.type && replay.destinationId === params.destination.id && replay.amount.equals(amount.toDecimal());
      if (!same) throw new DomainError("IDEMPOTENCY_KEY_REUSED", { operationId: params.operationId });
      return { replayed: true, transferId: replay.id, amount: replay.amount.toFixed(2), branchId: replay.branchId };
    }
    const source = await lockTransferEndpoint(tx, params.source);
    const destination = await lockTransferEndpoint(tx, params.destination);
    if (source.branchId !== destination.branchId) throw new DomainError("PERMISSION_DENIED", { branchId: destination.branchId });
    requireActorBranch(params.actor, source.branchId);
    if (source.type === "CASH_SESSION" && source.status !== "OPEN") throw new DomainError("CASH_SESSION_NOT_OPEN");
    if (source.type === "ENVELOPE" && (source.status === "PENDIENTE" || source.status === "VACIO")) throw new DomainError("INVALID_STATE_TRANSITION", { status: source.status });
    if (destination.type === "CASH_SESSION" && destination.status !== "OPEN") throw new DomainError("CASH_SESSION_NOT_OPEN");
    if (destination.type === "ENVELOPE" && (destination.status === "PENDIENTE" || destination.status === "VACIO")) throw new DomainError("INVALID_STATE_TRANSITION", { status: destination.status });
    if (amount.compare(source.balance) > 0) throw new DomainError("VALIDATION_ERROR", { field: "amount", reason: "INSUFFICIENT_BALANCE" });
    const transfer = await tx.cashTransfer.create({ data: { operationId: params.operationId, branchId: source.branchId, sourceType: params.source.type, sourceId: params.source.id, destinationType: params.destination.type, destinationId: params.destination.id, amount: amount.toDecimal(), reason: params.reason.trim(), actorId: params.actor.id } });
    if (source.type === "CASH_SESSION") await tx.cashMovement.create({ data: { cashSessionId: source.id, branchId: source.branchId, registerId: source.registerId, type: "SAFE_TRANSFER", direction: "OUT", amount: amount.toDecimal(), sourceType: "CASH_TRANSFER", sourceId: transfer.id, actorId: params.actor.id, operationId: crypto.randomUUID(), metadata: { transferId: transfer.id, destinationType: params.destination.type, destinationId: params.destination.id } } });
    else await tx.cashSafeEnvelopeMovement.create({ data: { envelopeId: source.id, type: "RETIRO", amount: legacyAmount(amount), previousBalance: legacyAmount(source.balance), newBalance: legacyAmount(source.balance.subtract(amount)), userId: params.actor.id, notes: `Transferencia a ${params.destination.type}: ${params.reason.trim()}` } });
    if (destination.type === "CASH_SESSION") await tx.cashMovement.create({ data: { cashSessionId: destination.id, branchId: destination.branchId, registerId: destination.registerId, type: "SAFE_TRANSFER", direction: "IN", amount: amount.toDecimal(), sourceType: "CASH_TRANSFER", sourceId: transfer.id, actorId: params.actor.id, operationId: crypto.randomUUID(), metadata: { transferId: transfer.id, sourceType: params.source.type, sourceId: params.source.id } } });
    else await tx.cashSafeEnvelopeMovement.create({ data: { envelopeId: destination.id, type: "INGRESO", amount: legacyAmount(amount), previousBalance: legacyAmount(destination.balance), newBalance: legacyAmount(destination.balance.add(amount)), userId: params.actor.id, notes: `Transferencia desde ${params.source.type}: ${params.reason.trim()}` } });
    if (source.type === "ENVELOPE") await tx.cashSafeEnvelope.update({ where: { id: source.id }, data: { currentBalance: legacyAmount(source.balance.subtract(amount)), status: source.balance.subtract(amount).equals(Money.zero()) ? "VACIO" : "PARCIAL" } });
    if (destination.type === "ENVELOPE") await tx.cashSafeEnvelope.update({ where: { id: destination.id }, data: { currentBalance: legacyAmount(destination.balance.add(amount)), status: "EN_CAJA_FUERTE" } });
    return { replayed: false, transferId: transfer.id, amount: amount.toString(), branchId: transfer.branchId };
  });
}

async function lockTransferEndpoint(tx: Prisma.TransactionClient, endpoint: TransferEndpoint) {
  if (endpoint.type === "CASH_SESSION") {
    const session = await lockCashSession(tx, endpoint.id);
    const rows = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>`SELECT COALESCE(SUM(CASE WHEN "direction" = 'IN' THEN "amount" ELSE -"amount" END), 0) AS balance FROM "CashMovement" WHERE "cashSessionId" = ${endpoint.id}`;
    return { ...session, type: endpoint.type, balance: Money.from(rows[0]?.balance ?? 0) };
  }
  const envelope = await lockEnvelopeForUpdate(tx, endpoint.id);
  return { ...envelope, type: endpoint.type, balance: Money.fromLegacyFloat(envelope.currentBalance) };
}

/**
 * Bloquea el sobre antes de derivar un nuevo saldo. El ledger y el
 * encabezado se escriben en la misma transaccion, por lo que dos
 * solicitudes concurrentes no pueden registrar el mismo retiro o
 * recepcion dos veces.
 */
async function lockEnvelopeForUpdate(
  tx: Prisma.TransactionClient,
  envelopeId: string
): Promise<CashSafeEnvelope> {
  const rows = await tx.$queryRaw<CashSafeEnvelope[]>`
    SELECT *
    FROM "CashSafeEnvelope"
    WHERE "id" = ${envelopeId}
    FOR UPDATE
  `;
  const envelope = rows[0];
  if (!envelope) throw new Error("Sobre no encontrado");
  return envelope;
}

export function canWithdraw(role: string) {
  return ROLES_QUE_PUEDEN_RETIRAR.includes(role);
}
export function canAdjust(role: string) {
  return ROLES_QUE_PUEDEN_AJUSTAR.includes(role);
}
export function canReceive(role: string) {
  return ROLES_QUE_PUEDEN_RECIBIR.includes(role);
}

/**
 * `HUE-20260819-001`. La secuencia cuenta sobres existentes con el
 * mismo prefijo sucursal+fecha. El candado real contra duplicados
 * es el @@unique en cashCutId (ver createEnvelopeForCashCut); esto
 * es solo la etiqueta legible, con reintento si dos cierres de la
 * misma sucursal el mismo dia compiten por la misma secuencia.
 */
export async function generateEnvelopeCode(
  tx: Prisma.TransactionClient,
  branchCode: string,
  cutDate: Date
): Promise<string> {
  const prefix = `${branchCode}-${formatDateOnly(cutDate).replace(/-/g, "")}`;

  const existing = await tx.cashSafeEnvelope.count({
    where: { code: { startsWith: `${prefix}-` } },
  });

  return `${prefix}-${String(existing + 1).padStart(3, "0")}`;
}

/**
 * Crea (o recupera, si ya existe) el sobre de un corte cerrado.
 * Idempotente: si el cierre se reintenta (doble clic, retry de
 * red), NUNCA produce un segundo sobre para el mismo cashCutId.
 *
 * Debe llamarse DENTRO de la misma transaccion que cierra el
 * corte -- ver cerrar-route.pending-sobres.ts.
 */
export async function createEnvelopeForCashCut(
  tx: Prisma.TransactionClient,
  params: {
    cashCutId: string;
    branchId: string;
    branchCode: string;
    cutDate: Date;
    amount: number;
    userId: string;
  }
): Promise<CashSafeEnvelope> {
  const existing = await tx.cashSafeEnvelope.findUnique({
    where: { cashCutId: params.cashCutId },
  });
  if (existing) return existing;

  /*
   * IMPORTANTE: aqui NO se reintenta dentro del mismo `tx` si el
   * create() falla. En Postgres, cualquier statement fallido deja
   * la transaccion completa "abortada" -- cualquier query posterior
   * sobre ese mismo `tx` (incluido un findUnique de recuperacion)
   * lanza 25P02 en vez de devolver datos utiles. Un retry interno
   * ahi es una trampa, no una proteccion.
   *
   * La proteccion real contra el doble clic / doble cierre del
   * MISMO corte ya la da el `tx.cashCut.update({ where: { id } })`
   * que corre ANTES que esto, en la misma transaccion de cierre
   * (ver cerrar/route.ts): Postgres toma un lock de fila sobre ese
   * CashCut, asi que una segunda peticion concurrente para el mismo
   * corte queda bloqueada hasta que la primera termine, y al llegar
   * aqui el `findUnique` de arriba ya encuentra el sobre creado por
   * la primera -- sin necesidad de capturar ningun error.
   *
   * El unico caso que puede fallar aqui es la colision de `code`
   * entre DOS CORTES DISTINTOS de la misma sucursal cerrando en el
   * mismo instante exacto (sin lock compartido entre ellos). Es
   * intencional dejar que ese error se propague: rompe TODA la
   * transaccion de cierre (el corte vuelve a quedar ABIERTO, sin
   * sobre, sin estado a medias) y el cliente ya sabe reintentar el
   * cierre ante un error -- en el reintento, la cuenta de secuencia
   * ya ve el sobre del otro corte y genera el siguiente numero.
   */
  const code = await generateEnvelopeCode(tx, params.branchCode, params.cutDate);
  return tx.cashSafeEnvelope.create({
    data: {
      code,
      branchId: params.branchId,
      cashCutId: params.cashCutId,
      cutDate: params.cutDate,
      originalAmount: params.amount,
      currentBalance: params.amount,
      status: "PENDIENTE",
      createdById: params.userId,
      movements: {
        create: {
          type: "INGRESO",
          amount: params.amount,
          previousBalance: 0,
          newBalance: params.amount,
          cashCutId: params.cashCutId,
          userId: params.userId,
          notes: "Generado al cerrar el corte",
        },
      },
    },
  });
}

/**
 * Confirma que un sobre PENDIENTE llego fisicamente a la caja
 * fuerte. Idempotente: si ya no esta PENDIENTE, no hace nada y
 * devuelve el sobre tal cual (tolera doble clic).
 *
 * Si `receivedAmount` difiere de `originalAmount`, la diferencia
 * se registra como un movimiento AJUSTE_* automatico -- nunca se
 * oculta ni se absorbe en silencio.
 */
export async function receiveEnvelope(params: {
  envelopeId: string;
  receivedAmount: number;
  userId: string;
}) {
  return withEnvelopeWriteTransaction(async (tx) => {
    const envelope = await lockEnvelopeForUpdate(tx, params.envelopeId);

    if (envelope.status !== "PENDIENTE") return envelope;

    if (!Number.isFinite(params.receivedAmount) || params.receivedAmount < 0) {
      throw new Error("Cantidad recibida invalida");
    }

    const difference = params.receivedAmount - envelope.originalAmount;

    await tx.cashSafeEnvelopeMovement.create({
      data: {
        envelopeId: envelope.id,
        type: "RECEPCION",
        amount: params.receivedAmount,
        previousBalance: envelope.currentBalance,
        // La recepción confirma el conteo físico; no debe aplicar dos
        // veces la diferencia. Si el importe difiere, el AJUSTE_* que se
        // crea enseguida es el único movimiento que modifica el saldo.
        newBalance: envelope.currentBalance,
        userId: params.userId,
        notes: "Confirmacion de llegada fisica a caja fuerte",
      },
    });

    if (Math.abs(difference) > 0.009) {
      await tx.cashSafeEnvelopeMovement.create({
        data: {
          envelopeId: envelope.id,
          type: difference > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
          amount: Math.abs(difference),
          previousBalance: envelope.originalAmount,
          newBalance: params.receivedAmount,
          userId: params.userId,
          notes: `Diferencia detectada al recibir: esperado $${envelope.originalAmount.toFixed(2)}, contado $${params.receivedAmount.toFixed(2)}`,
        },
      });
    }

    return tx.cashSafeEnvelope.update({
      where: { id: envelope.id },
      data: {
        status: params.receivedAmount === 0 ? "VACIO" : "EN_CAJA_FUERTE",
        currentBalance: params.receivedAmount,
        receivedAmount: params.receivedAmount,
        receivedById: params.userId,
        receivedAt: new Date(),
      },
    });
  });
}

/**
 * Retiro parcial o total de un sobre. `full: true` retira
 * exactamente el saldo disponible sin necesidad de que el
 * llamador conozca el monto exacto (evita condiciones de carrera
 * entre "ver el saldo" y "escribir el monto a retirar").
 */
export async function withdrawFromEnvelope(params: {
  envelopeId: string;
  amount?: number;
  full?: boolean;
  reason: string;
  categoryId?: string;
  receiptPhotoUrl?: string;
  userId: string;
}) {
  if (!params.reason || !params.reason.trim()) {
    throw new Error("El motivo del retiro es obligatorio");
  }

  return withEnvelopeWriteTransaction(async (tx) => {
    const envelope = await lockEnvelopeForUpdate(tx, params.envelopeId);

    if (envelope.status === "PENDIENTE") {
      throw new Error("Este sobre aun no se ha recibido en caja fuerte");
    }
    if (envelope.status === "VACIO") {
      throw new Error("Este sobre ya esta vacio");
    }

    const amount = params.full ? envelope.currentBalance : params.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Monto de retiro invalido");
    }
    if (amount > envelope.currentBalance + 0.009) {
      throw new Error(
        `El retiro ($${amount.toFixed(2)}) excede el saldo disponible del sobre ($${envelope.currentBalance.toFixed(2)})`
      );
    }

    const newBalance = Math.max(0, envelope.currentBalance - amount);
    const category = params.categoryId ? await requireFinancialMovementCategory(tx, { categoryId: params.categoryId, direction: "EXPENSE", scope: "ENVELOPE" }) : null;
    if (category?.requiresReceipt && !params.receiptPhotoUrl?.trim()) throw new Error("El comprobante es obligatorio para esta categoría");

    await tx.cashSafeEnvelopeMovement.create({
      data: {
        envelopeId: envelope.id,
        type: "RETIRO",
        amount,
        previousBalance: envelope.currentBalance,
        newBalance,
        userId: params.userId,
        notes: params.reason.trim(),
        ...(category ? { categoryId: category.id, categoryNameSnapshot: category.name } : {}),
        receiptPhotoUrl: params.receiptPhotoUrl?.trim() || null,
      },
    });

    return tx.cashSafeEnvelope.update({
      where: { id: envelope.id },
      data: {
        currentBalance: newBalance,
        status: newBalance === 0 ? "VACIO" : "PARCIAL",
      },
    });
  });
}

/**
 * Correccion administrativa. `delta` positivo aumenta el saldo,
 * negativo lo reduce. Nunca deja currentBalance negativo.
 */
export async function adjustEnvelope(params: {
  envelopeId: string;
  delta: number;
  reason: string;
  userId: string;
}) {
  if (!params.reason || !params.reason.trim()) {
    throw new Error("El motivo del ajuste es obligatorio");
  }
  if (!Number.isFinite(params.delta) || params.delta === 0) {
    throw new Error("El ajuste debe ser distinto de cero");
  }

  return withEnvelopeWriteTransaction(async (tx) => {
    const envelope = await lockEnvelopeForUpdate(tx, params.envelopeId);

    if (envelope.status === "PENDIENTE") {
      throw new Error("Este sobre aún no se ha recibido en caja fuerte");
    }

    const newBalance = envelope.currentBalance + params.delta;
    if (newBalance < 0) {
      throw new Error("El ajuste dejaria el sobre en saldo negativo");
    }

    await tx.cashSafeEnvelopeMovement.create({
      data: {
        envelopeId: envelope.id,
        type: params.delta > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
        amount: Math.abs(params.delta),
        previousBalance: envelope.currentBalance,
        newBalance,
        userId: params.userId,
        notes: params.reason.trim(),
      },
    });

    return tx.cashSafeEnvelope.update({
      where: { id: envelope.id },
      data: {
        currentBalance: newBalance,
        status: newBalance === 0 ? "VACIO" : envelope.receivedAt ? "PARCIAL" : envelope.status,
      },
    });
  });
}

export interface BranchSafeSummary {
  branchId: string;
  branch: string;
  /** legado (CashSafeMovement, previo a sobres) + sobres validos */
  balance: number;
  legacyBalance: number;
  envelopeBalance: number;
  envelopeCount: number;
  pendingCount: number;
  pendingAmount: number;
}

/**
 * Unica fuente de verdad del saldo de una sucursal. Los lugares
 * que hoy recalculan esto por su cuenta (app/api/cash-cuts/safe,
 * app/api/cash-cuts/dashboard) deben migrar a llamar esta funcion
 * en vez de repetir la formula -- ver DISENO.md #3 y #10.
 */
export async function getBranchSafeSummary(branchId: string, dateRange?: { from: Date; toExclusive: Date }): Promise<BranchSafeSummary> {
  const [branch, legacyMovements, envelopes] = await Promise.all([
    prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { name: true } }),
    prisma.cashSafeMovement.findMany({ where: { branchId, ...(dateRange ? { createdAt: { gte: dateRange.from, lt: dateRange.toExclusive } } : {}) } }),
    prisma.cashSafeEnvelope.findMany({ where: { branchId, ...(dateRange ? { cutDate: { gte: dateRange.from, lt: dateRange.toExclusive } } : {}) } }),
  ]);

  const legacyBalance = legacyMovements.reduce(
    (sum, m) => sum + (m.type === "DEPOSITO_SOBRE" ? m.amount : -m.amount),
    0
  );

  const validEnvelopes = envelopes.filter(
    (e) => e.status === "EN_CAJA_FUERTE" || e.status === "PARCIAL"
  );
  const envelopeBalance = validEnvelopes.reduce((sum, e) => sum + e.currentBalance, 0);

  const pending = envelopes.filter((e) => e.status === "PENDIENTE");

  return {
    branchId,
    branch: branch.name,
    balance: legacyBalance + envelopeBalance,
    legacyBalance,
    envelopeBalance,
    envelopeCount: validEnvelopes.length,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((sum, e) => sum + e.originalAmount, 0),
  };
}

export async function listEnvelopesForBranch(
  branchId: string,
  status?: CashSafeEnvelopeStatus[]
) {
  return prisma.cashSafeEnvelope.findMany({
    where: { branchId, ...(status ? { status: { in: status } } : {}) },
    include: {
      createdBy: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, name: true } },
      cashCut: { select: { id: true, code: true } },
    },
    orderBy: { cutDate: "desc" },
  });
}

export async function getEnvelopeWithMovements(envelopeId: string) {
  return prisma.cashSafeEnvelope.findUnique({
    where: { id: envelopeId },
    include: {
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, name: true } },
      cashCut: { select: { id: true, code: true, date: true } },
      movements: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
