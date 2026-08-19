import type { ComponentType } from "react";
import type { AppIconVariant } from "@/components/ui/AppIcon";
import {
  getModuleKeyForPath,
  isAdminOnlyPath,
  isAlwaysAvailablePath,
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
  GridIcon,
} from "@/components/ui/icons";

export type AppModule =
  | "home"
  | "production"
  | "liquors"
  | "cash-cuts"
  | "pos"
  | "administration"
  | "timeclock"
  | "personnel";

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
    href: "/administration",
    label: "Inventario",
    shortLabel: "Inventario",
    icon: PackageIcon,
    iconVariant: "orange",
    module: "administration",
  },
  {
    href: "/pos",
    label: "Punto de Venta",
    shortLabel: "Ventas",
    icon: CashRegisterIcon,
    iconVariant: "cyan",
    module: "pos",
  },
  {
    href: "/timeclock",
    label: "Horario",
    shortLabel: "Horario",
    icon: ClockIcon,
    iconVariant: "blue",
    module: "timeclock",
  },
  {
    href: "/administration/personnel",
    label: "Personal",
    shortLabel: "Personal",
    icon: UsersIcon,
    iconVariant: "purple",
    module: "personnel",
  },
];

export const SUBMENUS: Record<
  Exclude<AppModule, "home">,
  SubMenuItem[]
