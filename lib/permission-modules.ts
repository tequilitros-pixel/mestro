export type PermissionModule = {
  key: string;
  label: string;
};

export type PermissionGroup = {
  group: string;
  modules: PermissionModule[];
};

/** Pantallas personales disponibles para cualquier usuario con sesión sin requerir permisos. */
export const ALWAYS_AVAILABLE_PATHS = [
  "/profile",
] as const;

/** Acceso histórico para operadores que aún no tienen permisos configurados en absoluto. */
export const LEGACY_OPERATOR_PERMISSION_KEYS = [
  "/cooking",
  "/boiler",
  "/milling",
  "/fermentation",
  "/distillation",
] as const;

/** Rutas críticas de configuración del sistema reservadas exclusivamente a ADMIN. */
export const ADMIN_ONLY_PATH_PREFIXES = [
  "/administration/personnel/[id]/permissions",
] as const;

const ADMIN_ONLY_PATHS = [] as const;

export function isAlwaysAvailablePath(pathname: string): boolean {
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return true;
  return ALWAYS_AVAILABLE_PATHS.some((path) => pathname === path);
}

export function isAdminOnlyPath(pathname: string): boolean {
  if (pathname.includes("/permissions")) return true;
  return (
    ADMIN_ONLY_PATHS.some((path) => pathname === path) ||
    ADMIN_ONLY_PATH_PREFIXES.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  );
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "Proceso de Producción",
    modules: [
      { key: "/plant", label: "Planta · Resumen operativo" },
      { key: "/lots", label: "Lotes de producción" },
      { key: "/cooking", label: "Cocción" },
      { key: "/boiler", label: "Caldera" },
      { key: "/milling", label: "Molienda" },
      { key: "/fermentation", label: "Fermentación" },
      { key: "/distillation", label: "Destilación" },
      { key: "/distillation/statistics", label: "Estadísticas de destilación" },
      { key: "/costs", label: "Costos de producción" },
      { key: "/control-room", label: "Sala de control" },
    ],
  },
  {
    group: "Elaboración de Licores",
    modules: [
      { key: "/liquors", label: "Catálogo de licores" },
      { key: "/liquors/recipes", label: "Recetas" },
      { key: "/liquors/raw-materials", label: "Materia prima" },
      { key: "/liquors/batches", label: "Lotes de licores" },
      { key: "/liquors/production", label: "Proceso de elaboración" },
      { key: "/liquors/production/labels", label: "Creación de etiquetas" },
      { key: "/liquors/bottling", label: "Embotellado" },
      { key: "/liquors/inventory", label: "Inventario de botellas" },
      { key: "/liquors/qr", label: "Códigos QR" },
      { key: "/liquors/expiration", label: "Control de caducidades" },
    ],
  },
  {
    group: "Cortes de Caja",
    modules: [
      { key: "/cash-cuts", label: "Inicio de cortes" },
      { key: "/cash-cuts/dashboard", label: "Dashboard de control" },
      { key: "/cash-cuts/branches", label: "Cortes por sucursal" },
      { key: "/cash-cuts/daily", label: "Cortes diarios" },
      { key: "/cash-cuts/expenses", label: "Salidas de efectivo" },
      { key: "/cash-cuts/envelopes", label: "Sobres de efectivo" },
      { key: "/cash-cuts/safe", label: "Caja fuerte" },
      { key: "/cash-cuts/audit", label: "Auditoría de cortes" },
      { key: "/cash-cuts/history", label: "Historial completo de cortes" },
    ],
  },
  {
    group: "Punto de Venta",
    modules: [
      { key: "/pos", label: "Caja y cobros · Punto de Venta" },
      { key: "/pospress/tables", label: "Mesas" },
      { key: "/pospress/pending-tabs", label: "Cuentas pendientes" },
      { key: "/pos/sales", label: "Transacciones y resumen de ventas" },
      { key: "/pospress/catalog", label: "Editor de productos POS" },
      { key: "/pospress/recipes", label: "Recetas POS" },
      { key: "/pospress/discounts", label: "Editor de descuentos" },
      { key: "/pos/settings", label: "Configuración POS" },
      { key: "/administration/pos2", label: "Administración POS v2" },
    ],
  },
  {
    group: "Inventario y Eventos",
    modules: [
      { key: "/administration/inventory", label: "Inicio de inventario" },
      { key: "/administration/inventory/products", label: "Productos de inventario" },
      { key: "/administration/inventory/sucursales", label: "Sucursales · Resumen" },
      { key: "/administration/inventory/sucursales/stock", label: "Sucursales · Stock actual" },
      { key: "/administration/inventory/branch-entries", label: "Entradas y ajustes" },
      { key: "/administration/inventory/sucursales/traspasos", label: "Traspasos" },
      { key: "/administration/inventory/branch-counts", label: "Conteos semanales" },
      { key: "/administration/inventory/branch-counts/statistics", label: "Estadísticas de conteos" },
      { key: "/administration/inventory/events", label: "Eventos operativos" },
      { key: "/administration/inventory/eventos", label: "Resumen de eventos" },
      { key: "/administration/inventory/event-packages", label: "Paquetes de eventos" },
      { key: "/administration/inventory/equipment-kits", label: "Modalidades de equipo" },
    ],
  },
  {
    group: "Contabilidad y Finanzas",
    modules: [
      { key: "/accounting", label: "Contabilidad y pagos" },
      { key: "/administration/financial-categories", label: "Categorías financieras" },
    ],
  },
  {
    group: "Cotizador Tequilitros",
    modules: [
      { key: "/cotizador-tequilitros", label: "Cotizador de eventos" },
      { key: "/cotizador-tequilitros/calendario", label: "Calendario de eventos" },
      { key: "/cotizador-tequilitros/historial", label: "Historial de cotizaciones" },
      { key: "/cotizador-tequilitros/contratos", label: "Contratos de clientes" },
    ],
  },
  {
    group: "Checador y Asistencia Personal",
    modules: [
      { key: "/timeclock", label: "Checador · Entrada y salida" },
      { key: "/timeclock/calendar", label: "Mi horario" },
      { key: "/timeclock/availability", label: "Mi disponibilidad" },
      { key: "/timeclock/hours", label: "Mi nómina y horas" },
      { key: "/timeclock/history", label: "Mi historial de turnos" },
      { key: "/timeclock/requests", label: "Mis solicitudes" },
      { key: "/timeclock/kiosk", label: "Modo kiosco de checador" },
    ],
  },
  {
    group: "Administración de Personal y Horarios",
    modules: [
      { key: "/administration/personnel", label: "Directorio de personal" },
      { key: "/administration/schedule", label: "Programación de horarios" },
      { key: "/administration/personnel/timeclock", label: "Supervisión de asistencia y checador" },
      { key: "/administration/personnel/notifications", label: "Avisos a personal" },
      { key: "/timeclock/geofences", label: "Geocercas de sucursales" },
    ],
  },
];

