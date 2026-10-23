"use server";

import { revalidatePath } from "next/cache";
import { AccountingPaymentMethod, Prisma } from "@prisma/client";
import { requireAdminAction } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePaymentAmount, validDateOnly } from "@/lib/accounting";
import { parseDateOnly, todayDateOnly } from "@/lib/dateOnly";

export type PaymentActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

function field(data: FormData, name: string): string {
  return String(data.get(name) ?? "").trim();
}

export async function createPaymentAction(data: FormData): Promise<PaymentActionResult> {
  const user = await requireAdminAction();
  const requestId = field(data, "requestId");
  const branchId = field(data, "branchId");
  const paymentDate = field(data, "paymentDate");
  const categoryId = field(data, "categoryId");
  const concept = field(data, "concept");
  const payee = field(data, "payee");
  const amount = parsePaymentAmount(field(data, "amount"));
  const method = field(data, "method");
  const reference = field(data, "reference");
  const receiptUrl = field(data, "receiptUrl");
  const notes = field(data, "notes");

  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { success: false, error: "Vuelve a abrir el formulario e inténtalo de nuevo." };
  if (!branchId) return { success: false, error: "Selecciona una sucursal válida." };
  if (!validDateOnly(paymentDate) || paymentDate > todayDateOnly()) return { success: false, error: "Selecciona una fecha de pago válida, no futura." };
  if (!categoryId) return { success: false, error: "Selecciona un tipo de gasto válido." };
  if (!concept || concept.length > 180) return { success: false, error: "El concepto debe tener entre 1 y 180 caracteres." };
  if (!payee || payee.length > 120) return { success: false, error: "Indica a quién se pagó (máximo 120 caracteres)." };
  if (!amount) return { success: false, error: "Captura un importe positivo con hasta dos decimales." };
  if (!Object.values(AccountingPaymentMethod).includes(method as AccountingPaymentMethod)) return { success: false, error: "Selecciona un método de pago válido." };
  if (reference.length > 100 || receiptUrl.length > 500 || notes.length > 500) return { success: false, error: "La referencia, el comprobante o las notas son demasiado largos." };
  if (receiptUrl) {
    try {
      if (new URL(receiptUrl).protocol !== "https:") throw new Error("URL inválida");
    } catch {
      return { success: false, error: "El enlace del comprobante debe ser una URL HTTPS válida." };
    }
  }

  const [branch, category] = await Promise.all([
    prisma.branch.findFirst({ where: { id: branchId, active: true }, select: { id: true, name: true } }),
    prisma.financialMovementCategory.findFirst({
      where: { id: categoryId, isActive: true, direction: "EXPENSE", scope: "ACCOUNTING" },
      select: { id: true, name: true, requiresReason: true, requiresReceipt: true },
    }),
  ]);
  if (!branch) return { success: false, error: "La sucursal ya no está activa." };
  if (!category) return { success: false, error: "El tipo de gasto ya no está disponible." };
  if (category.requiresReason && !notes) return { success: false, error: "Esta categoría requiere notas con el motivo del pago." };
  if (category.requiresReceipt && !receiptUrl) return { success: false, error: "Esta categoría requiere un enlace al comprobante." };

  try {
    await prisma.accountingPayment.create({
      data: {
        requestId,
        branchId: branch.id,
        branchNameSnapshot: branch.name,
        paymentDate: parseDateOnly(paymentDate),
        categoryId: category.id,
        categoryNameSnapshot: category.name,
        concept,
        payee,
        amount: new Prisma.Decimal(amount),
        method: method as AccountingPaymentMethod,
        reference: reference || null,
        receiptUrl: receiptUrl || null,
        notes: notes || null,
        createdById: user.id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.accountingPayment.findUnique({ where: { requestId }, select: { createdById: true } });
      if (existing?.createdById === user.id) return { success: true, message: "Este pago ya había quedado registrado." };
    }
    console.error("Could not create accounting payment", error);
    return { success: false, error: "No fue posible registrar el pago. Inténtalo de nuevo." };
  }

  revalidatePath("/accounting");
  return { success: true, message: "Pago registrado correctamente." };
}

export async function voidPaymentAction(data: FormData): Promise<PaymentActionResult> {
  const user = await requireAdminAction();

  const id = field(data, "id");
  const reason = field(data, "reason");
  if (!id || reason.length < 8 || reason.length > 300) return { success: false, error: "Indica un motivo de anulación de 8 a 300 caracteres." };

  const updated = await prisma.accountingPayment.updateMany({
    where: { id, voidedAt: null },
    data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason },
  });
  if (updated.count !== 1) return { success: false, error: "El pago ya estaba anulado o no existe." };
  revalidatePath("/accounting");
  return { success: true, message: "Pago anulado; permanece visible en el historial." };
}
