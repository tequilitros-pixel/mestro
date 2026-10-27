import type { ComponentType } from "react";
import type { AppIconVariant } from "@/components/ui/AppIcon";
import {
  getModuleKeyForPath,
  isConfigurablePermissionKey,
  isInventoryManagerReadPath,
  isAdminOnlyPath,
  isAlwaysAvailablePath,
  isInventoryCountCaptureRole,
} from "@/lib/permission-modules";
import {
  type IconProps,
  HomeIcon,
  FactoryIcon,
  MartiniIcon,
  WalletIcon,
  PackageIcon,
  ClockIcon,
  BellIcon,
  UsersIcon,
  FlameIcon,
  GearIcon,
  FlaskIcon,
  GlassWaterIcon,
  CoinsIcon,
  BrainIcon,
  BookIcon,
  TagIcon,
  BottleIcon,
  QrIcon,
  CalendarIcon,
  ChartLineIcon,
  ChartBarIcon,
  ReceiptIcon,
  StoreIcon,
  UploadIcon,
  MailIcon,
  LockIcon,
  SearchIcon,
  MapPinIcon,
  PartyIcon,
  DollarIcon,
  ToolboxIcon,
  ClipboardIcon,
  InboxIcon,
  ListChecksIcon,
  ArrowsRangeIcon,
  CashRegisterIcon,
  PrinterIcon,
} from "@/components/ui/icons";

export type AppModule =
  | "home"
  | "production"
  | "liquors"
  | "cash-cuts"
  | "accounting"
  | "pos"
  | "administration"
  | "timeclock"
  | "personnel"
  | "tequilitros-quote";

export type MainModule = {
  href: string;
  label: string;
  shortLabel: string;
  icon: ComponentType<IconProps>;
  iconVariant: AppIconVariant;
  module: AppModule;
};

export type SubMenuItem = {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  iconVariant?: AppIconVariant;
  operatorAllowed?: boolean;
  /** Permiso que controla este enlace cuando su ruta comparte acceso con otra sección. */
  permissionKey?: string;
  /** Cualquiera de estos permisos permite mostrar el enlace. */
  permissionKeys?: string[];
  /**
   * Agrupa visualmente los tabs de un submenú bajo un encabezado
   * corto (ej. "Inventario de eventos"). Los items sin `group`
   * se renderizan planos, como antes.
   */
  group?: string;
  /**
   * Tercer nivel de navegación: sub-secciones que solo aparecen,
   * en una fila propia, cuando este item (o alguno de sus hijos)
   * está activo. El item padre sigue siendo un link normal — por
   * convención apunta al primer hijo.
   */
  children?: SubMenuItem[];
  /**
   * Historical permission-route compatibility. These entries keep existing
   * grants resolvable while the visible destination is POSpress.
   */
  legacyAlias?: boolean;
};

export const MAIN_MODULES: MainModule[] = [
  {
    href: "/",
    label: "Inicio",
    shortLabel: "Inicio",
    icon: HomeIcon,
    iconVariant: "blue",
    module: "home",
  },
  {
    href: "/plant",
    label: "Proceso de Producción",
    shortLabel: "Producción",
    icon: FactoryIcon,
    iconVariant: "blueDeep",
    module: "production",
  },
  {
    href: "/liquors",
    label: "Elaboración de Licores",
    shortLabel: "Licores",
    icon: MartiniIcon,
    iconVariant: "purple",
    module: "liquors",
  },
  {
    href: "/cash-cuts",
    label: "Cortes de Caja",
    shortLabel: "Cortes",
    icon: WalletIcon,
    iconVariant: "green",
    module: "cash-cuts",
  },
  {
    href: "/accounting",
    label: "Contabilidad",
    shortLabel: "Contabilidad",
    icon: ReceiptIcon,
    iconVariant: "amber",
    module: "accounting",
  },
  {
    href: "/administration",
    label: "Inventario",
    shortLabel: "Inventario",
    icon: PackageIcon,
    iconVariant: "orange",
    module: "administration",
  },
  {
    href: "/pospress",
    label: "Ventas",
    shortLabel: "Ventas",
    icon: CashRegisterIcon,
    iconVariant: "cyan",
    module: "pos",
  },
  {
    href: "/timeclock",
    label: "Checador y horario",
    shortLabel: "Checador",
    icon: ClockIcon,
    iconVariant: "blue",
    module: "timeclock",
  },
  {
    href: "/cotizador-tequilitros",
    label: "Cotizar Tequilitros",
    shortLabel: "Cotizador",
    icon: PartyIcon,
    iconVariant: "orange",
    module: "tequilitros-quote",
  },
  {
    href: "/administration/personnel",
    label: "Usuarios y permisos",
    shortLabel: "Usuarios",
    icon: UsersIcon,
    iconVariant: "purple",
    module: "personnel",
  },
];

