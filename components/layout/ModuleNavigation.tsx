"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SUBMENUS,
  getCurrentModule,
  matchesRoute,
  type AppModule,
  type SubMenuItem,
} from "./navigation";

export default function ModuleNavigation({
  isOperator,
}: {
  isOperator: boolean;
}) {
  const pathname = usePathname();
  const currentModule = getCurrentModule(pathname);

  if (currentModule === "home") {
    return null;
  }

  const items = SUBMENUS[currentModule].filter(
    (item) => !isOperator || item.operatorAllowed === true
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Navegación del módulo"
      className={`border-t ${getBorderStyle(currentModule)}`}
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-1 px-4 py-2.5">
          {items.map((item) => {
            const isActive = isMenuItemActive(
              pathname,
              item,
              items
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? getActiveStyle(currentModule)
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function isMenuItemActive(
  pathname: string,
  item: SubMenuItem,
  items: SubMenuItem[]
) {
  /*
   * La página inicial de cada módulo solo queda activa
   * cuando la ruta coincide exactamente.
   *
   * Ejemplo:
   * /liquors queda activo únicamente en /liquors,
   * no en /liquors/recipes ni en otras secciones.
   */
  const isModuleHome = items[0]?.href === item.href;

  if (isModuleHome) {
    return pathname === item.href;
  }

  return matchesRoute(pathname, item.href);
}

function getActiveStyle(
  module: Exclude<AppModule, "home">
) {
  const styles: Record<
    Exclude<AppModule, "home">,
    string
  > = {
    production:
      "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/20",
    liquors:
      "bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/20",
    "cash-cuts":
      "bg-green-500/15 text-green-300 ring-1 ring-green-500/20",
    administration:
      "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20",
  };

  return styles[module];
}

function getBorderStyle(
  module: Exclude<AppModule, "home">
) {
  const styles: Record<
    Exclude<AppModule, "home">,
    string
  > = {
    production: "border-amber-400/10",
    liquors: "border-purple-500/10",
    "cash-cuts": "border-green-500/10",
    administration: "border-blue-500/10",
  };

  return styles[module];
}