import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EventStatusSelector from "./EventStatusSelector";
import AddCustomItemForm from "./AddCustomItemForm";
import EventDetailTabs from "./EventDetailTabs";
import RecountForm from "./RecountForm";
import MarkFulfilledButton from "./MarkFulfilledButton";
import EventChecklistTable from "./EventChecklistTable";
import { ListChecksIcon } from "@/components/ui/icons";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await prisma.serviceEvent.findUnique({
    where: { id },
    include: {
      package: true,
      equipmentKit: true,
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: { select: { category: true, code: true } } },
      },
      recounts: {
        orderBy: { dayNumber: "desc" },
        include: { items: true },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const products = await prisma.inventoryProduct.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, itemType: true },
  });

  const consumableProducts = products.filter((p) => p.itemType !== "EQUIPMENT");
  const equipmentProducts = products.filter((p) => p.itemType === "EQUIPMENT");

  const totalItems = event.items.length;
  const sentCount = event.items.filter((i) => i.checkedOut).length;
  const returnedCount = event.items.filter((i) => i.checkedIn).length;
  const pendingReturns = Math.max(sentCount - returnedCount, 0);

  const totalConsumedCost = event.items.reduce((sum, item) => {
    if (item.itemType === "EQUIPMENT") return sum;
    const sent =
      item.sentQuantity !== null ? Number(item.sentQuantity) : Number(item.plannedQuantity);
    const returned = item.returnedQuantity !== null ? Number(item.returnedQuantity) : 0;
    const damaged = Number(item.damagedQuantity);
    const consumed = Math.max(sent - returned - damaged, 0);
    const cost = item.unitCost !== null ? consumed * Number(item.unitCost) : 0;
    return sum + cost;
  }, 0);

  const saleAmount = event.saleAmount !== null ? Number(event.saleAmount) : null;
  const utility = saleAmount !== null ? saleAmount - totalConsumedCost : null;

  function toRowItem(item: NonNullable<typeof event>["items"][number]) {
    return {
      id: item.id,
      productName: item.productName,
      unit: item.unit,
      plannedQuantity: Number(item.plannedQuantity),
      sentQuantity: item.sentQuantity !== null ? Number(item.sentQuantity) : null,
      returnedQuantity:
        item.returnedQuantity !== null ? Number(item.returnedQuantity) : null,
      damagedQuantity: Number(item.damagedQuantity),
      returnedOpenQuantity:
        item.returnedOpenQuantity !== null ? Number(item.returnedOpenQuantity) : null,
      checkedOut: item.checkedOut,
      checkedIn: item.checkedIn,
      isCustom: item.isCustom,
      handlingUnit: item.handlingUnit,
      contentPerUnit: item.contentPerUnit !== null ? Number(item.contentPerUnit) : null,
      contentUnit: item.contentUnit,
      itemType: item.itemType,
      category: item.product.category,
      productCode: item.product.code,
    };
  }

  // Insumos ya subidos al evento (consumibles) — son los únicos que
  // tiene sentido recontar día a día.
  const recountableItems = event.items
    .filter((item) => item.checkedOut && item.itemType !== "EQUIPMENT")
    .map((item) => ({ id: item.id, productName: item.productName, unit: item.unit }));

  const nextDayNumber = (event.recounts[0]?.dayNumber ?? 0) + 1;
  const pendingRecounts = event.recounts.filter((r) => r.status === "PENDIENTE").length;

  const datosTab = (
    <div className="space-y-6">
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">{event.clientName}</h2>
            {event.clientPhone && (
              <p className="mt-1 text-sm text-on-surface-variant">{event.clientPhone}</p>
            )}
            <p className="mt-2 text-on-surface-variant">
              {event.location} · {new Date(event.eventDate).toLocaleString("es-MX")} ·{" "}
              {event.guestCount} invitados
            </p>
            <p className="mt-1 text-sm text-outline">
              {event.package ? event.package.name : "Sin paquete"} ·{" "}
              {event.equipmentKit ? event.equipmentKit.name : "Sin modalidad"}
            </p>
            {event.notes && (
              <p className="mt-3 text-sm text-on-surface-variant">Notas: {event.notes}</p>
            )}
          </div>

          <EventStatusSelector eventId={event.id} currentStatus={event.status} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <p className="text-xs text-on-surface-variant">Venta</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">
            {saleAmount !== null ? `$${saleAmount.toFixed(2)}` : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <p className="text-xs text-on-surface-variant">Costo consumido</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">
            ${totalConsumedCost.toFixed(2)}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <p className="text-xs text-on-surface-variant">Utilidad</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              utility !== null && utility < 0 ? "text-error" : "text-tertiary-fixed-dim"
            }`}
          >
            {utility !== null ? `$${utility.toFixed(2)}` : "—"}
          </p>
        </div>
      </div>
    </div>
  );

  const salidaTab = (
    <section className="space-y-4">
      <EventChecklistTable
        eventId={event.id}
        phase="salida"
        items={event.items.map(toRowItem)}
        confirmed={Boolean(event.checkoutConfirmedAt)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <AddCustomItemForm
          eventId={event.id}
          products={consumableProducts}
          title="Agregar consumible"
        />
        <AddCustomItemForm
          eventId={event.id}
          products={equipmentProducts}
          title="Agregar equipo"
        />
      </div>
    </section>
  );

  const regresoTab = (
    <EventChecklistTable
      eventId={event.id}
      phase="regreso"
      items={event.items.map(toRowItem)}
      confirmed={Boolean(event.returnConfirmedAt)}
    />
  );

  const reconteoTab = (
    <section className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-on-surface">
          <ListChecksIcon className="h-5 w-5 text-on-surface-variant" />
          Reconteo rápido
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Para eventos de varios días: cuenta lo que queda cada día y genera la lista de lo que
          hay que traer.
        </p>
      </div>

      <RecountForm eventId={event.id} items={recountableItems} nextDayNumber={nextDayNumber} />

      {event.recounts.length > 0 && (
        <div className="rounded-2xl border border-outline-variant bg-surface-container">
          <div className="p-5 pb-0">
            <h3 className="text-sm font-semibold text-on-surface-variant">
              Historial de reconteos
            </h3>
          </div>

          <div className="divide-y divide-outline-variant p-5">
            {event.recounts.map((recount) => {
              const missingCount = recount.items.filter(
                (i) => Number(i.missingQuantity) > 0,
              ).length;

              return (
                <div
                  key={recount.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium text-on-surface">Día {recount.dayNumber}</p>
                    <p className="text-sm text-on-surface-variant">
                      {new Date(recount.countDate).toLocaleDateString("es-MX")} · {missingCount}{" "}
                      producto{missingCount === 1 ? "" : "s"} por traer
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        recount.status === "SURTIDO"
                          ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
                          : "bg-secondary/20 text-secondary"
                      }`}
                    >
                      {recount.status === "SURTIDO" ? "Surtido" : "Pendiente"}
                    </span>

                    <Link
                      href={`/administration/inventory/events/${event.id}/recount/${recount.id}`}
                      className="text-sm font-semibold text-on-surface-variant hover:text-on-surface"
                    >
                      Ver lista
                    </Link>

                    {recount.status === "PENDIENTE" && (
                      <MarkFulfilledButton recountId={recount.id} eventId={event.id} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/administration/inventory/events"
          className="inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
        >
          ← Eventos
        </Link>

        <EventDetailTabs
          datos={datosTab}
          salida={salidaTab}
          regreso={regresoTab}
          reconteo={reconteoTab}
          pendingReturns={pendingReturns}
          pendingRecounts={pendingRecounts}
        />
      </div>
    </main>
  );
}
