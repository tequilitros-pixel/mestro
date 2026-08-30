import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRlsContext } from "@/lib/rls";
import { ChevronLeftIcon } from "@/components/ui/icons";
import PrintReceiptButton from "./PrintReceiptButton";

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  DIDI: "DiDi",
  UBER: "Uber",
  RAPPI: "Rappi",
  VALES: "Vales",
  OTRO: "Otro",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export default async function PosReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const sale = await withRlsContext(user, (tx) => tx.posSale.findUnique({
    where: { id },
    include: {
      branch: true,
      soldBy: { select: { id: true, name: true } },
      cancelledBy: { select: { id: true, name: true } },
      items: true,
      payments: true,
      cashCut: { select: { id: true, code: true } },
    },
  }));

  if (!sale) notFound();

  // RLS es defensa en profundidad; la autorización de la aplicación debe
  // cubrir cualquier rol no administrador, incluidos roles actuales o futuros.
  if (user.role !== "ADMIN") {
    const hasAccess = await prisma.userBranch.findFirst({
      where: { userId: user.id, branchId: sale.branchId },
    });
    if (!hasAccess) redirect("/pos/sales");
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 p-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/pos/sales"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Ventas
        </Link>
        <PrintReceiptButton />
      </div>

      <div className="rounded-2xl border border-outline-variant bg-surface-container/60 p-6 font-mono text-sm">
        <div className="mb-4 text-center">
          <p className="text-base font-bold text-on-surface">
            Destiladora del Norte
          </p>
          <p className="text-xs text-on-surface-variant">{sale.branch.name}</p>
        </div>

        <div className="mb-4 space-y-0.5 border-y border-dashed border-outline-variant py-3 text-xs text-on-surface-variant">
          <p>Folio: {sale.code}</p>
          <p>Fecha: {sale.createdAt.toLocaleString("es-MX")}</p>
          <p>Atendió: {sale.soldBy.name}</p>
          {sale.cashCut && <p>Corte: {sale.cashCut.code}</p>}
        </div>

        <div className="mb-4 space-y-2">
          {sale.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-2">
              <span className="text-on-surface">
                {item.quantity}× {item.name}
              </span>
              <span className="shrink-0 text-on-surface">
                {formatCurrency(item.lineTotal)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-dashed border-outline-variant pt-3">
          <div className="flex justify-between text-on-surface-variant">
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discountAmount > 0 && (
            <div className="flex justify-between text-on-surface-variant">
              <span>Descuento{sale.discountReason ? ` (${sale.discountReason})` : ""}</span>
              <span>−{formatCurrency(sale.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-on-surface">
            <span>Total</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
        </div>

        <div className="mt-4 space-y-0.5 border-t border-dashed border-outline-variant pt-3 text-xs">
          {sale.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-on-surface-variant">
              <span>{PAYMENT_LABELS[p.method] ?? p.method}</span>
              <span>{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>

        {sale.status === "CANCELADA" && (
          <div className="mt-4 rounded-xl border border-error/30 bg-error/10 p-3 text-center text-xs text-error">
            <p className="font-bold">VENTA CANCELADA</p>
            {sale.cancelledBy && (
              <p>
                Por {sale.cancelledBy.name}
                {sale.cancelledAt ? ` · ${sale.cancelledAt.toLocaleString("es-MX")}` : ""}
              </p>
            )}
            {sale.cancelReason && <p>Motivo: {sale.cancelReason}</p>}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-on-surface-variant">
          Gracias por su compra
        </p>
      </div>
    </div>
  );
}
