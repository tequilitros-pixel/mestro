"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SUBMENUS,
  getCurrentModule,
  matchesRoute,
  isSubmenuItemVisible,
  type SubMenuItem,
} from "./navigation";
import { ChevronRightIcon } from "@/components/ui/icons";

export default function ModuleNavigation({
  role,
  moduleKeys,
}: {
  role: string;
  moduleKeys: string[];
}) {
  const pathname = usePathname();
  const currentModule = getCurrentModule(pathname);

  if (currentModule === "home") {
    return null;
  }

  const items = SUBMENUS[currentModule]
    .filter((item) => isSubmenuItemVisible(role, moduleKeys, item))
    .map((item) =>
      item.children
        ? {
            ...item,
            children: item.children.filter((child) =>
              isSubmenuItemVisible(role, moduleKeys, child)
            ),
          }
        : item
    );

  if (items.length === 0) {
    return null;
  }

  const groups = groupConsecutiveItems(items);
  const showGroupLabels = groups.length > 1;

  const activeParent = items.find(
    (item) => item.children && isMenuItemActive(pathname, item, items)
  );

  return (
    <nav
      aria-label="Navegación del módulo"
      className="border-t border-outline-variant"
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-1 px-4 py-2.5">
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? `group-${groupIndex}`} className="flex items-center">
              {groupIndex > 0 && (
                <div
                  aria-hidden
                  className="mx-2 h-5 w-px shrink-0 bg-outline-variant"
                />
              )}

              {showGroupLabels && group.label && (
                <span className="mr-2 shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-outline">
                  {group.label}
                </span>
              )}

              <div className="flex items-center gap-1">
                {group.items.map((item) => {
                  const isActive = isMenuItemActive(pathname, item, items);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] ${
                        isActive
                          ? "bg-primary/10 text-on-surface ring-1 ring-primary/15"
                          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                      {item.children && (
                        <ChevronRightIcon
                          className={`h-3 w-3 shrink-0 opacity-60 transition-transform duration-150 ${
                            isActive ? "rotate-90" : ""
                          }`}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeParent?.children && activeParent.children.length > 0 && (
        <div className="overflow-x-auto border-t border-outline-variant/60 bg-surface-container/40">
          <div className="flex min-w-max items-center gap-1 px-4 py-2">
            {activeParent.children.map((child) => {
              const isActive = isMenuItemActive(
                pathname,
                child,
                activeParent.children!
              );
              const Icon = child.icon;

              return (
                <Link
                  key={child.href}
                  href={child.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] ${
                    isActive
                      ? "bg-primary/10 text-on-surface ring-1 ring-primary/15"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}

/**
 * Agrupa items consecutivos que comparten el mismo `group` en
 * "secciones" visuales. Los items sin `group` (la mayoría de los
 * módulos) quedan en una sola sección sin encabezado, igual que
 * antes.
 */
function groupConsecutiveItems(items: SubMenuItem[]) {
  const groups: { label: string | undefined; items: SubMenuItem[] }[] = [];

  for (const item of items) {
    const last = groups[groups.length - 1];

    if (last && last.label === item.group) {
      last.items.push(item);
    } else {
      groups.push({ label: item.group, items: [item] });
    }
  }

  return groups;
}

function isMenuItemActive(
  pathname: string,
  item: SubMenuItem,
  items: SubMenuItem[]
) {
  /*
   * Un item "padre" con hijos de tercer nivel queda activo si la
   * ruta coincide con él o con cualquiera de sus hijos — así el tab
   * "Control" se resalta también al ver Salidas, Auditoría, etc.
   */
  if (item.children) {
    return (
      matchesRoute(pathname, item.href) ||
      item.children.some((child) => matchesRoute(pathname, child.href))
    );
  }

  /*
   * Un item cuyo href es prefijo del href de otro item del mismo
   * submenú (ej. "Resumen" en /sucursales, seguido de "Stock actual"
   * en /sucursales/stock) solo queda activo con coincidencia exacta.
   * Si no, ambos aparecerían activos a la vez al visitar la ruta hija.
   *
   * Esto también cubre el caso histórico de "Inicio" (ej. /liquors),
   * que siempre es prefijo de sus propias subrutas.
   */
  const isPrefixOfAnotherItem = items.some(
    (other) => other.href !== item.href && other.href.startsWith(`${item.href}/`)
  );

  if (isPrefixOfAnotherItem) {
    return pathname === item.href;
  }

  return matchesRoute(pathname, item.href);
}
