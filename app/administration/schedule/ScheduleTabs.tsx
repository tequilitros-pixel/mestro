"use client";

import { useState } from "react";
import { CalendarIcon, GridIcon, ToolboxIcon, BookIcon } from "@/components/ui/icons";
import { AppIconBadge } from "@/components/ui/AppIcon";
import ScheduleGrid from "./ScheduleGrid";
import TemplatesEditor from "./TemplatesEditor";
import TemplatesManager from "./TemplatesManager";

type Tab = "horario" | "plantillas" | "estandar";

const TABS: { key: Tab; label: string; icon: typeof CalendarIcon }[] = [
  { key: "horario", label: "Horario", icon: GridIcon },
  { key: "plantillas", label: "Plantillas", icon: BookIcon },
  { key: "estandar", label: "Horario estándar", icon: ToolboxIcon },
];

export default function ScheduleTabs() {
  const [tab, setTab] = useState<Tab>("horario");

  return (
    <div className="space-y-6">
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-outline-variant bg-surface-container p-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;

          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                tab === t.key
                  ? "bg-primary text-on-primary shadow"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <AppIconBadge>
                <Icon className="h-full w-full" />
              </AppIconBadge>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "horario" && <ScheduleGrid />}
      {tab === "plantillas" && <TemplatesManager />}
      {tab === "estandar" && <TemplatesEditor />}
    </div>
  );
}
