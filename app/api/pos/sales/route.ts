import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { PaymentMethod } from "@prisma/client";

const ROLES_QUE_PUEDEN_VENDER = ["ADMIN", "GERENTE", "ENCARGADO"];

type CartItemInput =
  | { variantId: string; quantity: number; isCustom?: false }
  | {
      isCustom: true;
      description: string;
      amount: number;
      quantity?: number;
    };

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
    payments,
  }: {
    branchId?: string;
    items?: CartItemInput[];
    discountAmount?: number;
    discountReason?: string;
    payments?: { method: string; amount: number }[];
  } = body;

  if (!branchId) {
    return NextResponse.json({ error: "Selecciona la sucursal." }, { status: 400 });
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

  if (!Array.isArray(payments) || payments.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos un método de pago." }, { status: 400 });
  }

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

  type ResolvedItem = {
    variantId: string | null;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    isCustom: boolean;
    description: string | null;
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

    resolvedItems.push({
      variantId: variant.id,
      name: label,
      unitPrice: variant.price,
      quantity,
      lineTotal: variant.price * quantity,
      isCustom: false,
      description: null,
    });
  }

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const discountAmount = Math.min(
    Math.max(Number(rawDiscountAmount) || 0, 0),
    subtotal
  );
  const total = subtotal - discountAmount;

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
        discountReason: discountAmount > 0 ? (discountReason?.trim() || null) : null,
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