const CONFIGURABLE_PERMISSION_KEYS = new Set(
  PERMISSION_GROUPS.flatMap((group) =>
    group.modules.map((module) => module.key),
  ),
);

export function isConfigurablePermissionKey(key: string): boolean {
  if (key === "/pospress") return true;
  return CONFIGURABLE_PERMISSION_KEYS.has(key);
}

/** Regla única de acceso por módulo para UI, Server Actions y APIs. */
export function canAccessModule(
  role: string,
  moduleKeys: readonly string[],
  moduleKey: string,
): boolean {
  if (role === "ADMIN") return true;

  // Conteo semanal de inventario
  if (moduleKey === "/administration/inventory/branch-counts") {
    if (isInventoryCountCaptureRole(role)) return true;
  }

  const hasConfiguredPermissions = moduleKeys.some(isConfigurablePermissionKey);

  // Acceso histórico para operadores sin configurar
  if (
    role === "OPERATOR" &&
    !hasConfiguredPermissions &&
    LEGACY_OPERATOR_PERMISSION_KEYS.some((key) => key === moduleKey)
  ) {
    return true;
  }

  // Compatibilidad histórica para usuarios sin configurar: checador personal básico
  if (
    !hasConfiguredPermissions &&
    (moduleKey === "/timeclock" || moduleKey === "/timeclock/calendar")
  ) {
    return true;
  }

  // Compatibilidad bidireccional /pos <-> /pospress
  if (moduleKey === "/pos" && moduleKeys.includes("/pospress")) return true;
  if (moduleKey === "/pospress" && moduleKeys.includes("/pos")) return true;

  // Compatibilidad bidireccional /administration <-> /administration/inventory
  if (moduleKey === "/administration" && moduleKeys.includes("/administration/inventory")) return true;
  if (moduleKey === "/administration/inventory" && moduleKeys.includes("/administration")) return true;

  // Workforce administrativo fue descontinuado. Un permiso histórico abre el
  // horario original sin modificar los permisos ya almacenados.
  if (
    moduleKey === "/administration/schedule" &&
    moduleKeys.includes("/administration/workforce")
  ) return true;

  return moduleKeys.includes(moduleKey);
}

