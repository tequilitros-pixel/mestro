"use client";

import { useMemo } from "react";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import type { PosSaleTransaction } from "./TurnTransactionsLive";

const formatMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

interface ConsumedIngredient {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export function TurnInventoryConsumption({
  sales,
  totalSales,
  totalOutflows,
}: {
  sales: PosSaleTransaction[];
  totalSales: number;
  totalOutflows: number;
}) {
  const completedSales = useMemo(
    () => sales.filter((s) => s.status === "COMPLETADA"),
    [sales]
  );

  // Consolidar insumos por receta
  const { consumedIngredients, totalCogs } = useMemo(() => {
    const map = new Map<string, ConsumedIngredient>();

    for (const sale of completedSales) {
      for (const item of sale.items) {
        if (!item.variant?.ingredients) continue;

        for (const ing of item.variant.ingredients) {
          const invProd = ing.inventoryProduct;
          if (!invProd) continue;

          const key = `${invProd.id}:${ing.unit ?? invProd.unit}`;
          const qty = Number(ing.quantity) * item.quantity;
          const unitCost = Number(invProd.unitCost ?? 0);

          const existing = map.get(key);
          if (existing) {
            existing.quantity += qty;
            existing.totalCost += qty * unitCost;
          } else {
            map.set(key, {
              id: invProd.id,
              code: invProd.code,
              name: invProd.name,
              unit: ing.unit ?? invProd.unit,
              quantity: qty,
              unitCost,
              totalCost: qty * unitCost,
            });
          }
        }
      }
    }

    const list = [...map.values()].sort((a, b) => b.totalCost - a.totalCost || a.name.localeCompare(b.name));
    const cogs = list.reduce((sum, item) => sum + item.totalCost, 0);

    return { consumedIngredients: list, totalCogs: cogs };
  }, [completedSales]);

  // Consolidar productos terminados vendidos
  const productRows = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; total: number }>();
    for (const sale of completedSales) {
      for (const item of sale.items) {
        const name = item.description || item.name;
        const current = map.get(name) ?? { name, quantity: 0, total: 0 };
        current.quantity += item.quantity;
        current.total += item.lineTotal;
        map.set(name, current);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [completedSales]);

  const netGrossMargin = totalSales - totalCogs - totalOutflows;
  const marginPercent = totalSales > 0 ? (netGrossMargin / totalSales) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Resumen Financiero del Turno */}
      <section aria-label="Rentabilidad del turno">
        <h2 className="text-base font-bold text-on-surface mb-2">Rentabilidad e Insumos del Turno</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card highlight>
            <CardLabel>Ventas Totales</CardLabel>
            <CardValue>{formatMoney(totalSales)}</CardValue>
          </Card>
          <Card>
            <CardLabel>Costo Teórico (COGS)</CardLabel>
            <CardValue className="text-amber-600 dark:text-amber-400">
              {formatMoney(totalCogs)}
            </CardValue>
          </Card>
          <Card>
            <CardLabel>Salidas de Caja</CardLabel>
            <CardValue className="text-error">{formatMoney(totalOutflows)}</CardValue>
          </Card>
          <Card highlight>
            <CardLabel>Margen Operativo Bruto</CardLabel>
            <CardValue className={netGrossMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-error"}>
              {formatMoney(netGrossMargin)}{" "}
              <span className="text-xs font-normal">({marginPercent.toFixed(1)}%)</span>
            </CardValue>
          </Card>
        </div>
      </section>

      {/* Tabla de Insumos Consumidos por Receta */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-bold text-on-surface">Insumos y Materias Primas Consumidas</h3>
            <p className="text-xs text-on-surface-variant">
              Deducidos automáticamente de las recetas de POSpress al cobrar cada ticket.
            </p>
          </div>
          <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-bold text-on-surface">
            {consumedIngredients.length} insumos
          </span>
        </div>

        {consumedIngredients.length === 0 ? (
          <Card>
            <p className="text-xs text-on-surface-variant text-center py-4">
              No hay recetas vinculadas a los productos vendidos en este turno, o aún no hay tickets cobrados.
            </p>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-outline-variant/60 text-xs">
              <div className="grid grid-cols-12 pb-2 font-bold text-on-surface-variant uppercase text-[10px] tracking-wider">
                <span className="col-span-5">Insumo</span>
                <span className="col-span-3 text-right">Consumo Teórico</span>
                <span className="col-span-2 text-right">Costo Unit.</span>
                <span className="col-span-2 text-right">Costo Total</span>
              </div>
              {consumedIngredients.map((ing) => (
                <div key={ing.id} className="grid grid-cols-12 py-2 items-center first:pt-2">
                  <div className="col-span-5">
                    <p className="font-semibold text-on-surface">{ing.name}</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">{ing.code}</p>
                  </div>
                  <div className="col-span-3 text-right font-mono font-bold text-on-surface">
                    {ing.quantity.toLocaleString("es-MX", { maximumFractionDigits: 3 })} {ing.unit}
                  </div>
                  <div className="col-span-2 text-right font-mono text-on-surface-variant">
                    {ing.unitCost > 0 ? formatMoney(ing.unitCost) : "—"}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-on-surface">
                    {ing.totalCost > 0 ? formatMoney(ing.totalCost) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Productos Terminados Vendidos */}
      <section>
        <h3 className="text-sm font-bold text-on-surface mb-2">Productos Vendidos en el Turno</h3>
        {productRows.length === 0 ? (
          <Card>
            <p className="text-xs text-on-surface-variant text-center py-4">
              Sin productos registrados desde el Punto de Venta en este corte.
            </p>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-outline-variant/60 text-xs">
              {productRows.map((prod) => (
                <div key={prod.name} className="flex justify-between py-2 first:pt-0 last:pb-0 items-center">
                  <div>
                    <p className="font-semibold text-on-surface">{prod.name}</p>
                    <p className="text-[11px] text-on-surface-variant">{prod.quantity} unidad(es)</p>
                  </div>
                  <span className="font-bold text-on-surface">{formatMoney(prod.total)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
