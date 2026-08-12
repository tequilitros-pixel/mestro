import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

// Roles que pueden autorizar un descuento/cortesía que supera el
// límite del cajero, reautenticándose en el mismo dispositivo.
export const MANAGER_ROLES: UserRole[] = ["ADMIN", "GERENTE"];

export function canAuthorize(role: UserRole) {
  return MANAGER_ROLES.includes(role);
}

/**
 * Límite máximo (%) que un rol puede aplicar sin autorización. `null`
 * significa sin límite — es el valor por defecto cuando nadie ha
 * configurado ese rol todavía, para no bloquear descuentos que ya
 * funcionaban antes de activar esta política.
 */
export async function getDiscountLimitsByRole(): Promise<Map<UserRole, number>> {
  const rows = await prisma.posDiscountLimit.findMany();
  return new Map(rows.map((r) => [r.role, r.maxPercent]));
}

const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/**
 * Verifica el PIN de un gerente/admin para autorizar en el mismo
 * dispositivo un descuento o cortesía que supera el límite del
 * cajero. Reutiliza failedLoginAttempts/lockedUntil de User, el
 * mismo contador compartido que ya usan login.ts y kiosk.ts.
 */
export async function verifyManagerPin(
  managerId: string,
  pin: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      pinHash: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });

  if (!manager || !manager.active || !canAuthorize(manager.role) || !manager.pinHash) {
    return { error: "El autorizador no es válido." };
  }

  if (manager.lockedUntil && manager.lockedUntil > new Date()) {
    return { error: "PIN bloqueado por intentos fallidos. Pide a un administrador que lo restablezca." };
  }

  const matches = await bcrypt.compare(pin, manager.pinHash);
  if (!matches) {
    const attempts = manager.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: manager.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_PIN_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
      },
    });
    return { error: "PIN incorrecto." };
  }

  if (manager.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: manager.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  return { id: manager.id, name: manager.name };
}
