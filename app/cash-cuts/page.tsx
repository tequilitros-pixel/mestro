import Link from "next/link";
import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import {
  PlusIcon,
  ChevronRightIcon,
  AlertIcon,
} from "@/components/ui/icons";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);

export default async function CashCutsHomePage() {
  const user = await getCurrentUser();
  const allowedBranchIds = await getAccessibleBranchIds();

  const branchFilter = allowedBranchIds
    ? { branchId: { in: allowedBranchIds } }
    : {};

  const openCuts = await prisma.cashCut.findMany({
    where: { status: "ABIERTO", ...branchFilter },
    include: { branch: true, responsible: true },
    orderBy: { openedAt: "desc" },
  });

  // El Encargado vive el día a día de UNA sucursal: lo primero que
  // necesita ver es "mi corte de hoy", no un dashboard.
  const isFrontLine = user?.role === "ENCARGADO";
  const myOpenCut = isFrontLine ? (openCuts[0] ?? null) : null;
  const otherOpenCuts = isFrontLine ? openCuts.slice(1) : openCuts;

  // ADMIN/GERENTE/CONSULTA supervisan varias sucursales: lo primero
  // que necesitan es un resumen, no la lista operativa cruda.
  let summary: { totalSales: number; withDifference: number } | null =
    null;

  if (!isFrontLine) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentClosed = await prisma.cashCut.findMany({
      where: {
        status: { in: ["CERRADO", "AUDITADO"] },
        date: { gte: sevenDaysAgo },
        ...branchFilter,
      },
      select: { totalSales: true, difference: true },
    });

    summary = {
      totalSales: recentClosed.reduce(
        (sum, c) => sum + (c.totalSales ?? 0),
        0
      ),
      withDifference: recentClosed.filter(
        (c) => Math.abs(c.difference ?? 0) > 10
      ).length,
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">
            Cortes de Caja
          </h1>
          <p className="text-sm text-on-surface-variant">
            {isFrontLine
              ? "Abre o continúa el corte de tu sucursal."
              : "Resumen general y cortes abiertos."}
          </p>
        </div>

        <Link
          href="/cash-cuts/daily/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97]"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo corte
        </Link>
      </div>

      {isFrontLine && myOpenCut && (
        <Link href={`/cash-cuts/daily/${myOpenCut.id}`}>
          <Card
            highlight
            className="cursor-pointer transition hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardLabel>{myOpenCut.branch.name} · Corte de hoy</CardLabel>
                <CardValue>{myOpenCut.code}</CardValue>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Responsable: {myOpenCut.responsible.name}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tertiary-fixed-dim/15 px-3 py-1.5 text-xs font-bold text-tertiary-fixed-dim">
                Continuar
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </span>
            </div>
          </Card>
        </Link>
      )}

      {isFrontLine && !myOpenCut && (
        <Card className="text-center">
          <p className="text-sm text-on-surface-variant">
            No tienes un corte abierto. Usa &ldquo;Nuevo corte&rdquo; para
            empezar el de hoy.
          </p>
        </Card>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href="/cash-cuts/dashboard">
            <Card className="cursor-pointer transition hover:border-primary/25">
              <CardLabel>Ventas (últimos 7 días)</CardLabel>
              <CardValue>{formatCurrency(summary.totalSales)}</CardValue>
            </Card>
          </Link>

          <Link href="/cash-cuts/audit">
            <Card className="cursor-pointer transition hover:border-primary/25">
              <CardLabel>Cortes con diferencia</CardLabel>
              <div className="flex items-center gap-2">
                <CardValue>{summary.withDifference}</CardValue>
                {summary.withDifference > 0 && (
                  <AlertIcon className="h-4 w-4 text-secondary" />
                )}
              </div>
            </Card>
          </Link>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase text-on-surface-variant">
          {isFrontLine ? "Otros cortes abiertos" : "Cortes abiertos"}
        </h2>

        {openCuts.length === 0 && (
          <Card>
            <p className="text-sm text-on-surface-variant">
              No hay cortes abiertos en este momento.
            </p>
          </Card>
        )}

        <div className="space-y-2">
          {otherOpenCuts.map((cc) => (
            <Link key={cc.id} href={`/cash-cuts/daily/${cc.id}`}>
              <Card className="cursor-pointer transition hover:border-primary/25">
                <div className="flex items-center justify-between">
                  <div>
                    <CardLabel>{cc.branch.name}</CardLabel>
                    <CardValue>{cc.code}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Responsable: {cc.responsible.name}
                    </p>
                  </div>
                  <span className="rounded-full bg-tertiary-fixed-dim/20 px-3 py-1 text-xs font-bold text-tertiary-fixed-dim">
                    {cc.status}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Link
        href="/cash-cuts/history"
        className="flex items-center justify-center gap-1 text-center text-sm text-on-surface-variant hover:text-on-surface"
      >
        Ver historial completo
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