export const SUBMENUS: Record<Exclude<AppModule, "home">, SubMenuItem[]> = {
  accounting: [
    { href: "/accounting", label: "Contabilidad", icon: ReceiptIcon, iconVariant: "amber", permissionKey: "/accounting" },
    { href: "/administration/financial-categories", label: "Categorías", icon: TagIcon, iconVariant: "amber", permissionKey: "/administration/financial-categories" },
  ],
  production: [
    {
      href: "/plant",
      label: "Planta",
      icon: FactoryIcon,
      iconVariant: "slate",
      permissionKey: "/plant",
    },
    {
      href: "/lots",
      label: "Lotes",
      icon: PackageIcon,
      iconVariant: "purple",
      permissionKey: "/lots",
    },
    {
      href: "/cooking",
      label: "Cocción",
      icon: FlameIcon,
      iconVariant: "orange",
      operatorAllowed: true,
      permissionKey: "/cooking",
    },
    {
      href: "/boiler",
      label: "Caldera",
      icon: FlameIcon,
      iconVariant: "orange",
      operatorAllowed: true,
      permissionKey: "/boiler",
    },
    {
      href: "/milling",
      label: "Molienda",
      icon: GearIcon,
      iconVariant: "blue",
      operatorAllowed: true,
      permissionKey: "/milling",
    },
    {
      href: "/fermentation",
      label: "Fermentación",
      icon: FlaskIcon,
      iconVariant: "green",
      operatorAllowed: true,
      permissionKey: "/fermentation",
    },
    {
      href: "/distillation",
      label: "Destilación",
      icon: GlassWaterIcon,
      iconVariant: "purple",
      operatorAllowed: true,
      children: [
        {
          href: "/distillation",
          label: "Destilación",
          icon: GlassWaterIcon,
          permissionKey: "/distillation",
        },
        {
          href: "/distillation/statistics",
          label: "Estadísticas",
          icon: ChartLineIcon,
          permissionKey: "/distillation/statistics",
        },
      ],
    },
    {
      href: "/costs",
      label: "Costos",
      icon: CoinsIcon,
      iconVariant: "green",
      permissionKey: "/costs",
    },
    {
      href: "/control-room",
      label: "Sala",
      icon: BrainIcon,
      iconVariant: "cyan",
      permissionKey: "/control-room",
    },
  ],

  liquors: [
    {
      href: "/liquors",
      label: "Inicio",
      icon: HomeIcon,
      iconVariant: "blue",
      permissionKey: "/liquors",
    },
    {
      href: "/liquors/recipes",
      label: "Recetas",
      icon: BookIcon,
      iconVariant: "purple",
      permissionKey: "/liquors/recipes",
    },
    {
      href: "/liquors/raw-materials",
      label: "Materia prima",
      icon: FlaskIcon,
      iconVariant: "green",
      permissionKey: "/liquors/raw-materials",
    },
    {
      href: "/liquors/batches",
      label: "Lotes",
      icon: TagIcon,
      iconVariant: "purple",
      permissionKey: "/liquors/batches",
    },
    {
      href: "/liquors/production",
      label: "Producción",
      icon: MartiniIcon,
      iconVariant: "purple",
      children: [
        {
          href: "/liquors/production",
          label: "Proceso de elaboración",
          icon: MartiniIcon,
          permissionKey: "/liquors/production",
        },
        {
          href: "/liquors/production/labels",
          label: "Crear etiquetas",
          icon: PrinterIcon,
          permissionKey: "/liquors/production/labels",
        },
      ],
    },
    {
      href: "/liquors/bottling",
      label: "Embotellado",
      icon: BottleIcon,
      iconVariant: "cyan",
      permissionKey: "/liquors/bottling",
    },
    {
      href: "/liquors/inventory",
      label: "Inventario",
      icon: PackageIcon,
      iconVariant: "orange",
      permissionKey: "/liquors/inventory",
    },
    {
      href: "/liquors/qr",
      label: "QR",
      icon: QrIcon,
      iconVariant: "slate",
      permissionKey: "/liquors/qr",
    },
    {
      href: "/liquors/expiration",
      label: "Caducidad",
      icon: CalendarIcon,
      iconVariant: "amber",
      permissionKey: "/liquors/expiration",
    },
  ],

  "cash-cuts": [
    {
      href: "/cash-cuts",
      label: "Inicio",
      icon: HomeIcon,
      iconVariant: "blue",
      permissionKey: "/cash-cuts",
    },
    {
      href: "/cash-cuts/branches",
      label: "Sucursales",
      icon: StoreIcon,
      iconVariant: "orange",
      permissionKey: "/cash-cuts/branches",
    },
    {
      href: "/cash-cuts/daily",
      label: "Cortes",
      icon: WalletIcon,
      iconVariant: "green",
      permissionKey: "/cash-cuts/daily",
    },
    {
      href: "/cash-cuts/dashboard",
      label: "Control",
      icon: ChartLineIcon,
      iconVariant: "green",
      children: [
        {
          href: "/cash-cuts/dashboard",
          label: "Dashboard",
          icon: ChartLineIcon,
          permissionKey: "/cash-cuts/dashboard",
        },
        {
          href: "/cash-cuts/expenses",
          label: "Salidas",
          icon: UploadIcon,
          permissionKey: "/cash-cuts/expenses",
        },
        {
          href: "/cash-cuts/envelopes",
          label: "Sobres",
          icon: MailIcon,
          permissionKey: "/cash-cuts/envelopes",
        },
        {
          href: "/cash-cuts/safe",
          label: "Caja fuerte",
          icon: LockIcon,
          permissionKey: "/cash-cuts/safe",
        },
        {
          href: "/cash-cuts/audit",
          label: "Auditoría",
          icon: SearchIcon,
          permissionKey: "/cash-cuts/audit",
        },
        {
          href: "/cash-cuts/history",
          label: "Historial",
          icon: ChartBarIcon,
          permissionKey: "/cash-cuts/history",
        },
      ],
    },
  ],

  pos: [
    {
      href: "/pospress",
      label: "Punto de Venta",
      icon: CashRegisterIcon,
      iconVariant: "cyan",
      permissionKey: "/pos",
    },
    {
      href: "/pos/sales",
      label: "Ventas resumen",
      icon: ChartLineIcon,
      iconVariant: "green",
      permissionKeys: ["/pos", "/pos/sales"],
    },
    {
      href: "/pospress/transactions",
      label: "Transacciones",
      icon: ReceiptIcon,
      iconVariant: "green",
      permissionKey: "/pos/sales",
    },
    {
      href: "/pospress/tables",
      label: "Mesas",
      icon: StoreIcon,
      iconVariant: "purple",
      permissionKeys: ["/pos", "/pospress/tables"],
    },
    {
      href: "/pospress/pending-tabs",
      label: "Cuentas pendientes",
      icon: ClockIcon,
      iconVariant: "amber",
      permissionKeys: ["/pos", "/pospress/pending-tabs"],
    },
    {
      href: "/pospress/catalog",
      label: "Editor de productos",
      icon: PackageIcon,
      iconVariant: "orange",
      permissionKey: "/pospress/catalog",
    },
    {
      href: "/pospress/recipes",
      label: "Recetas POS",
      icon: BookIcon,
      iconVariant: "purple",
      permissionKey: "/pospress/recipes",
    },
    {
      href: "/pospress/discounts",
      label: "Editor de descuentos",
      icon: TagIcon,
      iconVariant: "blue",
      permissionKey: "/pospress/discounts",
    },
    {
      href: "/pos/settings",
      label: "Configuración POS",
      icon: GearIcon,
      iconVariant: "slate",
      permissionKey: "/pos/settings",
    },
    {
      href: "/administration/pos2",
      label: "POS v2 Admin",
      icon: CashRegisterIcon,
      iconVariant: "cyan",
      permissionKey: "/administration/pos2",
    },
  ],

  administration: [
    {
      href: "/administration",
      label: "Inicio",
      icon: HomeIcon,
      iconVariant: "blue",
      permissionKey: "/administration/inventory",
    },
    {
      href: "/administration/inventory/products",
      label: "Productos",
      icon: PackageIcon,
      iconVariant: "orange",
      permissionKey: "/administration/inventory/products",
    },
    {
      href: "/administration/inventory/branch-counts/statistics",
      label: "Dashboard de conteos semanales",
      icon: ChartLineIcon,
      iconVariant: "blueDeep",
      permissionKey: "/administration/inventory/branch-counts/statistics",
    },
    {
      href: "/administration/inventory/eventos",
      label: "Eventos",
      icon: PartyIcon,
      iconVariant: "purple",
      children: [
        {
          href: "/administration/inventory/eventos",
          label: "Resumen",
          icon: PartyIcon,
          permissionKey: "/administration/inventory/eventos",
        },
        {
          href: "/administration/inventory/event-packages",
          label: "Paquetes de eventos",
          icon: MartiniIcon,
          permissionKey: "/administration/inventory/event-packages",
        },
        {
          href: "/administration/inventory/equipment-kits",
          label: "Modalidades de equipo",
          icon: ToolboxIcon,
          permissionKey: "/administration/inventory/equipment-kits",
        },
        {
          href: "/administration/inventory/events",
          label: "Eventos",
          icon: ClipboardIcon,
          permissionKey: "/administration/inventory/events",
        },
      ],
    },
    {
      href: "/administration/inventory/sucursales",
      label: "Sucursales",
      icon: StoreIcon,
      iconVariant: "orange",
      children: [
        {
          href: "/administration/inventory/sucursales",
          label: "Resumen",
          icon: StoreIcon,
          permissionKey: "/administration/inventory/sucursales",
        },
        {
          href: "/administration/inventory/sucursales/stock",
          label: "Stock actual",
          icon: ChartBarIcon,
          permissionKey: "/administration/inventory/sucursales/stock",
        },
        {
          href: "/administration/inventory/branch-entries",
          label: "Entradas y ajustes",
          icon: InboxIcon,
          permissionKey: "/administration/inventory/branch-entries",
        },
        {
          href: "/administration/inventory/sucursales/traspasos",
          label: "Traspasos",
          icon: ArrowsRangeIcon,
          permissionKey: "/administration/inventory/sucursales/traspasos",
        },
        {
          href: "/administration/inventory/branch-counts",
          label: "Conteos semanales",
          icon: ListChecksIcon,
          permissionKey: "/administration/inventory/branch-counts",
        },
        {
          href: "/administration/inventory/branch-counts/statistics",
          label: "Resumen de conteos",
          icon: ChartLineIcon,
          permissionKey: "/administration/inventory/branch-counts/statistics",
        },
      ],
    },
  ],

  timeclock: [
    {
      href: "/timeclock",
      label: "Checador",
      icon: CalendarIcon,
      iconVariant: "green",
      operatorAllowed: true,
      permissionKey: "/timeclock",
      group: "Mi jornada",
    },
    {
      href: "/timeclock/calendar",
      label: "Horario",
      icon: ClockIcon,
      iconVariant: "blue",
      operatorAllowed: true,
      permissionKey: "/timeclock/calendar",
      group: "Mi jornada",
    },
    {
      href: "/timeclock/availability",
      label: "Disponibilidad",
      icon: CalendarIcon,
      iconVariant: "amber",
      operatorAllowed: true,
      permissionKey: "/timeclock/availability",
      group: "Mi jornada",
    },
    {
      href: "/timeclock/hours",
      label: "Horas y pago estimado",
      icon: CalendarIcon,
      iconVariant: "green",
      operatorAllowed: true,
      permissionKey: "/timeclock/hours",
      group: "Mi jornada",
    },
    {
      href: "/timeclock/payroll",
      label: "Nómina y pagos",
      icon: DollarIcon,
      iconVariant: "green",
      operatorAllowed: true,
      permissionKey: "/timeclock/payroll",
      group: "Mi jornada",
    },
    {
      href: "/timeclock/history",
      label: "Historial de asistencia",
      icon: ClockIcon,
      iconVariant: "blue",
      operatorAllowed: true,
      permissionKey: "/timeclock/history",
      group: "Mi jornada",
    },
    {
      href: "/timeclock/requests",
      label: "Solicitudes",
      icon: InboxIcon,
      iconVariant: "amber",
      operatorAllowed: true,
      permissionKey: "/timeclock/requests",
      group: "Mi jornada",
    },
    {
      href: "/timeclock/kiosk",
      label: "Kiosco",
      icon: StoreIcon,
      iconVariant: "purple",
      permissionKey: "/timeclock/kiosk",
      group: "Operación y configuración",
    },
    {
      href: "/administration/personnel",
      label: "Empleados",
      icon: UsersIcon,
      iconVariant: "purple",
      permissionKey: "/administration/personnel",
      group: "Operación y configuración",
    },
    {
      href: "/administration/schedule",
      label: "Programar horarios",
      icon: CalendarIcon,
      iconVariant: "purple",
      permissionKey: "/administration/schedule",
      group: "Operación y configuración",
    },
    {
      href: "/administration/personnel/timeclock",
      label: "Asistencia y correcciones",
      icon: ListChecksIcon,
      iconVariant: "amber",
      permissionKey: "/administration/personnel/timeclock",
      group: "Operación y configuración",
    },
    {
      href: "/timeclock/geofences",
      label: "Geozonas",
      icon: MapPinIcon,
      iconVariant: "cyan",
      permissionKey: "/timeclock/geofences",
      group: "Operación y configuración",
    },
    {
      href: "/administration/personnel/notifications",
      label: "Notificaciones",
      icon: BellIcon,
      iconVariant: "amber",
      permissionKey: "/administration/personnel/notifications",
      group: "Operación y configuración",
    },
  ],

  personnel: [
    {
      href: "/administration/personnel",
      label: "Usuarios y permisos",
      icon: UsersIcon,
      iconVariant: "purple",
      permissionKey: "/administration/personnel",
    },
    {
      href: "/administration/schedule",
      label: "Horarios",
      icon: CalendarIcon,
      iconVariant: "purple",
      permissionKey: "/administration/schedule",
    },
    {
      href: "/administration/personnel/notifications",
      label: "Notificaciones",
      icon: BellIcon,
      iconVariant: "amber",
      permissionKey: "/administration/personnel/notifications",
    },
  ],

  "tequilitros-quote": [
    {
      href: "/cotizador-tequilitros",
      label: "Cotizador",
      icon: PartyIcon,
      iconVariant: "orange",
      operatorAllowed: true,
      permissionKey: "/cotizador-tequilitros",
    },
    {
      href: "/cotizador-tequilitros/calendario",
      label: "Calendario",
      icon: CalendarIcon,
      iconVariant: "amber",
      operatorAllowed: true,
      permissionKey: "/cotizador-tequilitros/calendario",
    },
    {
      href: "/cotizador-tequilitros/historial",
      label: "Cotizaciones",
      icon: ListChecksIcon,
      iconVariant: "blue",
      operatorAllowed: true,
      permissionKey: "/cotizador-tequilitros/historial",
    },
    {
      href: "/cotizador-tequilitros/contratos",
      label: "Recibos y Contratos",
      icon: ClipboardIcon,
      iconVariant: "purple",
      operatorAllowed: true,
      permissionKey: "/cotizador-tequilitros/contratos",
    },
  ],
};

