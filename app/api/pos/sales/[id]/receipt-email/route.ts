import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithAnyModuleAccess } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { sendSaleReceiptEmail } from "@/lib/email";
import { formatBusinessDateTime } from "@/lib/dateTime";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserWithAnyModuleAccess(["/pos", "/pos/sales"]);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  let body: {
    email?: string;
    fallbackReceipt?: {
      saleCode: string;
      branchName: string;
      branchAddress?: string | null;
      date: string;
      cashierName?: string | null;
      items: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }>;
      subtotal: number;
      discountAmount: number;
      total: number;
      payments: Array<{
        method: string;
        amount: number;
      }>;
      change?: number | null;
    };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Ingresa un correo electrónico válido." }, { status: 400 });
  }

  // 1. Intenta encontrar la venta en base de datos
  const sale = await withRlsContext(user, (tx) =>
    tx.posSale.findUnique({
      where: { id },
      include: {
        branch: true,
        soldBy: { select: { id: true, name: true } },
        items: true,
        payments: true,
      },
    })
  );

  if (sale) {
    if (user.role !== "ADMIN") {
      const hasAccess = await prisma.userBranch.findFirst({
        where: { userId: user.id, branchId: sale.branchId },
      });
      if (!hasAccess) {
        return NextResponse.json({ error: "No autorizado para esta sucursal" }, { status: 403 });
      }
    }

    try {
      await sendSaleReceiptEmail({
        to: email,
        saleCode: sale.code,
        branchName: sale.branch.name,
        branchAddress: sale.branch.address,
        date: formatBusinessDateTime(sale.createdAt),
        cashierName: sale.soldBy.name,
        items: sale.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        total: sale.total,
        payments: sale.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
        })),
      });

      return NextResponse.json({
        success: true,
        message: `Ticket enviado a ${email}`,
      });
    } catch (err) {
      console.error("Error sending receipt email:", err);
      return NextResponse.json(
        { error: "No fue posible enviar el correo. Revisa la configuración del servicio." },
        { status: 500 }
      );
    }
  }

  // 2. Si es una venta local/offline y trae fallbackReceipt
  if (body.fallbackReceipt) {
    const f = body.fallbackReceipt;
    try {
      await sendSaleReceiptEmail({
        to: email,
        saleCode: f.saleCode,
        branchName: f.branchName,
        branchAddress: f.branchAddress,
        date: f.date,
        cashierName: f.cashierName ?? user.name,
        items: f.items,
        subtotal: f.subtotal,
        discountAmount: f.discountAmount,
        total: f.total,
        payments: f.payments,
        change: f.change,
      });

      return NextResponse.json({
        success: true,
        message: `Ticket enviado a ${email}`,
      });
    } catch (err) {
      console.error("Error sending offline receipt email:", err);
      return NextResponse.json(
        { error: "No fue posible enviar el correo." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Venta no encontrada." }, { status: 404 });
}
