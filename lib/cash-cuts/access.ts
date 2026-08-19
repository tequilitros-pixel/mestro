import "server-only";

import type { Prisma, UserRole } from "@prisma/client";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";

/*
 * ============================================================
 * Alcance de lectura/escritura de Cortes de caja
 * ------------------------------------------------------------
 * Reutiliza los roles y las sucursales que ya existen
 * (UserRole + UserBranch via getAccessibleBranchIds). No define
 * un sistema de permisos paralelo.
 *
 * La regla clave: el recorte NO se hace con `if`s en cada ruta,
 * se hace en el `where` de Prisma. Una consulta que olvide el
 * filtro no puede existir, porque el filtro ES el punto de
 * partida de la consulta.
 * ============================================================
 */

/** Pueden crear, capturar y cerrar cortes. */
const ROLES_QUE_OPERAN: UserRole[] = ["ADMIN", "GERENTE", "ENCARGADO"];

/**
 * Pueden ver cortes cerrados y de otras personas.
 * ENCARGADO queda FUERA a proposito: es el cajero, solo ve el
 * corte que el mismo tiene abierto.
 */
const ROLES_CON_HISTORIAL: UserRole[] = ["ADMIN", "GERENTE", "CONSULTA"];

/** Quien puede entrar al modulo. OPERATOR (planta) no entra. */
const ROLES_CON_ACCESO: UserRole[] = ["ADMIN", "GERENTE", "ENCARGADO", "CONSULTA"];

export type CashCutScope = {
  user: { id: string; name: string; role: UserRole };
  /** `null` = todas las sucursales (ADMIN). Lista vacia = ninguna. */
  branchIds: string[] | null;
  /** Ve cortes cerrados y ajenos. */
  canSeeHistory: boolean;
  /** Puede crear, capturar y cerrar. */
  canManage: boolean;
};

/**
 * Resuelve el alcance SIEMPRE desde la sesion autenticada.
 * Nunca desde parametros del navegador (userId, branchId, role).
 * Devuelve null si no hay sesion o si el rol no toca este modulo.
 */
export async function getCashCutScope(): Promise<CashCutScope | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!ROLES_CON_ACCESO.includes(user.role)) return null;

  return {
    user: { id: user.id, name: user.name, role: user.role },
    branchIds: await getAccessibleBranchIds(),
    canSeeHistory: ROLES_CON_HISTORIAL.includes(user.role),
    canManage: ROLES_QUE_OPERAN.includes(user.role),
  };
}

/**
 * Filtro base obligatorio. Para quien no tiene historial se cierra
 * a: sus sucursales + su propio corte + unicamente ABIERTO.
 */
export function cashCutScopeWhere(scope: CashCutScope): Prisma.CashCutWhereInput {
  const where: Prisma.CashCutWhereInput = {};

  // branchIds === null solo para ADMIN. Lista vacia => no ve nada,
  // que es justo lo que queremos para un usuario sin sucursales.
  if (scope.branchIds !== null) {
    where.branchId = { in: scope.branchIds };
  }

  if (!scope.canSeeHistory) {
    where.responsibleId = scope.user.id;
    where.status = "ABIERTO";
  }

  return where;
}

/**
 * Combina el filtro base con filtros del llamador usando AND.
 *
 * Es AND y no un spread a proposito: si se fusionaran los objetos,
 * un `status: "CERRADO"` recibido por querystring sobreescribiria el
 * `status: "ABIERTO"` del alcance y reabriria la fuga. Con AND, un
 * ENCARGADO que pida cortes cerrados recibe una lista vacia.
 */
export function withCashCutScope(
  scope: CashCutScope,
  extra?: Prisma.CashCutWhereInput,
): Prisma.CashCutWhereInput {
  const base = cashCutScopeWhere(scope);
  return extra ? { AND: [base, extra] } : base;
}

/** ¿Puede escribir en este corte? Solo roles operativos y solo si esta ABIERTO. */
export function canWriteCashCut(
  scope: CashCutScope,
  cut: { status: string; responsibleId: string },
): boolean {
  if (!scope.canManage) return false;
  if (cut.status !== "ABIERTO") return false;
  if (!scope.canSeeHistory && cut.responsibleId !== scope.user.id) return false;
  return true;
}