export function matchesRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getCurrentModule(pathname: string): AppModule {
  if (matchesRoute(pathname, "/accounting")) {
    return "accounting";
  }
  if (matchesRoute(pathname, "/liquors")) {
    return "liquors";
  }

  if (matchesRoute(pathname, "/cash-cuts")) {
    return "cash-cuts";
  }

  if (
    matchesRoute(pathname, "/pospress") ||
    matchesRoute(pathname, "/pos2") ||
    matchesRoute(pathname, "/pos")
  ) {
    return "pos";
  }

  if (
    matchesRoute(pathname, "/workforce") ||
    matchesRoute(pathname, "/administration/workforce")
  ) {
    return "timeclock";
  }

  if (
    matchesRoute(pathname, "/administration/schedule") ||
    matchesRoute(pathname, "/administration/personnel/timeclock") ||
    matchesRoute(pathname, "/administration/personnel/notifications")
  ) {
    return "timeclock";
  }

  if (matchesRoute(pathname, "/administration/personnel")) {
    return "personnel";
  }

  if (matchesRoute(pathname, "/administration")) {
    return "administration";
  }

  if (matchesRoute(pathname, "/timeclock")) {
    return "timeclock";
  }

  if (matchesRoute(pathname, "/cotizador-tequilitros")) {
    return "tequilitros-quote";
  }

  const productionPaths = [
    "/plant",
    "/lots",
    "/cooking",
    "/boiler",
    "/milling",
    "/fermentation",
    "/distillation",
    "/costs",
    "/control-room",
  ];

  const isProduction = productionPaths.some((path) =>
    matchesRoute(pathname, path),
  );

  return isProduction ? "production" : "home";
}

