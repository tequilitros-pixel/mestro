"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, GridIcon, XIcon } from "@/components/ui/icons";
import AppIcon from "@/components/ui/AppIcon";
import {
  SUBMENUS,
  getCurrentModule,
  getSubmenuItemDestination,
  isSubmenuItemVisible,
  matchesRoute,
  type SubMenuItem,
} from "./navigation";

const STORAGE_KEY = "maestro:module-nav-collapsed";

export default function ModuleNavigation({ role, moduleKeys }: { role: string; moduleKeys: string[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentModule = getCurrentModule(pathname);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  if (currentModule === "home") return null;
  const items = SUBMENUS[currentModule]
    .filter((item) => isSubmenuItemVisible(role, moduleKeys, item))
    .map((item) =>
      item.children
        ? {
            ...item,
            children: item.children.filter((child) =>
              isSubmenuItemVisible(role, moduleKeys, child),
            ),
          }
        : item,
    );
  if (!items.length) return null;

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      localStorage.setItem(STORAGE_KEY, String(!value));
      return !value;
    });
  };

  return (
    <>
      <div className="border-b border-outline-variant bg-surface-container-low px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        >
          <GridIcon className="h-4 w-4" /> Secciones
        </button>
      </div>
      <aside
        className={`module-sidebar hidden shrink-0 border-r border-outline-variant bg-surface-container-low md:flex md:flex-col ${
          collapsed ? "w-16" : "w-52"
        }`}
      >
        <div className="flex h-11 items-center justify-end border-b border-outline-variant px-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="shell-icon-button"
            aria-label={collapsed ? "Expandir navegación" : "Contraer navegación"}
          >
            <ChevronRightIcon
              className={`h-4 w-4 transition-transform duration-150 ${collapsed ? "" : "rotate-180"}`}
            />
          </button>
        </div>
        <ModuleLinks
          items={items}
          pathname={pathname}
          role={role}
          moduleKeys={moduleKeys}
          collapsed={collapsed}
        />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[65] md:hidden" role="presentation">
          <button
            type="button"
            aria-label="Cerrar secciones"
            className="absolute inset-0 bg-black/55"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Secciones del módulo"
            className="module-drawer absolute inset-y-0 left-0 w-[min(18rem,calc(100vw-2.5rem))] border-r border-outline-variant bg-surface-container-low p-3 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                Secciones
              </p>
              <button
                type="button"
                className="shell-icon-button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar secciones"
              >
                <XIcon className="h-[18px] w-[18px]" />
              </button>
            </div>
            <ModuleLinks
              items={items}
              pathname={pathname}
              role={role}
              moduleKeys={moduleKeys}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}

function ModuleLinks({
  items,
  pathname,
  role,
  moduleKeys,
  collapsed = false,
  onNavigate,
}: {
  items: SubMenuItem[];
  pathname: string;
  role: string;
  moduleKeys: string[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navegación del módulo" className="flex-1 overflow-y-auto p-2">
      {items.map((item) => (
        <ModuleItem
          key={item.href}
          item={item}
          pathname={pathname}
          role={role}
          moduleKeys={moduleKeys}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function ModuleItem({
  item,
  pathname,
  role,
  moduleKeys,
  collapsed,
  onNavigate,
}: {
  item: SubMenuItem;
  pathname: string;
  role: string;
  moduleKeys: string[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item);
  const hasChildren = !collapsed && Boolean(item.children?.length);
  const [expanded, setExpanded] = useState(active);
  const Icon = item.icon;

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);

  const destination = getSubmenuItemDestination(role, moduleKeys, item);

  return (
    <div className="mb-1">
      <div
        className={`flex min-h-10 items-center rounded-lg transition-colors duration-150 ${
          active
            ? "bg-surface-container-highest text-on-surface"
            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        }`}
      >
        <Link
          href={destination}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          aria-current={active ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-sm font-medium"
        >
          <AppIcon
            icon={Icon}
            variant={item.iconVariant ?? "slate"}
            size="sm"
            className={active ? "bg-on-surface text-inverse-on-surface ring-transparent" : ""}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={`${expanded ? "Contraer" : "Expandir"} ${item.label}`}
            aria-expanded={expanded}
            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high"
          >
            <ChevronRightIcon
              className={`h-4 w-4 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="ml-4 mt-1 space-y-1 border-l border-outline-variant pl-2">
          {item.children?.map((child) => {
            const ChildIcon = child.icon;
            const childActive = matchesRoute(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={getSubmenuItemDestination(role, moduleKeys, child)}
                onClick={onNavigate}
                aria-current={childActive ? "page" : undefined}
                className={`flex min-h-9 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors duration-150 ${
                  childActive
                    ? "bg-surface-container-high text-on-surface"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isActive(pathname: string, item: SubMenuItem) {
  return (
    matchesRoute(pathname, item.href) ||
    Boolean(item.children?.some((child) => matchesRoute(pathname, child.href)))
  );
}
