"use client";

import { useState, type ReactNode } from "react";
import { AppIconBadge } from "@/components/ui/AppIcon";

/**
 * `icon` es un elemento JSX ya renderizado (`<HomeIcon className="h-4 w-4" />`),
 * no un componente. Las páginas que usan estas pestañas son Server
 * Components, y una función/componente no se puede serializar al pasarla
 * a un Client Component — un elemento JSX sí.
 */
export type PageTab = {
  key: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
};

export default function PageTabs({
  tabs,
  defaultTab,
}: {
  tabs: PageTab[];
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            role="tab"
            aria-selected={active === t.key}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1 text-[13px] font-semibold transition-colors duration-150 sm:px-3 ${tabs.length <= 4 ? "flex-1 justify-center" : ""} ${
              active === t.key
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            {t.icon && <AppIconBadge>{t.icon}</AppIconBadge>}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab?.content}
    </div>
  );
}