export function formatRole(role: string) {
  if (role === "ADMIN") {
    return "Administrador";
  }

  if (role === "OPERATOR") {
    return "Operador";
  }

  return role;
}

/*
 * ==========================================================
 * Visibilidad de navegación según permisos reales
 * ----------------------------------------------------------
 * ADMIN ve todo. OPERATOR conserva su acceso fijo a
 * producción (sin cambios). Cualquier otro rol (GERENTE,
 * ENCARGADO, CONSULTA) solo ve lo que tiene otorgado en la
 * tabla ModulePermission — así la navegación coincide con lo
 * que el servidor realmente le permite abrir
 * (ver lib/auth.ts → requireModuleAccess).
 * ==========================================================
 */

export function isSubmenuItemVisible(
  role: string,
  moduleKeys: string[],
  item: SubMenuItem,
): boolean {
  if (role === "ADMIN") return true;

  if (item.href === "/administration/inventory/branch-counts") {
    return isInventoryCountCaptureRole(role);
  }

  // Compatibilidad con operadores/usuarios antiguos si todavía no tienen permisos
  // configurados. En cuanto el admin les asigna permisos, se respeta esa configuración.
  const hasConfiguredPermissions = moduleKeys.some(isConfigurablePermissionKey);
  if (!hasConfiguredPermissions) {
    if (role === "OPERATOR") {
      return item.href === "/" || item.operatorAllowed === true;
    }
    if (role === "GERENTE" && isInventoryManagerReadPath(item.href)) {
      return true;
    }
    if (isAlwaysAvailablePath(item.href)) {
      return true;
    }
  }

  /*
   * Un item "padre" (con hijos de tercer nivel) es visible en
   * cuanto alguno de sus hijos lo sea — el propio href del padre
   * (por convención, el primer hijo) no necesita su propio permiso.
   */
  if (item.children) {
    return item.children.some((child) =>
      isSubmenuItemVisible(role, moduleKeys, child),
    );
  }

  if (isAdminOnlyPath(item.href)) return false;
  if (!hasConfiguredPermissions && isAlwaysAvailablePath(item.href)) return true;

  const permissionHref = item.permissionKey ?? item.href;
  const requiredKeys = item.permissionKeys ?? [
    item.permissionKey
      ? item.permissionKey
      : (getModuleKeyForPath(permissionHref) ?? permissionHref),
  ];

  // Se compara el permiso resuelto de forma exacta para que cada módulo
  // herede únicamente el permiso que le corresponde.
  return requiredKeys.some((requiredKey) => {
    if (!requiredKey) return false;
    if (moduleKeys.includes(requiredKey)) return true;
    if (requiredKey === "/pos" && moduleKeys.includes("/pospress")) return true;
    if (requiredKey === "/pospress" && moduleKeys.includes("/pos")) return true;
    if (requiredKey === "/administration/inventory" && moduleKeys.includes("/administration")) return true;
    if (requiredKey === "/administration" && moduleKeys.includes("/administration/inventory")) return true;
    return false;
  });
}

