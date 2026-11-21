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

function notificationBranchIds(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return [];
  const record = metadata as Record<string, unknown>;
  const ids = [
    ...(typeof record.branchId === "string" ? [record.branchId] : []),
    ...(Array.isArray(record.branchIds)
      ? record.branchIds.filter((branchId): branchId is string => typeof branchId === "string")
      : []),
  ];
  return [...new Set(ids)];
}

const BRANCH_SCOPED_CATEGORIES = new Set<NotificationAccessCategory>([
  "POS",
  "INVENTORY",
  "PRODUCTION",
]);

/**
 * Administración tiene alcance global. Los demás responsables operativos solo
 * ven alertas de sus sucursales. Si un aviso operativo heredado no trae
 * sucursal, se oculta fuera de Administración para evitar filtraciones.
 */
export function canUserViewNotification(input: {
  role: NotificationAccessRole | string;
  category: NotificationAccessCategory;
  metadata?: unknown;
  branchIds: readonly string[] | null;
}) {
  if (!canRoleReceiveNotification(input.role, input.category, input.metadata)) return false;
  if (input.role === "ADMIN" || !BRANCH_SCOPED_CATEGORIES.has(input.category)) return true;

  const notificationBranches = notificationBranchIds(input.metadata);
  return (
    notificationBranches.length > 0 &&
    notificationBranches.some((branchId) => input.branchIds?.includes(branchId))
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
