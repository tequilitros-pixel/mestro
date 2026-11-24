import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import EventStatusSelector from "./EventStatusSelector";
import AddCustomItemForm from "./AddCustomItemForm";
import EventDetailTabs from "./EventDetailTabs";
import RecountForm from "./RecountForm";
import MarkFulfilledButton from "./MarkFulfilledButton";
import EventChecklistTable from "./EventChecklistTable";
import AdditionalSupplyForm from "./AdditionalSupplyForm";
import AdditionalReturns from "./AdditionalReturns";
import EventSummary from "./EventSummary";
import { ListChecksIcon } from "@/components/ui/icons";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/dateTime";
import { basePerUnit, buildEventConsumption, reconcileEventReturn, type EventConsumptionItem } from "@/lib/inventory/eventAnalytics";
import { generateOperationId } from "@/lib/pos2/operationId";

function eventBaseUnit(contentUnit: string | null, fallback: string) {
  if (contentUnit === "L" || contentUnit === "ML") return "ML";
  if (contentUnit === "KG" || contentUnit === "G") return "G";
  if (contentUnit === "PIEZAS") return "UNIT";
  const label = fallback.trim().toLowerCase();
  if (["l", "lt", "litro", "litros", "ml", "mililitro", "mililitros"].includes(label)) return "ML";
  if (["kg", "kilogramo", "kilogramos", "g", "gr", "gramo", "gramos"].includes(label)) return "G";
  if (["pza", "pieza", "piezas", "unidad", "unidades"].includes(label)) return "UNIT";
  return fallback;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";

  const event = await prisma.serviceEvent.findUnique({
    where: { id },
    include: {
      package: true,
      equipmentKit: true,
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: true },
      },
      recounts: {
        orderBy: { dayNumber: "desc" },
        include: { items: true },
      },
      addedProducts: {
        orderBy: { addedAt: "asc" },
        include: {
          product: { select: { name: true, category: true, unit: true, itemType: true, inventoryBaseUnit: true } },
          sourceBranch: { select: { name: true } },
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const [products, allowedBranchIds, eventSaleRows] = await Promise.all([
    prisma.inventoryProduct.findMany({
    where: { isActive: true, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, itemType: true, trackStock: true },
    }),
    getAccessibleBranchIds(),
    prisma.eventSaleConsumption.findMany({ where: { eventId: id, reversedAt: null }, select: { productId: true, quantity: true, unit: true, product: { select: { name: true } } } }),
  ]);
  const sourceBranches = await prisma.branch.findMany({
    where: { active: true, ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });


  const stock = new Map<string, {
    productId: string; name: string; unit: string; sent: number; used: number;
    returned: number; damaged: number; compatible: boolean; factor: number; displayUnit: string;
  }>();
  function stockRow(productId: string, name: string, unit: string, factor = 1, displayUnit = unit) {
    const existing = stock.get(productId);
    if (existing) {
      if (existing.unit !== unit) existing.compatible = false;
      return existing;
    }
    const row = { productId, name, unit, factor, displayUnit, sent: 0, used: 0, returned: 0, damaged: 0, compatible: true };
    stock.set(productId, row);
    return row;
  }
  for (const item of event.items) {
    const sent = Number(item.sentQuantity ?? (event.checkoutConfirmedAt ? 0 : item.plannedQuantity));
    if (sent <= 0) continue;
    const presentation = { unit: item.unit, contentPerUnit: Number(item.contentPerUnit), contentUnit: item.contentUnit };
    const unit = eventBaseUnit(item.contentUnit, item.product.inventoryBaseUnit ?? item.unit);
    const factor = basePerUnit(presentation);
    const label = item.handlingUnit?.toLocaleLowerCase("es-MX") ?? item.unit;
    const displayUnit = factor > 1 && item.contentUnit ? `${label} de ${Number(item.contentPerUnit)} ${item.contentUnit.toLowerCase()}` : label;
    const row = stockRow(item.productId, item.productName, unit, factor, displayUnit);
    row.sent += sent * factor;
    row.returned += Number(item.returnedQuantity) * factor + Number(item.returnedOpenQuantity);
    row.damaged += Number(item.damagedQuantity) * factor;
  }
  for (const addition of event.addedProducts) {
    if (addition.status !== "ACTIVO") continue;
    const unit = addition.product?.inventoryBaseUnit ?? eventBaseUnit(addition.contentUnit, addition.product?.unit ?? "Unidad");
    const amount = Number(addition.normalizedQuantity);
    const factor = amount / Number(addition.quantityOriginal);
    const row = stockRow(addition.productId ?? addition.id, addition.product?.name ?? addition.temporaryName ?? "Producto adicional", unit, factor, addition.handlingUnit?.toLowerCase() ?? addition.product?.unit ?? unit);
    row.sent += amount;
    row.returned += Number(addition.returnedQuantity) * factor + Number(addition.returnedOpenQuantity);
  }
  for (const sale of eventSaleRows) {
    const row = stockRow(sale.productId, sale.product.name, sale.unit);
    row.used += Number(sale.quantity);
  }
  const currentStockRows = [...stock.values()].map((row) => {
    const sent = row.sent / row.factor;
    const used = row.used / row.factor;
    const returned = row.returned / row.factor;
    const { expected, difference } = reconcileEventReturn(sent, used, returned);
    return { ...row, sent, used, returned, damaged: row.damaged / row.factor, remaining: expected, difference };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const fmtStock = (value: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 6 }).format(value);
  const stockPanel = (
    <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container p-5">
      <h2 className="text-xl font-bold text-on-surface">Conciliación de inventario del evento</h2>
      <p className="text-sm text-on-surface-variant">
        {event.checkoutConfirmedAt ? "Carga confirmada y adicionales vigentes." : "Carga planeada pendiente de confirmar."} El teórico descuenta las recetas cobradas.
        {event.returnConfirmedAt && " El regreso físico incluye envases cerrados y remanentes abiertos. El descuadre compara el regreso físico con el esperado."}
      </p>
      <div className="max-h-96 overflow-auto rounded-xl border border-outline-variant">
        <table className="w-full min-w-[540px] text-sm">
          <thead className="sticky top-0 bg-surface-container-high text-on-surface-variant">
            <tr><th className="p-3 text-left">Producto</th><th className="p-3 text-right">Enviado al evento</th><th className="p-3 text-right">Consumo POS</th><th className="p-3 text-right">Regreso esperado</th>{event.returnConfirmedAt && <><th className="p-3 text-right">Regreso físico</th><th className="p-3 text-right">Dañado</th><th className="p-3 text-right">Descuadre</th></>}</tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {currentStockRows.map((row) => (
              <tr key={row.productId}>
                <td className="p-3 font-medium">{row.name}<p className="text-xs text-on-surface-variant">{row.displayUnit}</p></td>
                <td className="p-3 text-right">{row.compatible ? fmtStock(row.sent) : "Revisar unidad"}</td>
                <td className="p-3 text-right">{row.compatible ? fmtStock(row.used) : "Revisar unidad"}</td>
                <td className={`p-3 text-right font-bold ${row.remaining < 0 ? "text-error" : "text-on-surface"}`}>{row.compatible ? fmtStock(row.remaining) : "Pendiente"}</td>
                {event.returnConfirmedAt && <>
                  <td className="p-3 text-right">{row.compatible ? fmtStock(row.returned) : "—"}</td>
                  <td className="p-3 text-right">{row.compatible ? fmtStock(row.damaged) : "—"}</td>
                  <td className="p-3 text-right font-bold">{!row.compatible ? "Revisar unidad" : row.remaining < 0 ? `Revisar carga: el POS la supera por ${fmtStock(-row.remaining)} (${row.displayUnit})` : row.difference === 0 ? "Cuadra" : `${row.difference < 0 ? "Faltante" : "Sobrante"} de ${fmtStock(Math.abs(row.difference))} (${row.displayUnit})`}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const consumableProducts = products.filter((p) => p.itemType !== "EQUIPMENT");
  const equipmentProducts = products.filter((p) => p.itemType === "EQUIPMENT");

  const sentCount = event.items.filter((i) => i.checkedOut).length;
  const returnedCount = event.items.filter((i) => i.checkedIn).length;
  const activeAdditions = event.addedProducts.filter((addition) => addition.status === "ACTIVO");
  const additionalPendingReturns = activeAdditions.filter((addition) => addition.sourceType === "ENVIO_SUCURSAL" && !addition.returnBranchId).length;
  const pendingReturns = Math.max(sentCount - returnedCount, 0) + additionalPendingReturns;

  const consumptionItems: EventConsumptionItem[] = [
    ...event.items.filter((item) => item.checkedOut && item.checkedIn).map((item) => ({
      productId: item.productId,
      name: item.productName,
      category: item.product.category,
      unit: item.unit,
      itemType: item.itemType,
      sent: Number(item.sentQuantity ?? item.plannedQuantity),
      returned: item.checkedIn ? Number(item.returnedQuantity ?? 0) : 0,
      damaged: item.checkedIn ? Number(item.damagedQuantity) : 0,
      returnedOpenBase: item.checkedIn ? Number(item.returnedOpenQuantity ?? 0) : 0,
      contentPerUnit: item.contentPerUnit === null ? null : Number(item.contentPerUnit),
      contentUnit: item.contentUnit,
      unitCost: item.unitCost === null ? null : Number(item.unitCost),
    })),
    ...activeAdditions.filter((addition) => addition.returnBranchId || (event.returnConfirmedAt && addition.sourceType !== "ENVIO_SUCURSAL")).map((addition) => ({
      productId: addition.productId ?? addition.id,
      name: addition.product?.name ?? addition.temporaryName ?? "Producto adicional",
      category: addition.product?.category ?? addition.temporaryCategory ?? "Sin categoría",
      unit: addition.product?.unit ?? addition.handlingUnit?.toLocaleLowerCase("es-MX") ?? "unidades",
      itemType: addition.product?.itemType ?? "CONSUMABLE",
      sent: Number(addition.quantityOriginal),
      normalizedPerUnit: Number(addition.normalizedQuantity) / Number(addition.quantityOriginal),
      returned: addition.returnBranchId ? Number(addition.returnedQuantity) : 0,
      damaged: 0,
      returnedOpenBase: addition.returnBranchId ? Number(addition.returnedOpenQuantity ?? 0) : 0,
      contentPerUnit: addition.contentPerUnit === null ? null : Number(addition.contentPerUnit),
      contentUnit: addition.contentUnit,
      unitCost: addition.totalCost === null ? null : Number(addition.totalCost) / Number(addition.quantityOriginal),
    })),
  ];
  const consumption = buildEventConsumption(consumptionItems);

  const totalConsumedCost = consumption.reduce((sum, item) => sum + item.consumedCost, 0);
  const costComplete = consumption.every((item) => item.costKnown);

  const saleAmount = event.saleAmount !== null ? Number(event.saleAmount) : null;
  const utility = saleAmount !== null && event.returnConfirmedAt && costComplete ? saleAmount - totalConsumedCost : null;

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
              {event.location} · {formatBusinessDateTime(event.eventDate)} ·{" "}
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
          <p className="text-xs text-on-surface-variant">Costo estimado de insumos con regreso capturado</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">
            ${totalConsumedCost.toFixed(2)}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <p className="text-xs text-on-surface-variant">Venta menos insumos</p>
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
        isAdmin={isAdmin}
      />

      {activeAdditions.length > 0 && (
        <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <h3 className="font-semibold text-on-surface">Cargas adicionales</h3>
          <div className="mt-3 divide-y divide-outline-variant">
            {activeAdditions.map((addition) => (
              <div key={addition.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="font-medium text-on-surface">{addition.product?.name ?? addition.temporaryName ?? "Producto adicional"}</span>
                <span className="text-on-surface-variant">+{Number(addition.quantityOriginal)} {addition.product?.unit ?? "unidades"} · {addition.sourceBranch?.name ?? "Origen externo"} · {formatBusinessDateTime(addition.addedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {event.checkoutConfirmedAt && !event.returnConfirmedAt && (
        <AdditionalSupplyForm
          eventId={event.id}
          operationId={generateOperationId()}
          products={products.filter((product) => product.itemType !== "EQUIPMENT" && product.trackStock).map(({ id, name, unit }) => ({ id, name, unit }))}
          branches={sourceBranches}
        />
      )}

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
    <section className="space-y-4">
      <AdditionalReturns
        eventId={event.id}
        locked={Boolean(event.returnConfirmedAt)}
        rows={activeAdditions.filter((addition) => addition.sourceType === "ENVIO_SUCURSAL").map((addition) => ({
          id: addition.id,
          productName: addition.product?.name ?? addition.temporaryName ?? "Producto adicional",
          unit: addition.product?.unit ?? "unidades",
          sourceBranchName: addition.sourceBranch?.name ?? "Sucursal no disponible",
          quantity: Number(addition.quantityOriginal),
          returned: Number(addition.returnedQuantity),
          returnedOpen: Number(addition.returnedOpenQuantity ?? 0),
          contentPerUnit: addition.contentPerUnit === null ? null : Number(addition.contentPerUnit),
          contentUnit: addition.contentUnit,
          captured: Boolean(addition.returnBranchId),
          operationId: generateOperationId(),
        }))}
      />
      <EventChecklistTable
        eventId={event.id}
        phase="regreso"
        items={event.items.map(toRowItem)}
        confirmed={Boolean(event.returnConfirmedAt)}
        isAdmin={isAdmin}
        additionalPendingReturns={additionalPendingReturns}
      />
    </section>
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
                      {formatBusinessDate(recount.countDate)} · {missingCount}{" "}
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
          resumen={<div className="space-y-6">{stockPanel}<EventSummary rows={consumption} saleAmount={saleAmount} complete={Boolean(event.returnConfirmedAt)} pendingReturns={pendingReturns} /></div>}
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
