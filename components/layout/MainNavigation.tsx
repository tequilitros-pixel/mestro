"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, XIcon } from "@/components/ui/icons";
import AppIcon from "@/components/ui/AppIcon";
import {
  MAIN_MODULES,
  SUBMENUS,
  getCurrentModule,
  getSubmenuItemDestination,
  isMainModuleVisible,
  isSubmenuItemVisible,
} from "./navigation";

export default function MainNavigation({ role, moduleKeys }: { role: string; moduleKeys: string[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const currentModule = getCurrentModule(pathname);
  const modules = MAIN_MODULES.filter((module) => isMainModuleVisible(role, moduleKeys, module));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function destinationFor(module: (typeof MAIN_MODULES)[number]) {
    if (module.module === "home") return module.href;
    const firstVisible = SUBMENUS[module.module].find((item) =>
      isSubmenuItemVisible(role, moduleKeys, item),
    );
    return firstVisible
      ? getSubmenuItemDestination(role, moduleKeys, firstVisible)
      : module.href;
  }

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Cerrar menú de módulos" : "Abrir menú de módulos"}
        aria-expanded={open}
        aria-controls="main-module-drawer"
        title={open ? "Cerrar menú" : "Cambiar módulo"}
        onClick={() => setOpen((value) => !value)}
        className="shell-icon-button fixed left-3 top-2.5 z-[70] cursor-pointer touch-manipulation"
      >
        {open ? <XIcon className="h-[18px] w-[18px]" /> : <GridIcon className="h-[18px] w-[18px]" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[65]" role="presentation">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside
            id="main-module-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Cambiar módulo"
            className="module-drawer relative z-10 flex h-full w-[min(19rem,calc(100vw-2.5rem))] flex-col border-r border-outline-variant bg-surface-container-low p-3 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                Módulos
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="shell-icon-button"
              >
                <XIcon className="h-[18px] w-[18px]" />
              </button>
            </div>
            <nav className="space-y-1" aria-label="Módulos disponibles">
              {modules.map((module) => {
                const active = currentModule === module.module;
                return (
                  <Link
                    key={module.module}
                    href={destinationFor(module)}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                      active
                        ? "bg-surface-container-highest text-on-surface"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    }`}
                  >
                    <AppIcon
                      icon={module.icon}
                      variant={module.iconVariant}
                      size="sm"
                      className={active ? "bg-on-surface text-inverse-on-surface ring-transparent" : ""}
                    />
                    <span>{module.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
