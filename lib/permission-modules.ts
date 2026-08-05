export type PermissionModule = {
  key: string;
  label: string;
};

export type PermissionGroup = {
  group: string;
  modules: PermissionModule[];
};

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
      { key: "/pos/categories", label: "Categorías (solo Admin)" },
      { key: "/pos/products", label: "Productos (solo Admin)" },
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
      { key: "/administration/inventory/sucursales", label: "Inventario de sucursales (resumen, stock y traspasos)" },
      { key: "/administration/inventory/branch-entries", label: "Entradas de inventario" },
      { key: "/administration/inventory/branch-counts", label: "Conteo semanal" },
      { key: "/administration/personnel", label: "Personal (solo Admin)" },
    ],
  },
];
export function getModuleKeyForPath(pathname: string): string | null {
  const allKeys = PERMISSION_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

  const matches = allKeys.filter(
    (key) => pathname === key || pathname.startsWith(`${key}/`),
  );

  if (matches.length === 0) return null;

  return matches.sort((a, b) => b.length - a.length)[0];
}
