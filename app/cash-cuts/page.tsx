import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCashCutScope, withCashCutScope } from "@/lib/cash-cuts/access";
import CajaOperativa from "./CajaOperativa";
import TableroCortes from "./TableroCortes";

/*
 * Entrada del modulo. Es Server Component a proposito: el rol decide
 * AQUI que pantalla se monta, asi que el navegador de un ENCARGADO no
 * recibe el componente del historial, ni sus props, ni su HTML.
 *
 * Sin cache: la respuesta depende del usuario y de sus sucursales, no
 * puede compartirse entre sesiones.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CashCutsPage() {
  const scope = await getCashCutScope();

  // Rol sin acceso al modulo (p. ej. OPERATOR de planta).
  if (!scope) notFound();

  /* ---------- Cajero: solo su corte abierto ---------- */
  if (!scope.canSeeHistory) {
    // withCashCutScope ya limita a: sus sucursales + suyo + ABIERTO.
    const corte = await prisma.cashCut.findFirst({
      where: withCashCutScope(scope),
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        code: true,
        openedAt: true,
        totalSales: true,
        startingFund: true,
        branch: { select: { name: true } },
        responsible: { select: { name: true } },
      },
    });

    // Si no hay corte abierto, igual necesitamos el nombre de su sucursal
    // para la pantalla "No tienes un corte abierto".
    const sucursal =
      corte === null && scope.branchIds && scope.branchIds.length > 0
        ? await prisma.branch.findFirst({
            where: { id: { in: scope.branchIds }, active: true },
            select: { name: true },
            orderBy: { name: "asc" },
          })
        : null;

    return (
      <CajaOperativa
        userName={scope.user.name}
        branchName={corte?.branch.name ?? sucursal?.name ?? null}
        corte={
          corte
            ? {
                id: corte.id,
                code: corte.code,
                openedAt: corte.openedAt.toISOString(),
                branchName: corte.branch.name,
                responsibleName: corte.responsible.name,
                totalSales: corte.totalSales,
                startingFund: corte.startingFund,
              }
            : null
        }
      />
    );
  }

  /* ---------- Gerente / Administrador / Consulta ---------- */
  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(scope.branchIds === null ? {} : { id: { in: scope.branchIds } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <TableroCortes branches={branches} canCreate={scope.canManage} />;
}
