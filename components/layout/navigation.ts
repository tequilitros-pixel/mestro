export type AppModule =
  | "home"
  | "production"
  | "liquors"
  | "cash-cuts"
  | "administration";

export type MainModule = {
  href: string;
  label: string;
  shortLabel: string;
  icon: string;
  module: AppModule;
};

export type SubMenuItem = {
  href: string;
  label: string;
  operatorAllowed?: boolean;
};

export const MAIN_MODULES: MainModule[] = [
  {
    href: "/",
    label: "Inicio",
    shortLabel: "Inicio",
    icon: "🏠",
    module: "home",
  },
  {
    href: "/plant",
    label: "Proceso de Producción",
    shortLabel: "Producción",
    icon: "🥃",
    module: "production",
  },
  {
    href: "/liquors",
    label: "Elaboración de Licores",
    shortLabel: "Licores",
    icon: "🍹",
    module: "liquors",
  },
  {
    href: "/cash-cuts",
    label: "Cortes de Caja",
    shortLabel: "Cortes",
    icon: "💰",
    module: "cash-cuts",
  },
  {
    href: "/administration",
    label: "Administración",
    shortLabel: "Administración",
    icon: "🏢",
    module: "administration",
  },
];

export const SUBMENUS: Record<
  Exclude<AppModule, "home">,
  SubMenuItem[]
> = {
  production: [
    {
      href: "/plant",
      label: "🏭 Planta",
    },
    {
      href: "/lots",
      label: "📦 Lotes",
    },
    {
      href: "/cooking",
      label: "🔥 Cocción",
      operatorAllowed: true,
    },
    {
      href: "/milling",
      label: "⚙️ Molienda",
      operatorAllowed: true,
    },
    {
      href: "/fermentation",
      label: "🧪 Fermentación",
      operatorAllowed: true,
    },
    {
      href: "/distillation",
      label: "🥃 Destilación",
      operatorAllowed: true,
    },
    {
      href: "/costs",
      label: "💰 Costos",
    },
    {
      href: "/control-room",
      label: "🧠 Sala",
    },
  ],

  liquors: [
    {
      href: "/liquors",
      label: "🏠 Inicio",
    },
    {
      href: "/liquors/recipes",
      label: "📖 Recetas",
    },
    {
      href: "/liquors/batches",
      label: "🏷️ Lotes",
    },
    {
      href: "/liquors/production",
      label: "🍹 Producción",
    },
    {
      href: "/liquors/bottling",
      label: "🍾 Embotellado",
    },
    {
      href: "/liquors/inventory",
      label: "📦 Inventario",
    },
    {
      href: "/liquors/qr",
      label: "▣ QR",
    },
    {
      href: "/liquors/expiration",
      label: "📅 Caducidad",
    },
  ],

  "cash-cuts": [
    {
      href: "/cash-cuts",
      label: "🏠 Inicio",
    },
    {
      href: "/cash-cuts/branches",
      label: "🏪 Sucursales",
    },
    
    {
      href: "/cash-cuts/daily",
      label: "🧾 Cortes",
    },
    {
      href: "/cash-cuts/expenses",
      label: "📤 Salidas",
    },
    {
      href: "/cash-cuts/envelopes",
      label: "✉️ Sobres",
    },
    {
      href: "/cash-cuts/safe",
      label: "🔐 Caja fuerte",
    },
    {
      href: "/cash-cuts/history",
      label: "📊 Historial",
    },
  ],

  administration: [
    {
      href: "/administration",
      label: "🏠 Inicio",
    },
    {
      href: "/administration/finances",
      label: "💰 Finanzas",
    },
    {
      href: "/administration/purchases",
      label: "🛒 Compras",
    },
    {
      href: "/administration/suppliers",
      label: "🚚 Proveedores",
    },
    {
      href: "/administration/personnel",
      label: "👥 Personal",
    },
    {
      href: "/administration/reports",
      label: "📊 Reportes",
    },
    {
      href: "/administration/settings",
      label: "⚙️ Configuración",
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

  if (matchesRoute(pathname, "/administration")) {
    return "administration";
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