> = {
  production: [
    {
      href: "/plant",
      label: "Planta",
      icon: FactoryIcon,
      iconVariant: "slate",
    },
    {
      href: "/lots",
      label: "Lotes",
      icon: PackageIcon,
      iconVariant: "purple",
    },
    {
      href: "/cooking",
      label: "Cocción",
      icon: FlameIcon,
      iconVariant: "orange",
      operatorAllowed: true,
    },
    {
      href: "/milling",
      label: "Molienda",
      icon: GearIcon,
      iconVariant: "blue",
      operatorAllowed: true,
    },
    {
      href: "/fermentation",
      label: "Fermentación",
      icon: FlaskIcon,
      iconVariant: "green",
      operatorAllowed: true,
    },
    {
      href: "/distillation",
      label: "Destilación",
      icon: GlassWaterIcon,
      iconVariant: "purple",
      operatorAllowed: true,
    },
    {
      href: "/costs",
      label: "Costos",
      icon: CoinsIcon,
      iconVariant: "green",
    },
    {
      href: "/control-room",
      label: "Sala",
      icon: BrainIcon,
      iconVariant: "cyan",
    },
  ],

  liquors: [
    {
      href: "/liquors",
      label: "Inicio",
      icon: HomeIcon,
      iconVariant: "blue",
    },
    {
      href: "/liquors/recipes",
      label: "Recetas",
      icon: BookIcon,
      iconVariant: "purple",
    },
    {
      href: "/liquors/raw-materials",
      label: "Materia prima",
      icon: FlaskIcon,
      iconVariant: "green",
    },
    {
      href: "/liquors/batches",
      label: "Lotes",
      icon: TagIcon,
      iconVariant: "purple",
    },
    {
      href: "/liquors/production",
      label: "Producción",
      icon: MartiniIcon,
      iconVariant: "purple",
    },
    {
      href: "/liquors/bottling",
      label: "Embotellado",
      icon: BottleIcon,
      iconVariant: "cyan",
    },
    {
      href: "/liquors/inventory",
      label: "Inventario",
      icon: PackageIcon,
      iconVariant: "orange",
    },
    {
      href: "/liquors/qr",
      label: "QR",
      icon: QrIcon,
      iconVariant: "slate",
    },
    {
      href: "/liquors/expiration",
      label: "Caducidad",
      icon: CalendarIcon,
      iconVariant: "amber",
    },
  ],

  "cash-cuts": [
    {
      href: "/cash-cuts",
      label: "Inicio",
      icon: HomeIcon,
      iconVariant: "blue",
    },
    {
      href: "/cash-cuts/branches",
      label: "Sucursales",
      icon: StoreIcon,
      iconVariant: "orange",
    },
    {
      href: "/cash-cuts/daily",
      label: "Cortes",
      icon: WalletIcon,
      iconVariant: "green",
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
        },
        {
          href: "/cash-cuts/expenses",
          label: "Salidas",
          icon: UploadIcon,
        },
        {
          href: "/cash-cuts/envelopes",
          label: "Sobres",
          icon: MailIcon,
        },
        {
          href: "/cash-cuts/safe",
          label: "Caja fuerte",
          icon: LockIcon,
        },
        {
          href: "/cash-cuts/audit",
          label: "Auditoría",
          icon: SearchIcon,
        },
        {
          href: "/cash-cuts/history",
          label: "Historial",
          icon: ChartBarIcon,
        },
      ],
    },
  ],

  pos: [
    {
      href: "/pos",
      label: "Vender",
      icon: CashRegisterIcon,
      iconVariant: "cyan",
    },
    {
      href: "/pos/sales",
      label: "Ventas",
      icon: ChartLineIcon,
      iconVariant: "green",
    },
    {
      href: "/pos/discounts/courtesies",
      label: "Descuentos",
      icon: TagIcon,
      iconVariant: "blue",
      children: [
        {
          href: "/pos/discounts/rules",
          label: "Administrar",
          icon: GearIcon,
          iconVariant: "blue",
        },
        {
          href: "/pos/discounts/courtesies",
          label: "Cortesías",
          icon: PartyIcon,
          iconVariant: "purple",
        },
        {
          href: "/pos/discounts/employees",
          label: "Trabajadores",
          icon: UsersIcon,
          iconVariant: "blue",
        },
        {
          href: "/pos/discounts/products",
          label: "Productos",
          icon: PackageIcon,
          iconVariant: "orange",
        },
      ],
    },
    {
      href: "/pos/categories",
      label: "Categorías",
      icon: GridIcon,
      iconVariant: "purple",
    },
    {
      href: "/pos/products",
      label: "Productos",
      icon: PackageIcon,
      iconVariant: "orange",
    },
  ],

  administration: [
    {
      href: "/administration",
      label: "Inicio",
      icon: HomeIcon,
      iconVariant: "blue",
    },
    {
      href: "/administration/inventory/products",
      label: "Productos",
      icon: PackageIcon,
      iconVariant: "orange",
    },
    {
      href: "/administration/inventory/eventos",
      label: "Inventario de eventos",
      icon: PartyIcon,
      iconVariant: "purple",
      children: [
        {
          href: "/administration/inventory/eventos",
          label: "Resumen",
          icon: PartyIcon,
        },
        {
          href: "/administration/inventory/event-packages",
          label: "Paquetes de eventos",
          icon: MartiniIcon,
        },
        {
          href: "/administration/inventory/equipment-kits",
          label: "Modalidades de equipo",
          icon: ToolboxIcon,
        },
        {
          href: "/administration/inventory/events",
          label: "Eventos",
          icon: ClipboardIcon,
        },
      ],
    },
    {
      href: "/administration/inventory/sucursales",
      label: "Inventario de sucursales",
      icon: StoreIcon,
      iconVariant: "orange",
      children: [
        {
          href: "/administration/inventory/sucursales",
          label: "Resumen",
          icon: StoreIcon,
        },
        {
          href: "/administration/inventory/sucursales/stock",
          label: "Stock actual",
          icon: ChartBarIcon,
        },
        {
          href: "/administration/inventory/branch-entries",
          label: "Entradas y ajustes",
          icon: InboxIcon,
        },
        {
          href: "/administration/inventory/sucursales/traspasos",
          label: "Traspasos",
          icon: ArrowsRangeIcon,
        },
        {
          href: "/administration/inventory/branch-counts",
          label: "Conteos semanales",
          icon: ListChecksIcon,
        },
      ],
    },
  ],

  timeclock: [
    {
      href: "/timeclock",
      label: "Checador",
      icon: ClockIcon,
      iconVariant: "blue",
      operatorAllowed: true,
    },
    {
      href: "/timeclock/calendar",
      label: "Calendario",
      icon: CalendarIcon,
      iconVariant: "amber",
      operatorAllowed: true,
    },
    {
      href: "/timeclock/availability",
      label: "Mi disponibilidad",
      icon: CalendarIcon,
      iconVariant: "green",
      operatorAllowed: true,
    },
    {
      href: "/timeclock/requests",
      label: "Solicitudes",
      icon: CalendarIcon,
      iconVariant: "purple",
      operatorAllowed: true,
    },
    {
      href: "/administration/schedule",
      label: "Programar horarios",
      icon: CalendarIcon,
      iconVariant: "purple",
    },
    {
      href: "/timeclock/payroll",
      label: "Nómina",
      icon: DollarIcon,
      iconVariant: "green",
    },
    {
      href: "/timeclock/geofences",
      label: "Geozona",
      icon: MapPinIcon,
      iconVariant: "cyan",
    },
  ],

  personnel: [
    {
      href: "/administration/personnel",
      label: "Personal",
      icon: UsersIcon,
      iconVariant: "purple",
    },
    {
      href: "/administration/personnel/timeclock",
      label: "Turnos abiertos",
      icon: ClockIcon,
      iconVariant: "blue",
    },
    {
      href: "/administration/personnel/notifications",
      label: "Notificaciones",
      icon: BellIcon,
      iconVariant: "amber",
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
  if (matchesRoute(pathname, "/liquors")) {
    return "liquors";
  }

  if (matchesRoute(pathname, "/cash-cuts")) {
    return "cash-cuts";
  }

  if (matchesRoute(pathname, "/pos")) {
    return "pos";
  }

  if (matchesRoute(pathname, "/administration/personnel")) {
    return "personnel";
  }

  if (matchesRoute(pathname, "/administration/schedule")) {
    return "timeclock";
  }

  if (matchesRoute(pathname, "/administration")) {
    return "administration";
  }

  if (matchesRoute(pathname, "/timeclock")) {
    return "timeclock";
  }

  const productionPaths = [
    "/plant",
    "/lots",
    "/cooking",
    "/milling",
    "/fermentation",
    "/distillation",
    "/costs",
    "/control-room",
  ];

  const isProduction = productionPaths.some((path) =>
    matchesRoute(pathname, path)
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
  item: SubMenuItem
): boolean {
  if (role === "ADMIN") return true;

  // Compatibilidad con operadores antiguos: si todavía no tienen permisos
  // configurados conservan su acceso fijo de producción. En cuanto el admin
  // les asigna permisos, se respeta exactamente esa configuración.
  if (role === "OPERATOR" && moduleKeys.length === 0) {
    return item.href === "/" || item.operatorAllowed === true;
  }

  /*
   * Un item "padre" (con hijos de tercer nivel) es visible en
   * cuanto alguno de sus hijos lo sea — el propio href del padre
   * (por convención, el primer hijo) no necesita su propio permiso.
   */
  if (item.children) {
    return item.children.some((child) =>
      isSubmenuItemVisible(role, moduleKeys, child)
    );
  }

  if (isAlwaysAvailablePath(item.href)) return true;
  if (isAdminOnlyPath(item.href)) return false;

  const permissionHref = item.permissionKey ?? item.href;
  const requiredKey = item.permissionKey
    ? item.permissionKey
    : (getModuleKeyForPath(permissionHref) ?? permissionHref);

  // Se compara el permiso resuelto de forma exacta. Así `/pos` (Vender)
  // no concede accidentalmente `/pos/sales` (Ventas), mientras que las
  // rutas sin permiso propio siguen heredando el módulo padre correcto.
  return moduleKeys.includes(requiredKey);
}

export function isMainModuleVisible(
  role: string,
  moduleKeys: string[],
  module: MainModule
): boolean {
  if (role === "ADMIN") return true;

  if (role === "OPERATOR" && moduleKeys.length === 0) {
    // El operador conserva su acceso fijo de siempre: solo Producción.
    return module.module === "production";
  }

  if (module.module === "home") return true;
  if (module.module === "timeclock") return true;

  const items = SUBMENUS[module.module as Exclude<AppModule, "home">] ?? [];

  return items.some((item) =>
    isSubmenuItemVisible(role, moduleKeys, item)
  );
}

/** Ruta segura de un tab padre: abre el primer hijo realmente autorizado. */
export function getSubmenuItemDestination(
  role: string,
  moduleKeys: string[],
  item: SubMenuItem,
): string {
  if (!item.children) return item.href;

  return item.children.find((child) =>
    isSubmenuItemVisible(role, moduleKeys, child),
  )?.href ?? item.href;
}
