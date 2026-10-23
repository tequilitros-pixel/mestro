import { aggregateProductSales } from "@/lib/pos/salesAnalytics";
import { formatBusinessDateOnly, parseDateOnly } from "@/lib/dateOnly";

export type BranchSaleRow = {
  total: number;
  createdAt: Date;
  payments: Array<{ method: string; amount: number }>;
  items: Array<{
    name: string;
    quantity: number;
    lineTotal: number;
    isCustom: boolean;
    variant: { product: { id: string; name: string } } | null;
  }>;
};

export type BranchSalesOverview = {
  total: number;
  saleCount: number;
  averageTicket: number;
  units: number;
  productCount: number;
  products: Array<{ key: string; name: string; units: number; total: number }>;
  payments: Array<{ method: string; label: string; amount: number }>;
  daily: Array<{ date: string; label: string; total: number; saleCount: number }>;
};

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

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(parseDateOnly(date)).replace(".", "");
}

/** Construye el desglose del tablero de ventas para una sucursal y periodo. */
export function summarizeBranchSales(sales: BranchSaleRow[]): BranchSalesOverview {
  const total = sales.reduce((sum, sale) => sum + sale.total, 0);
  const products = aggregateProductSales(sales.map((sale) => ({
    items: sale.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      isCustom: item.isCustom,
      productId: item.variant?.product.id ?? null,
      productName: item.variant?.product.name ?? null,
    })),
  })));
  const paymentTotals = new Map<string, number>();
  const dailyTotals = new Map<string, { total: number; saleCount: number }>();

  for (const sale of sales) {
    for (const payment of sale.payments) {
      paymentTotals.set(payment.method, (paymentTotals.get(payment.method) ?? 0) + payment.amount);
    }
    const date = formatBusinessDateOnly(sale.createdAt);
    const current = dailyTotals.get(date) ?? { total: 0, saleCount: 0 };
    current.total += sale.total;
    current.saleCount += 1;
    dailyTotals.set(date, current);
  }

  return {
    total,
    saleCount: sales.length,
    averageTicket: sales.length ? total / sales.length : 0,
    units: products.reduce((sum, product) => sum + product.units, 0),
    productCount: products.length,
    products,
    payments: [...paymentTotals]
      .map(([method, amount]) => ({ method, label: PAYMENT_LABELS[method] ?? method, amount }))
      .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, "es")),
    daily: [...dailyTotals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, label: dateLabel(date), ...value })),
  };
}
