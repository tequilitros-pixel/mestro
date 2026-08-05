"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MAIN_MODULES,
  getCurrentModule,
  isMainModuleVisible,
} from "./navigation";

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

  return (
    <nav className="overflow-x-auto border-t border-outline-variant">
      <div className="flex min-w-max gap-2 px-4 py-3">
        {modules.map((module) => {
          const isActive = currentModule === module.module;

          const Icon = module.icon;

          return (
            <Link
              key={module.module}
              href={module.href}
              className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-bold transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] ${
                isActive
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              <Icon className="mr-2 h-4 w-4 shrink-0" />

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