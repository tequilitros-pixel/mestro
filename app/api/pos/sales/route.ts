import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { PaymentMethod, PosBenefitReason } from "@prisma/client";
import { getDiscountLimitsByRole, verifyManagerPin } from "@/lib/pos/discountLimits";

const ROLES_QUE_PUEDEN_VENDER = ["ADMIN", "GERENTE", "ENCARGADO"];

const VALID_REASONS = new Set(Object.values(PosBenefitReason));

type ItemDiscountInput = {
  kind?: "DESCUENTO_NORMAL" | "CORTESIA";
  type: "PERCENT" | "AMOUNT";
  value: number;
  reason: string;
  reasonNote?: string;
};

type CartItemInput =
  | {
      variantId: string;
      quantity: number;
      isCustom?: false;
      discount?: ItemDiscountInput;
    }
  | {
      isCustom: true;
      description: string;
      amount: number;
      quantity?: number;
    };

function validateReason(
  reason: string | undefined,
  reasonNote: string | undefined,
): { reason: PosBenefitReason; reasonNote: string | null } | { error: string } {
  if (!reason || !VALID_REASONS.has(reason as PosBenefitReason)) {
    return { error: "Selecciona un motivo válido para el descuento." };
  }
  if (reason === "OTRO" && !reasonNote?.trim()) {
    return { error: "Escribe el motivo cuando seleccionas \"Otro\"." };
  }
  return { reason: reason as PosBenefitReason, reasonNote: reasonNote?.trim() || null };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const allowedBranchIds = await getAccessibleBranchIds();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId") ?? undefined;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  let branchFilter: string | { in: string[] } | undefined;

  if (branchId) {
    if (allowedBranchIds && !allowedBranchIds.includes(branchId)) {
      return NextResponse.json({ error: "No tienes acceso a esta sucursal" }, { status: 403 });
    }
    branchFilter = branchId;
  } else if (allowedBranchIds) {
    branchFilter = { in: allowedBranchIds };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const sales = await prisma.posSale.findMany({
    where: {
      ...(branchFilter ? { branchId: branchFilter } : {}),
      createdAt: {
        gte: dateFrom ? new Date(dateFrom) : startOfToday,
        lte: dateTo ? new Date(dateTo) : undefined,
      },
    },
    include: {
      branch: { select: { id: true, name: true } },
      soldBy: { select: { id: true, name: true } },
      items: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(sales);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_VENDER.includes(user.role)) {
    return NextResponse.json(
      { error: "No tienes permiso para cobrar en el punto de venta" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const {
    branchId,
    items,
    discountAmount: rawDiscountAmount,
    discountReason,
    discountReasonCode,
    employeeBuyerId,
    payments,
    authorization,
  }: {
    branchId?: string;
    items?: CartItemInput[];
    discountAmount?: number;
    discountReason?: string;
    discountReasonCode?: string;
    employeeBuyerId?: string;
    payments?: { method: string; amount: number }[];
    authorization?: { managerId?: string; pin?: string };
  } = body;

  if (!branchId) {
    return NextResponse.json({ error: "Selecciona la sucursal." }, { status: 400 });
  }

  let employeeBuyer: { id: string; name: string } | null = null;
  if (employeeBuyerId) {
    employeeBuyer = await prisma.user.findFirst({
      where: { id: employeeBuyerId, active: true },
      select: { id: true, name: true },
    });
    if (!employeeBuyer) {
      return NextResponse.json({ error: "El empleado seleccionado no es válido." }, { status: 400 });
    }
  }

  if (user.role === "GERENTE" || user.role === "ENCARGADO") {
    const hasAccess = await prisma.userBranch.findFirst({
      where: { userId: user.id, branchId },
    });
    if (!hasAccess) {
      return NextResponse.json({ error: "No autorizado en esta sucursal" }, { status: 403 });
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un producto o cobro." }, { status: 400 });
  }

  if (!Array.isArray(payments)) {
    return NextResponse.json({ error: "Selecciona al menos un método de pago." }, { status: 400 });
  }

  // La lista de pagos puede venir vacía solo cuando el total termina
  // en $0 (p. ej. una venta 100% con descuento o cortesía) — se
  // valida abajo, ya con el total real calculado.
  const validMethods = new Set(Object.values(PaymentMethod));
  for (const payment of payments) {
    if (!validMethods.has(payment.method as PaymentMethod) || !(payment.amount > 0)) {
      return NextResponse.json({ error: "Método de pago inválido." }, { status: 400 });
    }
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const openCashCut = await prisma.cashCut.findFirst({
    where: { branchId, status: "ABIERTO" },
    orderBy: { openedAt: "desc" },
  });

  if (!openCashCut) {
    return NextResponse.json(
      { error: "Esta sucursal no tiene un corte de caja abierto. Ábrelo antes de cobrar." },
      { status: 400 }
    );
  }

  // Resolvemos cada línea del carrito: producto de catálogo (con
  // receta de ingredientes) o cobro personalizado del teclado.
  const variantIds = items
    .filter((item): item is { variantId: string; quantity: number } => !item.isCustom)
    .map((item) => item.variantId);

  const variants = variantIds.length
    ? await prisma.posProductVariant.findMany({
        where: { id: { in: variantIds } },
        include: {
          product: { select: { id: true, name: true } },
          ingredients: true,
        },
      })
    : [];

  const variantsById = new Map(variants.map((v) => [v.id, v]));

  let employeeDiscountPercent = 50;
  if (employeeBuyer) {
    const settings = await prisma.posSettings.findUnique({ where: { id: "default" } });
    employeeDiscountPercent = settings?.employeeDiscountPercent ?? 50;
  }

  type ResolvedItem = {
    variantId: string | null;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    isCustom: boolean;
    description: string | null;
    discountKind: "DESCUENTO_NORMAL" | "DESCUENTO_EMPLEADO" | "CORTESIA" | null;
    discountReason: PosBenefitReason | null;
    discountReasonNote: string | null;
    originalUnitPrice: number | null;
    benefitAmount: number | null;
    beneficiaryEmployeeId: string | null;
    authorizedById: string | null;
  };

  const resolvedItems: ResolvedItem[] = [];

  for (const item of items) {
    if (item.isCustom) {
      const amount = Number(item.amount);
      if (!(amount > 0)) {
        return NextResponse.json(
          { error: "El monto del cobro personalizado debe ser mayor a cero." },
          { status: 400 }
        );
      }
      if (!item.description || !item.description.trim()) {
        return NextResponse.json(
          { error: "Escribe una descripción para el cobro personalizado." },
          { status: 400 }
        );
      }

      resolvedItems.push({
        variantId: null,
        name: item.description.trim(),
        unitPrice: amount,
        quantity: 1,
        lineTotal: amount,
        isCustom: true,
        description: item.description.trim(),
        discountKind: null,
        discountReason: null,
        discountReasonNote: null,
        originalUnitPrice: null,
        benefitAmount: null,
        beneficiaryEmployeeId: null,
        authorizedById: null,
      });
      continue;
    }

    const quantity = Number(item.quantity);
    if (!(quantity > 0) || !Number.isInteger(quantity)) {
      return NextResponse.json({ error: "Cantidad inválida." }, { status: 400 });
    }

    const variant = variantsById.get(item.variantId);
    if (!variant || !variant.active) {
      return NextResponse.json({ error: "Un producto del carrito ya no está disponible." }, { status: 400 });
    }

    const label =
      variant.name && variant.name !== "Único"
        ? `${variant.product.name} (${variant.name})`
        : variant.product.name;

    let unitPrice = variant.price;
    let discountKind: "DESCUENTO_NORMAL" | "DESCUENTO_EMPLEADO" | "CORTESIA" | null = null;
    let discountReasonValue: PosBenefitReason | null = null;
    let discountReasonNote: string | null = null;
    let originalUnitPrice: number | null = null;
    let beneficiaryEmployeeId: string | null = null;

    if (item.discount?.kind === "CORTESIA") {
      // Cortesía: el producto se entrega sin costo, pero NUNCA se
      // trata como un descuento del 100% — queda marcada con su
      // propio tipo para auditoría, inventario y reportes. El motivo
      // sigue siendo obligatorio.
      const reasonResult = validateReason(item.discount.reason, item.discount.reasonNote);
      if ("error" in reasonResult) {
        return NextResponse.json({ error: `${reasonResult.error} (${label})` }, { status: 400 });
      }

      unitPrice = 0;
      discountKind = "CORTESIA";
      discountReasonValue = reasonResult.reason;
      discountReasonNote = reasonResult.reasonNote;
      originalUnitPrice = variant.price;
    } else if (item.discount) {
      const { type, value } = item.discount;

      if (type === "PERCENT") {
        if (!(value > 0) || value > 100) {
          return NextResponse.json(
            { error: `Porcentaje de descuento inválido para ${label}.` },
            { status: 400 }
          );
        }
        unitPrice = variant.price * (1 - value / 100);
      } else if (type === "AMOUNT") {
        if (!(value > 0) || value > variant.price) {
          return NextResponse.json(
            { error: `Monto de descuento inválido para ${label}.` },
            { status: 400 }
          );
        }
        unitPrice = variant.price - value;
      } else {
        return NextResponse.json({ error: `Tipo de descuento inválido para ${label}.` }, { status: 400 });
      }

      const reasonResult = validateReason(item.discount.reason, item.discount.reasonNote);
      if ("error" in reasonResult) {
        return NextResponse.json({ error: `${reasonResult.error} (${label})` }, { status: 400 });
      }

      unitPrice = Math.max(0, Math.round(unitPrice * 100) / 100);
      discountKind = "DESCUENTO_NORMAL";
      discountReasonValue = reasonResult.reason;
      discountReasonNote = reasonResult.reasonNote;
      originalUnitPrice = variant.price;
    } else if (employeeBuyer) {
      // Precio de empleado: si el producto tiene precio especial se
      // usa ese; si no, se aplica el % genérico configurado. Nunca
      // se combina con un descuento manual (ver el `if` de arriba).
      const employeeUnitPrice =
        variant.employeePrice ?? variant.price * (1 - employeeDiscountPercent / 100);

      unitPrice = Math.max(0, Math.round(employeeUnitPrice * 100) / 100);
      discountKind = "DESCUENTO_EMPLEADO";
      originalUnitPrice = variant.price;
      beneficiaryEmployeeId = employeeBuyer.id;
    }

    resolvedItems.push({
      variantId: variant.id,
      name: label,
      unitPrice,
      quantity,
      lineTotal: unitPrice * quantity,
      isCustom: false,
      description: null,
      discountKind,
      discountReason: discountReasonValue,
      discountReasonNote,
      originalUnitPrice,
      benefitAmount: originalUnitPrice !== null ? (originalUnitPrice - unitPrice) * quantity : null,
      beneficiaryEmployeeId,
      authorizedById: null,
    });
  }

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const discountAmount = Math.min(
    Math.max(Number(rawDiscountAmount) || 0, 0),
    subtotal
  );
  const total = subtotal - discountAmount;

  let saleDiscountReasonCode: PosBenefitReason | null = null;
  let saleDiscountNote: string | null = null;

  if (discountAmount > 0) {
    const reasonResult = validateReason(discountReasonCode, discountReason);
    if ("error" in reasonResult) {
      return NextResponse.json({ error: reasonResult.error }, { status: 400 });
    }
    saleDiscountReasonCode = reasonResult.reason;
    saleDiscountNote = reasonResult.reasonNote;
  }

  // Descuentos/cortesías normales (no precio de empleado, que es una
  // política fija y no una decisión del cajero) que superan el
  // límite configurado para su rol necesitan que un gerente/admin
  // autorice reautenticándose en el mismo dispositivo.
  const limitsByRole = await getDiscountLimitsByRole();
  const userMaxPercent = limitsByRole.get(user.role) ?? null;

  let authorizedByManager: { id: string; name: string } | null = null;

  if (userMaxPercent !== null) {
    const itemsOverLimit = resolvedItems.filter((item) => {
      if (item.discountKind !== "DESCUENTO_NORMAL" && item.discountKind !== "CORTESIA") return false;
      if (item.originalUnitPrice === null || item.originalUnitPrice === 0) return false;
      const pct = ((item.originalUnitPrice - item.unitPrice) / item.originalUnitPrice) * 100;
      return pct > userMaxPercent;
    });

    const saleDiscountPct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
    const saleOverLimit = discountAmount > 0 && saleDiscountPct > userMaxPercent;

    if (itemsOverLimit.length > 0 || saleOverLimit) {
      if (!authorization?.managerId || !authorization?.pin) {
        return NextResponse.json(
          {
            error: `Este descuento supera tu límite de ${userMaxPercent}%. Pide a un gerente o administrador que lo autorice.`,
            requiresAuthorization: true,
          },
          { status: 400 }
        );
      }

      const managerResult = await verifyManagerPin(authorization.managerId, authorization.pin);
      if ("error" in managerResult) {
        return NextResponse.json(
          { error: managerResult.error, requiresAuthorization: true },
          { status: 400 }
        );
      }

      authorizedByManager = managerResult;

      for (const item of itemsOverLimit) {
        item.authorizedById = authorizedByManager.id;
      }
    }
  }

  if (total > 0 && payments.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos un método de pago." }, { status: 400 });
  }

  const paymentsTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  if (Math.abs(paymentsTotal - total) > 0.01) {
    return NextResponse.json(
      {
        error: `Los pagos ($${paymentsTotal.toFixed(2)}) no coinciden con el total a cobrar ($${total.toFixed(2)}).`,
      },
      { status: 400 }
    );
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const todayCount = await prisma.posSale.count({
    where: { branchId, createdAt: { gte: dayStart } },
  });

  const code = `POS-${branch.code}-${dayStart.toISOString().slice(0, 10).replace(/-/g, "")}-${String(todayCount + 1).padStart(3, "0")}`;

  const sale = await prisma.$transaction(async (tx) => {
    const createdSale = await tx.posSale.create({
      data: {
        code,
        branchId,
        cashCutId: openCashCut.id,
        soldById: user.id,
        subtotal,
        discountAmount,
        discountReason: saleDiscountNote,
        discountKind: discountAmount > 0 ? "DESCUENTO_NORMAL" : null,
        discountReasonCode: saleDiscountReasonCode,
        employeeBuyerId: employeeBuyer?.id ?? null,
        authorizedById: authorizedByManager?.id ?? null,
        authorizedAt: authorizedByManager ? new Date() : null,
        total,
        items: {
          create: resolvedItems.map((item) => ({
            variantId: item.variantId,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            isCustom: item.isCustom,
            description: item.description,
            discountKind: item.discountKind,
            discountReason: item.discountReason,
            discountReasonNote: item.discountReasonNote,
            originalUnitPrice: item.originalUnitPrice,
            benefitAmount: item.benefitAmount,
            beneficiaryEmployeeId: item.beneficiaryEmployeeId,
            authorizedById: item.authorizedById,
          })),
        },
        payments: {
          create: payments.map((p) => ({
            method: p.method as PaymentMethod,
            amount: Number(p.amount),
          })),
        },
      },
      include: { items: true, payments: true, branch: true },
    });

    // Descuenta del inventario de la sucursal cada ingrediente de
    // los productos compuestos vendidos (no aplica a cobros
    // personalizados, que no tienen receta).
    for (const item of resolvedItems) {
      if (!item.variantId) continue;
      const variant = variantsById.get(item.variantId);
      if (!variant) continue;

      for (const ingredient of variant.ingredients) {
        await tx.inventoryEntry.create({
          data: {
            branchId,
            productId: ingredient.inventoryProductId,
            type: "VENTA_POS",
            quantity: -(Number(ingredient.quantity) * item.quantity),
            notes: `Venta POS ${code}`,
          },
        });
      }
    }

    // Suma los pagos de esta venta al corte de caja abierto de la
    // sucursal — así "Ventas" en el corte queda alimentado por el
    // POS en vez de capturarse a mano.
    for (const payment of payments) {
      await tx.cashSalePayment.upsert({
        where: {
          cashCutId_method: {
            cashCutId: openCashCut.id,
            method: payment.method as PaymentMethod,
          },
        },
        update: { amount: { increment: Number(payment.amount) } },
        create: {
          cashCutId: openCashCut.id,
          method: payment.method as PaymentMethod,
          amount: Number(payment.amount),
        },
      });
    }

    return createdSale;
  });

  return NextResponse.json(sale, { status: 201 });
}
