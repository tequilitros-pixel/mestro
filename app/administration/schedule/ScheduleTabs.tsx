"use client";

import { useState } from "react";
import { CalendarIcon, ToolboxIcon } from "@/components/ui/icons";
import ScheduleBuilder from "./ScheduleBuilder";
import TemplatesEditor from "./TemplatesEditor";

type Tab = "turnos" | "plantillas";

const TABS: { key: Tab; label: string; icon: typeof CalendarIcon }[] = [
  { key: "turnos", label: "Turnos", icon: CalendarIcon },
  { key: "plantillas", label: "Plantillas", icon: ToolboxIcon },
];

export default function ScheduleTabs() {
  const [tab, setTab] = useState<Tab>("turnos");

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

      {tab === "turnos" ? <ScheduleBuilder /> : <TemplatesEditor />}
    </div>
  );
}
