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
    <div className="space-y-6">
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-outline-variant bg-surface-container p-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
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
