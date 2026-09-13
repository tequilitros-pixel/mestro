"use client";

import { useState } from "react";
import { CalendarIcon, GridIcon, ToolboxIcon, BookIcon } from "@/components/ui/icons";
import { AppIconBadge } from "@/components/ui/AppIcon";
import ScheduleGrid from "./ScheduleGrid";
import TemplatesEditor from "./TemplatesEditor";
import TemplatesManager from "./TemplatesManager";
import ShiftRequestsManager from "./ShiftRequestsManager";

type Tab = "horario" | "solicitudes" | "plantillas" | "estandar";

const TABS: { key: Tab; label: string; icon: typeof CalendarIcon }[] = [
  { key: "horario", label: "Horario", icon: GridIcon },
  { key: "solicitudes", label: "Solicitudes", icon: CalendarIcon },
  { key: "plantillas", label: "Plantillas", icon: BookIcon },
  { key: "estandar", label: "Horario estándar", icon: ToolboxIcon },
];

export default function ScheduleTabs() {
  const [tab, setTab] = useState<Tab>("horario");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-outline-variant pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Administración
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-on-surface">
            Programar horarios
          </h1>
        </div>

        <div className="flex gap-1 overflow-x-auto" aria-label="Secciones de horarios">
          {TABS.map((t) => {
            const Icon = t.icon;

            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  tab === t.key
                    ? "bg-primary text-on-primary"
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
      </div>

      {tab === "horario" && <ScheduleGrid />}
      {tab === "solicitudes" && <ShiftRequestsManager />}
      {tab === "plantillas" && <TemplatesManager />}
      {tab === "estandar" && <TemplatesEditor />}
    </div>
  );
}
