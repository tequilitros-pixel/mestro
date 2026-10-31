export type NotificationAccessRole =
  | "ADMIN"
  | "GERENTE"
  | "ENCARGADO"
  | "OPERATOR"
  | "CONSULTA";

export type NotificationAccessCategory =
  | "POS"
  | "TIMECLOCK"
  | "PAYROLL"
  | "INVENTORY"
  | "PRODUCTION"
  | "SYSTEM";

/** Roles que pueden recibir alertas operativas automáticas. */
export const NOTIFICATION_RULE_RECIPIENT_ROLES: readonly NotificationAccessRole[] = [
  "ADMIN",
  "GERENTE",
  "ENCARGADO",
];

const PERSONAL_EMPLOYEE_CATEGORIES = new Set<NotificationAccessCategory>([
  "TIMECLOCK",
  "PAYROLL",
]);

function isOwnTestNotification(metadata: unknown) {
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      (metadata as Record<string, unknown>).test === true,
  );
}

/**
 * Operador y Consulta solo pueden recibir avisos que sean personales: nómina,
 * horario/asistencia, o su prueba explícita de notificaciones. Los avisos de
 * caja, inventario y producción son exclusivos de personal responsable.
 */
export function canRoleReceiveNotification(
  role: NotificationAccessRole | string,
  category: NotificationAccessCategory,
  metadata?: unknown,
) {
  if (role !== "OPERATOR" && role !== "CONSULTA") return true;

  return (
    PERSONAL_EMPLOYEE_CATEGORIES.has(category) ||
    (category === "SYSTEM" && isOwnTestNotification(metadata))
  );
}

export function allowedNotificationRuleRecipientRoles(
  roles: readonly string[],
): NotificationAccessRole[] {
  return roles.filter(
    (role): role is NotificationAccessRole =>
      NOTIFICATION_RULE_RECIPIENT_ROLES.includes(role as NotificationAccessRole),
  );
}
