"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MAIN_MODULES,
  getCurrentModule,
  isMainModuleVisible,
} from "./navigation";
import AppIcon from "@/components/ui/AppIcon";

export default function MainNavigation({
  role,
  moduleKeys,
}: {
  role: string;
  moduleKeys: string[];
}) {
  const pathname = usePathname();

  const currentModule = getCurrentModule(pathname);

  const modules = MAIN_MODULES.filter((m) =>
    isMainModuleVisible(role, moduleKeys, m)
  );
  const activeModule = modules.find((module) => module.module === currentModule);

  return (
    <nav
      aria-label="Navegación principal"
      className="border-t border-outline-variant"
    >
      <div className="px-4 py-2.5 md:hidden">
        <details className="group relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 font-semibold text-on-surface marker:hidden">
            <span className="flex min-w-0 items-center gap-2">
              {activeModule && (
                <AppIcon
                  icon={activeModule.icon}
                  variant={activeModule.iconVariant}
                  size="sm"
                />
              )}
              <span className="truncate">{activeModule?.shortLabel ?? "Módulos"}</span>
            </span>
            <span className="ml-3 text-xs text-on-surface-variant group-open:hidden">
              Cambiar
            </span>
            <span className="ml-3 hidden text-xs text-on-surface-variant group-open:inline">
              Cerrar
            </span>
          </summary>

          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-2 shadow-xl">
            {modules.map((module) => {
              const isActive = currentModule === module.module;
              const Icon = module.icon;

              return (
                <Link
                  key={module.module}
                  href={module.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(event) =>
                    event.currentTarget.closest("details")?.removeAttribute("open")
                  }
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <AppIcon icon={Icon} variant={module.iconVariant} size="sm" />
                  <span>{module.shortLabel}</span>
                </Link>
              );
            })}
          </div>
        </details>
      </div>

      <div className="hidden min-w-max gap-2 overflow-x-auto px-4 py-3 md:flex">
        {modules.map((module) => {
          const isActive = currentModule === module.module;

          return (
            <Link
              key={module.module}
              href={module.href}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-bold transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] ${
                isActive
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              <AppIcon
                icon={module.icon}
                variant={module.iconVariant}
                size="sm"
                className="mr-2"
              />
              <span className="hidden lg:inline">{module.label}</span>
              <span className="lg:hidden">{module.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
