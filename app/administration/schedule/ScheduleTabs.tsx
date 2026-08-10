"use client";

import { useState } from "react";
import { CalendarIcon, GridIcon, ToolboxIcon } from "@/components/ui/icons";
import ScheduleGrid from "./ScheduleGrid";
import TemplatesEditor from "./TemplatesEditor";

type Tab = "horario" | "plantillas";

const TABS: { key: Tab; label: string; icon: typeof CalendarIcon }[] = [
  { key: "horario", label: "Horario", icon: GridIcon },
  { key: "plantillas", label: "Plantillas", icon: ToolboxIcon },
];

export default function ScheduleTabs() {
  const [tab, setTab] = useState<Tab>("horario");

  return (
    <div className="space-y-6">
      <div className="inline-flex gap-1 rounded-2xl border border-outline-variant bg-surface-container p-1.5">
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
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "horario" && <ScheduleGrid />}
      {tab === "plantillas" && <TemplatesEditor />}
    </div>
  );
}