export function isMainModuleVisible(
  role: string,
  moduleKeys: string[],
  module: MainModule,
): boolean {
  if (role === "ADMIN") return true;

  const hasConfiguredPermissions = moduleKeys.some(isConfigurablePermissionKey);
  if (role === "OPERATOR" && !hasConfiguredPermissions) {
    // El operador conserva su acceso fijo de producción y cotizador universal si no tiene matriz.
    return module.module === "production" || module.module === "tequilitros-quote";
  }

  if (module.module === "home") return true;

  const items = SUBMENUS[module.module as Exclude<AppModule, "home">] ?? [];

  return items.some((item) => isSubmenuItemVisible(role, moduleKeys, item));
}

/** Ruta segura de un tab padre: abre el primer hijo realmente autorizado. */
export function getSubmenuItemDestination(
  role: string,
  moduleKeys: string[],
  item: SubMenuItem,
): string {
  if (!item.children) return item.href;

  return (
    item.children.find((child) => isSubmenuItemVisible(role, moduleKeys, child))
      ?.href ?? item.href
  );
}

/** Abre el primer destino visible del módulo sin conceder rutas hermanas. */
export function getMainModuleDestination(
  role: string,
  moduleKeys: string[],
  module: MainModule,
): string {
  if (module.module === "home" || role === "ADMIN") return module.href;
  const items = SUBMENUS[module.module as Exclude<AppModule, "home">] ?? [];
  const visible = items.find((item) => isSubmenuItemVisible(role, moduleKeys, item));
  return visible ? getSubmenuItemDestination(role, moduleKeys, visible) : module.href;
}
