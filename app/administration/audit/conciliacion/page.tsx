import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Excepciones de conciliación verificables. Solo consulta de producción:
 * no modifica movimientos, pagos, inventario ni precios.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CashException = {
  id: string;
  code: string;
  branch: string;
  closedAt: Date | null;
  stored: number;
  paid: number;
  pos: number;
};
type EarlySale = { id: string; code: string; cashCutId: string; branch: string; createdAt: Date; openedAt: Date; total: number };
type CountException = {
  id: string;
  code: string;
  branch: string;
  countDate: Date;
  changedProducts: number;
};
type MovementException = {
  id: string;
  product: string;
  branch: string;
  unit: string;
  quantityDelta: unknown;
  movementType: string;
  createdAt: Date;
};
type UnpricedProduct = {
  id: string;
  name: string;
  code: string;
  category: string;
  stockBranches: bigint;
};

const currency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
const date = (value: Date | null) =>
  value ? new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium" }).format(value) : "—";

export default async function ReconciliationAuditPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  const cashExceptions = await prisma.$queryRaw<CashException[]>`
    WITH cash_paid AS (
      SELECT "cashCutId", SUM(amount) AS paid FROM "CashSalePayment" GROUP BY "cashCutId"
    ), pos AS (
      SELECT "cashCutId", SUM(total) FILTER (WHERE status='COMPLETADA') AS sold
      FROM "PosSale" GROUP BY "cashCutId"
    )
    SELECT c.id,c.code,b.name AS branch,c."closedAt",
      COALESCE(c."totalSales",0)::float8 AS stored,
      COALESCE(cp.paid,0)::float8 AS paid,
      COALESCE(pos.sold,0)::float8 AS pos
    FROM "CashCut" c JOIN "Branch" b ON b.id=c."branchId"
    LEFT JOIN cash_paid cp ON cp."cashCutId"=c.id
    LEFT JOIN pos ON pos."cashCutId"=c.id
    WHERE c.status='CERRADO'
      AND (ABS(COALESCE(c."totalSales",0)-COALESCE(cp.paid,0))>.02
        OR COALESCE(pos.sold,0)>COALESCE(cp.paid,0)+.02)
    ORDER BY ABS(COALESCE(c."totalSales",0)-COALESCE(cp.paid,0)) DESC
    LIMIT 60
  `;

  const countExceptions = await prisma.$queryRaw<CountException[]>`
    SELECT c.id,c.code,b.name AS branch,c."countDate",
      COUNT(*)::integer AS "changedProducts"
    FROM "InventoryCount" c
    JOIN "Branch" b ON b.id=c."branchId"
    JOIN "InventoryCountItem" i ON i."countId"=c.id
    JOIN "InventoryMovement" m ON m."branchId"=c."branchId"
      AND m."inventoryProductId"=i."productId"
      AND m."createdAt">i."countedAt" AND m."createdAt"<c."closedAt"
      AND m."sourceId"<>c.id
    WHERE c.status='CERRADO'
    GROUP BY c.id,b.name,i."productId"
    HAVING SUM(m."quantityDelta")<>0
  `.then((rows) => {
    // La consulta retorna una partida por producto. Consolidar por conteo.
    const grouped = new Map<string, CountException>();
    for (const row of rows) {
      const previous = grouped.get(row.id);
      if (previous) previous.changedProducts += 1;
      else grouped.set(row.id, { ...row, changedProducts: 1 });
    }
    return [...grouped.values()].sort((a,b) => b.countDate.getTime()-a.countDate.getTime());
  });

  const extraordinaryMovements = await prisma.$queryRaw<MovementException[]>`
    SELECT m.id,p.name AS product,b.name AS branch,m."movementType"::text AS "movementType",
      m.unit::text AS unit,m."quantityDelta",m."createdAt"
    FROM "InventoryMovement" m
    JOIN "InventoryProduct" p ON p.id=m."inventoryProductId"
    JOIN "Branch" b ON b.id=m."branchId"
    WHERE m."movementType" IN ('COUNT_CORRECTION','RECEIPT','OPENING_BALANCE')
      AND ABS(m."quantityDelta") >= GREATEST(100000, COALESCE(p."normalizedContentPerUnit",1)*50)
    ORDER BY ABS(m."quantityDelta") DESC LIMIT 30
  `;

  const unpricedProducts = await prisma.$queryRaw<UnpricedProduct[]>`
    SELECT p.id,p.name,p.code,p.category,
      COUNT(*) FILTER (WHERE b.quantity>0)::bigint AS "stockBranches"
    FROM "InventoryProduct" p
    LEFT JOIN "InventoryBalance" b ON b."inventoryProductId"=p.id
    WHERE p."isActive"=true AND p."archivedAt" IS NULL AND p."trackStock"=true
      AND (p."unitCost" IS NULL OR p."unitCost"<=0)
      AND p.category NOT IN ('Equipo de stand','Trastes','Herramientas')
    GROUP BY p.id ORDER BY p.name
  `;

  const longOpenCuts = await prisma.cashCut.findMany({
    where: { status: "ABIERTO", openedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { id: true, code: true, openedAt: true, branch: { select: { name: true } } },
    orderBy: { openedAt: "asc" },
    take: 30,
  });
  const salesBeforeOpening = await prisma.$queryRaw<EarlySale[]>`
    SELECT s.id,s.code,s."cashCutId",b.name AS branch,s."createdAt",c."openedAt",s.total
    FROM "PosSale" s JOIN "CashCut" c ON c.id=s."cashCutId"
    JOIN "Branch" b ON b.id=s."branchId"
    WHERE s."createdAt"<c."openedAt"-INTERVAL '2 minutes'
    ORDER BY s."createdAt" DESC LIMIT 30
  `;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link href="/cash-cuts" className="text-sm font-semibold text-primary hover:underline">← Cortes de Caja</Link>
          <h1 className="mt-3 text-2xl font-bold">Auditoría y conciliación operativa</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Consulta administrativa de solo lectura. Los importes son discrepancias por conciliar,
            no pérdidas comprobadas. No se alteran ventas, conteos ni saldos.
          </p>
        </div>
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <h2 className="text-lg font-bold">Cortes de caja por conciliar ({cashExceptions.length})</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Diferencias entre total almacenado, pagos de caja y tickets POS. Los cortes de
            prueba e históricos se conservan como evidencia, sin sumarlos a pérdidas.
          </p>
          <div className="mt-4 space-y-2">
            {cashExceptions.length === 0 && <p className="text-sm">Sin discrepancias detectadas.</p>}
            {cashExceptions.map((row) => {
              const isTest = row.code.startsWith("TEST-") || row.code.startsWith("CC2-");
              const missingPos = Math.max(0, row.pos-row.paid);
              return (
                <Link key={row.id} href={`/cash-cuts/daily/${row.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant p-3 text-sm hover:bg-surface-container-high">
                  <span><strong>{row.code}</strong> · {row.branch}<span className="block text-xs text-on-surface-variant">{date(row.closedAt)}{isTest ? " · Registro de prueba o arranque" : ""}</span></span>
                  <span className="text-right">Cierre: {currency(row.stored)} · Pagos: {currency(row.paid)}
                    <span className="block text-xs text-secondary">Tickets POS: {currency(row.pos)}{missingPos>.02 ? ` · POS supera pagos en ${currency(missingPos)}` : ""}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
        {(longOpenCuts.length > 0 || salesBeforeOpening.length > 0) && (
          <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <h2 className="text-lg font-bold">Fechas de operación por conciliar</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Cortes abiertos por más de 24 horas y ventas históricas con fecha previa a la apertura del corte asignado.
              No se cerró ninguna caja ni se cambiaron fechas automáticamente.
            </p>
            <div className="mt-4 space-y-2">
              {longOpenCuts.map((row) => (
                <Link key={row.id} href={`/cash-cuts/daily/${row.id}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-outline-variant p-3 text-sm hover:bg-surface-container-high">
                  <strong>{row.code} · {row.branch.name}</strong>
                  <span className="text-secondary">Abierto desde {date(row.openedAt)} · Revisar cierre</span>
                </Link>
              ))}
              {salesBeforeOpening.map((row) => (
                <Link key={row.id} href={`/cash-cuts/daily/${row.cashCutId}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-outline-variant p-3 text-sm hover:bg-surface-container-high">
                  <strong>{row.code} · {row.branch}</strong>
                  <span className="text-secondary">Venta {date(row.createdAt)} · Apertura {date(row.openedAt)} · {currency(row.total)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <h2 className="text-lg font-bold">Conteos con saldo cambiado después de la captura ({countExceptions.length})</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Requieren cotejar el horario de conteo con ventas, entradas y cierres. Los nuevos cierres ya bloquean el saldo neto desactualizado.</p>
          <div className="mt-4 space-y-2">
            {countExceptions.length === 0 && <p className="text-sm">Sin excepciones.</p>}
            {countExceptions.map((row) => (
              <Link key={row.id} href={`/administration/inventory/branch-counts/${row.id}`} className="flex flex-wrap justify-between gap-3 rounded-lg border border-outline-variant p-3 text-sm hover:bg-surface-container-high">
                <span><strong>{row.code}</strong> · {row.branch} · {date(row.countDate)}</span>
                <span className="font-semibold text-secondary">{Number(row.changedProducts)} productos por revisar</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <h2 className="text-lg font-bold">Movimientos extraordinarios históricos ({extraordinaryMovements.length})</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Revisar documentos de compra, unidades de captura y conteos originales. No se revierte ningún movimiento automáticamente.</p>
          <div className="mt-4 space-y-2">
            {extraordinaryMovements.length === 0 && <p className="text-sm">Sin movimientos que superen el umbral.</p>}
            {extraordinaryMovements.map((row) => (
              <div key={row.id} className="flex flex-wrap justify-between gap-3 rounded-lg border border-outline-variant p-3 text-sm">
                <span><strong>{row.product}</strong> · {row.branch}<span className="block text-xs text-on-surface-variant">{row.movementType} · {date(row.createdAt)}</span></span>
                <strong className="text-secondary">{Number(row.quantityDelta).toLocaleString("es-MX")} {row.unit}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <h2 className="text-lg font-bold">Productos sin costo comercial ({unpricedProducts.length})</h2>
          <p className="mt-1 text-sm text-on-surface-variant">El valor real no puede estimarse hasta registrar el costo respaldado por factura. No asignar $0 ni un costo ficticio.</p>
          <div className="mt-4 space-y-2">
            {unpricedProducts.length === 0 && <p className="text-sm">Todos los insumos con costo registrado.</p>}
            {unpricedProducts.map((row) => (
              <Link key={row.id} href={`/administration/inventory/products/${row.id}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-outline-variant p-3 text-sm hover:bg-surface-container-high">
                <span><strong>{row.name}</strong> ({row.code}) · {row.category}</span>
                <span className="font-semibold text-secondary">{Number(row.stockBranches)} sucursales con existencias · Editar costo</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