export function getModuleKeyForPath(pathname: string): string | null {
  // 1. Contabilidad y finanzas
  if (pathname === "/accounting" || pathname.startsWith("/accounting/")) {
    return "/accounting";
  }
  if (
    pathname === "/administration/financial-categories" ||
    pathname.startsWith("/administration/financial-categories/")
  ) {
    return "/administration/financial-categories";
  }

  // 2. Personal, Horarios y Workforce
  if (
    pathname === "/administration/schedule" ||
    pathname.startsWith("/administration/schedule/")
  ) {
    return "/administration/schedule";
  }
  if (
    pathname === "/administration/workforce" ||
    pathname.startsWith("/administration/workforce/")
  ) {
    return "/administration/schedule";
  }
  if (
    pathname === "/administration/personnel/timeclock" ||
    pathname.startsWith("/administration/personnel/timeclock/")
  ) {
    return "/administration/personnel/timeclock";
  }
  if (
    pathname === "/administration/personnel/notifications" ||
    pathname.startsWith("/administration/personnel/notifications/")
  ) {
    return "/administration/personnel/notifications";
  }
  if (
    pathname === "/timeclock/geofences" ||
    pathname.startsWith("/timeclock/geofences/")
  ) {
    return "/timeclock/geofences";
  }
  if (pathname === "/timeclock/kiosk" || pathname === "/workforce/kiosk") {
    return "/timeclock/kiosk";
  }
  if (pathname === "/workforce/clock") {
    return "/timeclock";
  }
  if (pathname === "/workforce/availability") {
    return "/timeclock/availability";
  }
  if (pathname === "/workforce/timesheet" || pathname === "/workforce/payroll") {
    return "/timeclock/hours";
  }
  if (pathname === "/workforce" || pathname.startsWith("/workforce/")) {
    return "/administration/workforce";
  }
  if (
    pathname === "/administration/personnel" ||
    pathname.startsWith("/administration/personnel/")
  ) {
    return "/administration/personnel";
  }

  // 3. Cotizador Tequilitros
  if (
    pathname === "/cotizador-tequilitros/calendario" ||
    pathname.startsWith("/cotizador-tequilitros/calendario/")
  ) {
    return "/cotizador-tequilitros/calendario";
  }
  if (
    pathname === "/cotizador-tequilitros/contratos" ||
    pathname.startsWith("/cotizador-tequilitros/contratos/")
  ) {
    return "/cotizador-tequilitros/contratos";
  }
  if (
    pathname === "/cotizador-tequilitros/historial" ||
    pathname.startsWith("/cotizador-tequilitros/historial/")
  ) {
    return "/cotizador-tequilitros/historial";
  }
  if (
    pathname === "/cotizador-tequilitros" ||
    pathname.startsWith("/cotizador-tequilitros/")
  ) {
    return "/cotizador-tequilitros";
  }

  // 4. Producción de Tequila
  if (
    pathname === "/distillation/statistics" ||
    pathname.startsWith("/distillation/statistics/")
  ) {
    return "/distillation/statistics";
  }

  // 5. Elaboración de Licores
  if (
    pathname === "/liquors/production/labels" ||
    pathname.startsWith("/liquors/production/labels/")
  ) {
    return "/liquors/production/labels";
  }
  if (/^\/liquors\/products\/[^/]+\/new\/?$/.test(pathname)) {
    return "/liquors/production";
  }
  if (
    /^\/liquors\/batches\/[^/]+\/(bottling|labels)(\/|$)/.test(pathname) ||
    pathname.startsWith("/liquors/print/bottling/")
  ) {
    return "/liquors/bottling";
  }
  if (/^\/liquors\/bottles\/[^/]+\/(label|qr)(\/|$)/.test(pathname)) {
    return "/liquors/qr";
  }
  if (/^\/liquors\/bottles\/[^/]+\/?$/.test(pathname)) {
    return "/liquors/inventory";
  }

  // 6. Punto de Venta (POS)
  if (
    pathname === "/pospress/transactions" ||
    pathname.startsWith("/pospress/transactions/")
  ) {
    return "/pos/sales";
  }
  if (pathname === "/pos/sales" || pathname.startsWith("/pos/sales/")) {
    return "/pos/sales";
  }
  if (
    pathname === "/pospress/catalog" ||
    pathname.startsWith("/pospress/catalog/")
  ) {
    return "/pospress/catalog";
  }
  if (
    pathname === "/pospress/recipes" ||
    pathname.startsWith("/pospress/recipes/")
  ) {
    return "/pospress/recipes";
  }
  if (
    pathname === "/pospress/discounts" ||
    pathname.startsWith("/pospress/discounts/")
  ) {
    return "/pospress/discounts";
  }
  if (
    pathname === "/pospress/tables" ||
    pathname.startsWith("/pospress/tables/")
  ) {
    return "/pospress/tables";
  }
  if (
    pathname === "/pospress/pending-tabs" ||
    pathname.startsWith("/pospress/pending-tabs/")
  ) {
    return "/pospress/pending-tabs";
  }
  if (pathname === "/pos/settings" || pathname.startsWith("/pos/settings/")) {
    return "/pos/settings";
  }
  if (
    pathname === "/administration/pos2" ||
    pathname.startsWith("/administration/pos2/") ||
    pathname === "/pos2" ||
    pathname.startsWith("/pos2/")
  ) {
    return "/administration/pos2";
  }
  if (
    pathname === "/pospress" ||
    pathname.startsWith("/pospress/") ||
    pathname === "/pos"
  ) {
    return "/pos";
  }

  // 7. Cortes de Caja
  if (
    pathname === "/cash-cuts/history" ||
    pathname.startsWith("/cash-cuts/history/")) {
    return "/cash-cuts/history";
  }

  // 8. Inventario
  if (
    pathname === "/administration/inventory/branch-counts/statistics" ||
    pathname.startsWith("/administration/inventory/branch-counts/statistics/")
  ) {
    return "/administration/inventory/branch-counts/statistics";
  }
  if (
    pathname === "/administration/inventory" ||
    pathname === "/administration"
  ) {
    return "/administration/inventory";
  }
  if (pathname.startsWith("/equipment/")) {
    return "/administration/inventory/equipment-kits";
  }

  // 9. Coincidencia por prefijo más largo contra todas las claves configurables
  const allKeys = PERMISSION_GROUPS.flatMap((g) => g.modules.map((m) => m.key));
  const matches = allKeys.filter(
    (key) => pathname === key || pathname.startsWith(`${key}/`),
  );

  if (matches.length === 0) return null;

  return matches.sort((a, b) => b.length - a.length)[0];
}

