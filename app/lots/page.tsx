import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import LotsTable, { type LotFilters } from "@/components/lots/LotsTable";
import { PageHeader } from "@/components/ui/CompactUI";
import { addDaysToDateOnly, businessDayStart, lastDayOfMonth } from "@/lib/dateOnly";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }

export default async function LotsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters: LotFilters = {
    query: firstValue(params.query),
    status: ["ACTIVE", "TERMINATED"].includes(firstValue(params.status)) ? firstValue(params.status) as LotFilters["status"] : "ALL",
    sort: firstValue(params.sort) === "asc" ? "asc" : "desc",
    year: /^\d{4}$/.test(firstValue(params.year)) ? firstValue(params.year) : "",
    month: /^(?:[1-9]|1[0-2])$/.test(firstValue(params.month)) ? firstValue(params.month) : "",
    from: validDate(firstValue(params.from)) ? firstValue(params.from) : "",
    to: validDate(firstValue(params.to)) ? firstValue(params.to) : "",
  };
  const where: Prisma.LotWhereInput = {};
  if (filters.query) where.code = { contains: filters.query, mode: "insensitive" };
  if (filters.status === "TERMINATED") where.stage = "TERMINADO";
  if (filters.status === "ACTIVE") where.stage = { not: "TERMINADO" };
  const dateFrom = filters.from || (filters.year ? `${filters.year}-${filters.month ? filters.month.padStart(2, "0") : "01"}-01` : "");
  const dateTo = filters.to || (filters.year ? filters.month ? lastDayOfMonth(`${filters.year}-${filters.month.padStart(2, "0")}`) : `${filters.year}-12-31` : "");
  if (dateFrom || dateTo) where.startedAt = { ...(dateFrom ? { gte: businessDayStart(dateFrom) } : {}), ...(dateTo ? { lt: businessDayStart(addDaysToDateOnly(dateTo, 1)) } : {}) };
  const lots = await prisma.lot.findMany({
    where,
    orderBy: { startedAt: filters.sort },
  });

  return (
    <main className="page-frame space-y-4 text-on-surface">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Lotes" description="Expedientes de producción desde recepción hasta producto terminado." actions={<Link
            href="/lots/new"
            className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary transition duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            Nuevo lote
          </Link>} />
        <LotsTable key={JSON.stringify(filters)} lots={lots.map((lot) => ({ ...lot, startedAt: lot.startedAt.toISOString() }))} filters={filters} />
      </div>
    </main>
  );
}
