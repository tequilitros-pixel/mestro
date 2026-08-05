import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "./PrintButton";
import MarkFulfilledButton from "../../MarkFulfilledButton";

export default async function RecountDetailPage({
  params,
}: {
  params: Promise<{ id: string; recountId: string }>;
}) {
  const { id, recountId } = await params;

  const recount = await prisma.eventRecount.findUnique({
    where: { id: recountId },
    include: {
      event: { select: { id: true, clientName: true, location: true, eventDate: true } },
      items: {
        include: { eventItem: { select: { productName: true, unit: true } } },
      },
    },
  });

  if (!recount || recount.event.id !== id) {
    notFound();
  }

  const items = recount.items
    .map((item) => ({
      id: item.id,
      productName: item.eventItem.productName,
      unit: item.eventItem.unit,
      counted: Number(item.countedQuantity),
      missing: Number(item.missingQuantity),
    }))
    .sort((a, b) => b.missing - a.missing);

  const missingItems = items.filter((item) => item.missing > 0);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface print:bg-white print:px-0 print:py-0 print:text-black">
      <div className="mx-auto max-w-3xl space-y-6 print:max-w-full print:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={`/administration/inventory/events/${id}`}
            className="text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            ← {recount.event.clientName}
          </Link>

          <div className="flex items-center gap-2">
            <PrintButton />
            {recount.status === "PENDIENTE" && (
              <MarkFulfilledButton recountId={recount.id} eventId={id} />
            )}
          </div>
        </div>

        <div className="print:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant print:text-neutral-500">
            Lista de resurtido · Día {recount.dayNumber}
          </p>
          <h1 className="mt-1 text-3xl font-bold print:text-black">{recount.event.clientName}</h1>
          <p className="mt-2 text-sm text-on-surface-variant print:text-neutral-600">
            {recount.event.location} ·{" "}
            {new Date(recount.event.eventDate).toLocaleDateString("es-MX")} · Reconteo del{" "}
            {new Date(recount.countDate).toLocaleDateString("es-MX")}
          </p>

          <span
            className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold print:hidden ${
              recount.status === "SURTIDO"
                ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
                : "bg-secondary/20 text-secondary"
            }`}
          >
            {recount.status === "SURTIDO" ? "Surtido" : "Pendiente de surtir"}
          </span>

          {recount.notes && (
            <p className="mt-3 text-sm text-on-surface-variant print:text-neutral-600">
              Notas: {recount.notes}
            </p>
          )}
        </div>

        <section className="rounded-2xl border border-outline-variant bg-surface-container print:rounded-none print:border-0 print:bg-white">
          <div className="p-5 pb-0 print:px-6">
            <h2 className="text-lg font-bold text-on-surface print:text-black">
              Falta traer ({missingItems.length})
            </h2>
          </div>

          <div className="overflow-x-auto p-5 print:px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-on-surface-variant print:text-neutral-600">
                  <th className="px-2 py-2">Producto</th>
                  <th className="px-2 py-2 text-right">Cantidad a traer</th>
                </tr>
              </thead>
              <tbody>
                {missingItems.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-2 py-6 text-center text-on-surface-variant">
                      No falta nada por traer según este reconteo.
                    </td>
                  </tr>
                )}
                {missingItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-outline-variant print:border-neutral-300"
                  >
                    <td className="px-2 py-3 font-medium print:text-black">{item.productName}</td>
                    <td className="px-2 py-3 text-right font-semibold text-error print:text-black">
                      {item.missing} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface-container print:hidden">
          <div className="p-5 pb-0">
            <h2 className="text-sm font-semibold text-on-surface-variant">
              Detalle completo del reconteo
            </h2>
          </div>

          <div className="overflow-x-auto p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-on-surface-variant">
                  <th className="px-2 py-2">Producto</th>
                  <th className="px-2 py-2 text-right">Contado hoy</th>
                  <th className="px-2 py-2 text-right">Falta</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-outline-variant">
                    <td className="px-2 py-3">{item.productName}</td>
                    <td className="px-2 py-3 text-right">
                      {item.counted} {item.unit}
                    </td>
                    <td
                      className={`px-2 py-3 text-right ${
                        item.missing > 0 ? "font-semibold text-error" : "text-on-surface-variant"
                      }`}
                    >
                      {item.missing} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
