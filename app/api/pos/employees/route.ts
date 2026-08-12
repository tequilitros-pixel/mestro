import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { MANAGER_ROLES, getDiscountLimitsByRole } from "@/lib/pos/discountLimits";

const ROLES_QUE_PUEDEN_VENDER = ["ADMIN", "GERENTE", "ENCARGADO"];

/**
 * Datos de apoyo para la pantalla de cobro: empleados activos (para
 * "Venta a empleado"), el % de descuento genérico configurado, el
 * límite de descuento del usuario actual (null = sin límite), y la
 * lista de gerentes/administradores que pueden autorizar un
 * descuento que lo supere.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!ROLES_QUE_PUEDEN_VENDER.includes(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const [employees, settings, limitsByRole, managers] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.posSettings.findUnique({ where: { id: "default" } }),
    getDiscountLimitsByRole(),
    prisma.user.findMany({
      where: { active: true, role: { in: MANAGER_ROLES }, pinHash: { not: null } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    employees,
    employeeDiscountPercent: settings?.employeeDiscountPercent ?? 50,
    discountLimitPercent: limitsByRole.get(user.role) ?? null,
    managers,
  });
}