/** Superficies de lectura de inventario para gerentes sin permisos granulares aún configurados. */
export function isInventoryManagerReadPath(pathname: string): boolean {
  return (
    pathname === "/administration/inventory" ||
    pathname === "/administration/inventory/products" ||
    pathname.startsWith("/administration/inventory/products/") ||
    pathname === "/administration/inventory/sucursales" ||
    pathname === "/administration/inventory/sucursales/stock" ||
    pathname === "/administration/inventory/sucursales/legacy-report"
  );
}

/** Roles autorizados a capturar conteo para su sucursal asignada. */
export function isInventoryCountCaptureRole(role: string): boolean {
  return role === "ADMIN" || role === "GERENTE" || role === "OPERATOR";
}

/** Primera pantalla útil después de iniciar sesión, según los permisos asignados. */
export function getDefaultPathForModuleKeys(moduleKeys: string[]): string {
  const effectiveKeys = moduleKeys.includes("/administration/workforce")
    ? [...moduleKeys, "/administration/schedule"]
    : moduleKeys;
  const orderedKeys = PERMISSION_GROUPS.flatMap((group) =>
    group.modules.map((module) => module.key),
  );

  const defaultKey = orderedKeys.find((key) =>
    effectiveKeys.includes(key) ||
    (key === "/pos" && effectiveKeys.includes("/pospress")) ||
    (key === "/administration/inventory" && effectiveKeys.includes("/administration")),
  );

  if (defaultKey === "/pos") return "/pospress";
  if (defaultKey === "/pos/sales") return "/pospress/transactions";
  return defaultKey ?? "/profile";
}
