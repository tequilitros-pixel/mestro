import type { ComponentType } from "react";
import {
  type IconProps,
  HomeIcon,
  FactoryIcon,
  MartiniIcon,
  WalletIcon,
  PackageIcon,
  ClockIcon,
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
  module: AppModule;
};

export type SubMenuItem = {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  operatorAllowed?: boolean;
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
    module: "home",
  },
  {
    href: "/plant",
    label: "Proceso de Producción",
    shortLabel: "Producción",
    icon: FactoryIcon,
    module: "production",
  },
  {
    href: "/liquors",
    label: "Elaboración de Licores",
    shortLabel: "Licores",
    icon: MartiniIcon,
    module: "liquors",
  },
  {
    href: "/cash-cuts",
    label: "Cortes de Caja",
    shortLabel: "Cortes",
    icon: WalletIcon,
    module: "cash-cuts",
  },
  {
    href: "/administration",
    label: "Inventario",
    shortLabel: "Inventario",
    icon: PackageIcon,
    module: "administration",
  },
  {
    href: "/pos",
    label: "Punto de Venta",
    shortLabel: "Ventas",
    icon: CashRegisterIcon,
    module: "pos",
  },
  {
    href: "/timeclock",
    label: "Horario",
    shortLabel: "Horario",
    icon: ClockIcon,
    module: "timeclock",
  },
  {
    href: "/administration/personnel",
    label: "Personal",
    shortLabel: "Personal",
    icon: UsersIcon,
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
    },
    {
      href: "/lots",
      label: "Lotes",
      icon: PackageIcon,
    },
    {
      href: "/cooking",
      label: "Cocción",
      icon: FlameIcon,
      operatorAllowed: true,
    },
    {
      href: "/milling",
      label: "Molienda",
      icon: GearIcon,
      operatorAllowed: true,
    },
    {
      href: "/fermentation",
      label: "Fermentación",
      icon: FlaskIcon,
      operatorAllowed: true,
    },
    {
      href: "/distillation",
      label: "Destilación",
      icon: GlassWaterIcon,
      operatorAllowed: true,
    },
    {
      href: "/costs",
      label: "Costos",
      icon: CoinsIcon,
    },
    {
      href: "/control-room",
      label: "Sala",
      icon: BrainIcon,
    },
  ],

  liquors: [
    {
      href: "/liquors",
      label: "Inicio",
      icon: HomeIcon,
    },
    {
      href: "/liquors/recipes",
      label: "Recetas",
      icon: BookIcon,
    },
    {
      href: "/liquors/raw-materials",
      label: "Materia prima",
      icon: FlaskIcon,
    },
    {
      href: "/liquors/batches",
      label: "Lotes",
      icon: TagIcon,
    },
    {
      href: "/liquors/production",
      label: "Producción",
      icon: MartiniIcon,
    },
    {
      href: "/liquors/bottling",
      label: "Embotellado",
      icon: BottleIcon,
    },
    {
      href: "/liquors/inventory",
      label: "Inventario",
      icon: PackageIcon,
    },
    {
      href: "/liquors/qr",
      label: "QR",
      icon: QrIcon,
    },
    {
      href: "/liquors/expiration",
      label: "Caducidad",
      icon: CalendarIcon,
    },
  ],

  "cash-cuts": [
    {
      href: "/cash-cuts",
      label: "Inicio",
      icon: HomeIcon,
    },
    {
      href: "/cash-cuts/branches",
      label: "Sucursales",
      icon: StoreIcon,
    },
    {
      href: "/cash-cuts/dashboard",
      label: "Control",
      icon: ChartLineIcon,
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
    },
    {
      href: "/pos/sales",
      label: "Ventas",
      icon: ChartLineIcon,
    },
    {
      href: "/pos/categories",
      label: "Categorías",
      icon: GridIcon,
    },
    {
      href: "/pos/products",
      label: "Productos",
      icon: PackageIcon,
    },
  ],

  administration: [
    {
      href: "/administration",
      label: "Inicio",
      icon: HomeIcon,
    },
    {
      href: "/administration/inventory/products",
      label: "Productos",
      icon: PackageIcon,
    },
    {
      href: "/administration/inventory/eventos",
      label: "Inventario de eventos",
      icon: PartyIcon,
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
      operatorAllowed: true,
    },
    {
      href: "/timeclock/calendar",
      label: "Calendario",
      icon: CalendarIcon,
      operatorAllowed: true,
    },
    {
      href: "/administration/schedule",
      label: "Programar horarios",
      icon: CalendarIcon,
    },
    {
      href: "/timeclock/payroll",
      label: "Nómina",
      icon: DollarIcon,
    },
    {
      href: "/timeclock/geofences",
      label: "Geozona",
      icon: MapPinIcon,
    },
  ],

  personnel: [
    {
      href: "/administration/personnel",
      label: "Personal",
      icon: UsersIcon,
    },
    {
      href: "/administration/personnel/timeclock",
      label: "Turnos abiertos",
      icon: ClockIcon,
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

// Rutas sin candado de permisos: cualquier usuario con sesión
// puede entrar (checador, calendario propio, inicio de módulos
// informativos).
const ALWAYS_VISIBLE_HREFS = new Set<string>([
  "/",
  "/administration",
  "/timeclock",
  "/timeclock/calendar",
]);

// Rutas protegidas directamente por rol ADMIN en el servidor,
// sin pasar por ModulePermission.
const ADMIN_ONLY_HREFS = new Set<string>([
  "/administration/schedule",
  "/timeclock/payroll",
  "/timeclock/geofences",
  "/pos/categories",
  "/pos/products",
]);

export function isSubmenuItemVisible(
  role: string,
  moduleKeys: string[],
  item: SubMenuItem
): boolean {
  if (role === "ADMIN") return true;

  if (role === "OPERATOR") {
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

  if (ALWAYS_VISIBLE_HREFS.has(item.href)) return true;
  if (ADMIN_ONLY_HREFS.has(item.href)) return false;

  /*
   * Coincidencia por prefijo, igual que getModuleKeyForPath en
   * permission-modules.ts: una ruta como /sucursales/stock hereda
   * el permiso de /sucursales aunque no tenga su propia entrada en
   * PERMISSION_GROUPS, así que el tab debe seguir el mismo criterio
   * o quedaría oculto para roles con acceso real a la página.
   */
  return moduleKeys.some(
    (key) => item.href === key || item.href.startsWith(`${key}/`)
  );
}

export function isMainModuleVisible(
  role: string,
  moduleKeys: string[],
  module: MainModule
): boolean {
  if (role === "ADMIN") return true;

  if (role === "OPERATOR") {
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
