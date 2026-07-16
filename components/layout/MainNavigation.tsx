"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MAIN_MODULES,
  getCurrentModule,
  type AppModule,
} from "./navigation";

export default function MainNavigation({
  isOperator,
}: {
  isOperator: boolean;
}) {
  const pathname = usePathname();

  const currentModule = getCurrentModule(pathname);

  const modules = isOperator
    ? MAIN_MODULES.filter((m) => m.module === "production")
    : MAIN_MODULES;

  return (
    <nav className="overflow-x-auto border-t border-slate-800">
      <div className="flex min-w-max gap-2 px-4 py-3">
        {modules.map((module) => {
          const isActive = currentModule === module.module;

          return (
            <Link
              key={module.module}
              href={module.href}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                isActive
                  ? getActiveStyle(module.module)
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <span className="mr-2">{module.icon}</span>

              <span className="hidden lg:inline">
                {module.label}
              </span>

              <span className="lg:hidden">
                {module.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function getActiveStyle(module: AppModule) {
  switch (module) {
    case "home":
      return "bg-slate-100 text-slate-950";

    case "production":
      return "bg-amber-400 text-slate-950";

    case "liquors":
      return "bg-purple-500 text-white";

    case "cash-cuts":
      return "bg-green-500 text-slate-950";

    case "administration":
      return "bg-blue-500 text-white";

    default:
      return "bg-slate-800 text-white";
  }
}