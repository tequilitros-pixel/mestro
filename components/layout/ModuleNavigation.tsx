"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SUBMENUS,
  getCurrentModule,
  matchesRoute,
  type AppModule,
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
      className={`overflow-x-auto border-t ${getBorderStyle(
        currentModule
      )}`}
    >
      <div className="flex min-w-max gap-1 px-4 py-2.5">
        {items.map((item) => {
          const isActive = matchesRoute(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
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
    </nav>
  );
}

function getActiveStyle(
  module: Exclude<AppModule, "home">
) {
  const styles: Record<
    Exclude<AppModule, "home">,
    string
  > = {
    production:
      "bg-amber-400/15 text-amber-300",
    liquors:
      "bg-purple-500/15 text-purple-300",
    "cash-cuts":
      "bg-green-500/15 text-green-300",
    administration:
      "bg-blue-500/15 text-blue-300",
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