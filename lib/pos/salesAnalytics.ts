export type ProductAnalyticsItem = {
  name: string;
  quantity: number;
  lineTotal: number;
  isCustom: boolean;
  productId: string | null;
  productName: string | null;
};

export type ProductAnalyticsSale = {
  items: ProductAnalyticsItem[];
};

export type ProductSalesTotal = {
  key: string;
  name: string;
  units: number;
  total: number;
};

/**
 * Cuenta productos de catálogo por unidades. Los cobros personalizados son
 * líneas de una transacción, no productos, y se excluyen de este reporte.
 */
export function aggregateProductSales(
  sales: ProductAnalyticsSale[],
): ProductSalesTotal[] {
  const totals = new Map<string, ProductSalesTotal>();

  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.isCustom) continue;

      // Las ventas históricas conservan el nombre capturado aunque la relación
      // de catálogo ya no esté disponible.
      const key = item.productId ?? `snapshot:${item.name}`;
      const current = totals.get(key) ?? {
        key,
        name: item.productName ?? item.name,
        units: 0,
        total: 0,
      };

      current.units += item.quantity;
      current.total += item.lineTotal;
      totals.set(key, current);
    }
  }

  return Array.from(totals.values()).sort(
    (a, b) =>
      b.units - a.units ||
      b.total - a.total ||
      a.name.localeCompare(b.name, "es"),
  );
}
