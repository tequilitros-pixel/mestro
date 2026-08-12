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

      <div className="relative hidden px-4 py-2.5 md:block">
        <details className="group relative">
          <summary className="flex min-h-12 w-fit min-w-72 cursor-pointer list-none items-center gap-3 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-on-surface shadow-sm transition hover:bg-surface-container-high marker:hidden">
            {activeModule && (
              <AppIcon
                icon={activeModule.icon}
                variant={activeModule.iconVariant}
                size="sm"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-on-surface-variant">
                Módulo actual
              </span>
              <span className="block truncate text-sm font-bold">
                {activeModule?.label ?? "Seleccionar módulo"}
              </span>
            </span>
            <span className="ml-4 text-xs font-semibold text-primary group-open:hidden">
              Cambiar
            </span>
            <span className="ml-4 hidden text-xs font-semibold text-primary group-open:inline">
              Cerrar
            </span>
          </summary>

          <div className="absolute left-0 top-full z-50 mt-2 grid w-[min(46rem,calc(100vw-2rem))] grid-cols-2 gap-2 rounded-2xl border border-outline-variant bg-surface-container-low p-3 shadow-xl lg:grid-cols-4">
            {modules.map((module) => {
              const isActive = currentModule === module.module;

              return (
                <Link
                  key={module.module}
                  href={module.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(event) =>
                    event.currentTarget.closest("details")?.removeAttribute("open")
                  }
                  className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                    isActive
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <AppIcon
                    icon={module.icon}
                    variant={module.iconVariant}
                    size="sm"
                  />
                  <span>{module.label}</span>
                </Link>
              );
            })}
          </div>
        </details>
      </div>
    </nav>
  );
}
