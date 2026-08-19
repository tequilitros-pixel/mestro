export type PermissionModule = {
  key: string;
  label: string;
};

export type PermissionGroup = {
  group: string;
  modules: PermissionModule[];
};

/** Pantallas personales disponibles para cualquier usuario con sesión. */
export const ALWAYS_AVAILABLE_PATHS = [
  "/timeclock",
  "/timeclock/calendar",
  "/timeclock/availability",
  "/timeclock/requests",
] as const;

/** Acceso histórico para operadores que aún no tienen permisos configurados. */
export const LEGACY_OPERATOR_PERMISSION_KEYS = [
  "/cooking",
  "/milling",
  "/fermentation",
  "/distillation",
] as const;

/** Secciones protegidas por rol ADMIN y que no deben ofrecerse como permisos. */
export const ADMIN_ONLY_PATH_PREFIXES = [
  "/administration/personnel",
  "/administration/schedule",
  "/timeclock/payroll",
  "/timeclock/geofences",
  "/pos/categories",
  "/pos/products",
  "/pos/settings",
] as const;

export function isAlwaysAvailablePath(pathname: string): boolean {
  return ALWAYS_AVAILABLE_PATHS.some((path) => pathname === path);
}

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATH_PREFIXES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "Proceso de Producción",
    modules: [
      { key: "/plant", label: "Planta" },
      { key: "/lots", label: "Lotes" },
      { key: "/cooking", label: "Cocción" },
      { key: "/milling", label: "Molienda" },
      { key: "/fermentation", label: "Fermentación" },
      { key: "/distillation", label: "Destilación" },
      { key: "/costs", label: "Costos" },
      { key: "/control-room", label: "Sala de control" },
    ],
  },
  {
    group: "Elaboración de Licores",
    modules: [
      { key: "/liquors", label: "Inicio" },
      { key: "/liquors/recipes", label: "Recetas" },
      { key: "/liquors/raw-materials", label: "Materia prima" },
      { key: "/liquors/batches", label: "Lotes" },
      { key: "/liquors/production", label: "Producción" },
      { key: "/liquors/bottling", label: "Embotellado" },
      { key: "/liquors/inventory", label: "Inventario" },
      { key: "/liquors/qr", label: "QR" },
      { key: "/liquors/expiration", label: "Caducidad" },
    ],
  },
  {
    group: "Cortes de Caja",
    modules: [
      { key: "/cash-cuts", label: "Inicio" },
      { key: "/cash-cuts/dashboard", label: "Dashboard" },
      { key: "/cash-cuts/branches", label: "Sucursales" },
      { key: "/cash-cuts/daily", label: "Cortes" },
      { key: "/cash-cuts/expenses", label: "Salidas" },
      { key: "/cash-cuts/envelopes", label: "Sobres" },
      { key: "/cash-cuts/safe", label: "Caja fuerte" },
      { key: "/cash-cuts/audit", label: "Auditoría" },
      { key: "/cash-cuts/history", label: "Historial" },
    ],
  },
  {
    group: "Punto de Venta",
    modules: [
      { key: "/pos", label: "Vender" },
      { key: "/pos/sales", label: "Ventas" },
      { key: "/pos/discounts/rules", label: "Descuentos · Administrar" },
      { key: "/pos/discounts/courtesies", label: "Descuentos · Cortesías" },
      { key: "/pos/discounts/employees", label: "Descuentos · Trabajadores" },
      { key: "/pos/discounts/products", label: "Descuentos · Productos" },
    ],
  },
  {
    group: "Administración",
    modules: [
      { key: "/administration/inventory/products", label: "Productos" },
      { key: "/administration/inventory/eventos", label: "Inventario de eventos (resumen)" },
      { key: "/administration/inventory/event-packages", label: "Paquetes de eventos" },
      { key: "/administration/inventory/equipment-kits", label: "Modalidades de equipo" },
      { key: "/administration/inventory/events", label: "Eventos" },
      { key: "/administration/inventory/sucursales", label: "Inventario de sucursales · Resumen" },
      { key: "/administration/inventory/sucursales/stock", label: "Inventario de sucursales · Stock actual" },
      { key: "/administration/inventory/branch-entries", label: "Inventario de sucursales · Entradas y ajustes" },
      { key: "/administration/inventory/sucursales/traspasos", label: "Inventario de sucursales · Traspasos" },
      { key: "/administration/inventory/branch-counts", label: "Conteo semanal" },
    ],
  },
];

const CONFIGURABLE_PERMISSION_KEYS = new Set(
  PERMISSION_GROUPS.flatMap((group) => group.modules.map((module) => module.key)),
);

export function isConfigurablePermissionKey(key: string): boolean {
  return CONFIGURABLE_PERMISSION_KEYS.has(key);
}

export function getModuleKeyForPath(pathname: string): string | null {
  const allKeys = PERMISSION_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

  const matches = allKeys.filter(
    (key) => pathname === key || pathname.startsWith(`${key}/`),
  );

  if (matches.length === 0) return null;

  return matches.sort((a, b) => b.length - a.length)[0];
}

/** Primera pantalla útil después de iniciar sesión, según los permisos asignados. */
export function getDefaultPathForModuleKeys(moduleKeys: string[]): string {
  const orderedKeys = PERMISSION_GROUPS.flatMap((group) =>
    group.modules.map((module) => module.key),
  );

  return orderedKeys.find((key) => moduleKeys.includes(key)) ?? "/profile";
}
