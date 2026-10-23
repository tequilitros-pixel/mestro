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
  let body: { email?: string };

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

  // Las ventas sin conexión conservan el correo en cola hasta que la venta
  // exista en el servidor. No aceptamos un ticket aportado por el cliente:
  // los importes y el contenido del correo siempre salen de la venta auditada.
  return NextResponse.json(
    { error: "La venta aún no está confirmada. El recibo se enviará al sincronizarla." },
    { status: 409 },
  );
}
