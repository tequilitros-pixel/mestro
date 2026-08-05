"use client";

import { Fragment, useState, type ComponentType, type ReactNode } from "react";
import {
  type IconProps,
  InfoIcon,
  ClipboardIcon,
  RefreshIcon,
  ListChecksIcon,
} from "@/components/ui/icons";

type TabKey = "datos" | "salida" | "regreso" | "reconteo";

export default function EventDetailTabs({
  datos,
  salida,
  regreso,
  reconteo,
  pendingReturns,
  pendingRecounts,
}: {
  datos: ReactNode;
  salida: ReactNode;
  regreso: ReactNode;
  reconteo: ReactNode;
  pendingReturns: number;
  pendingRecounts: number;
}) {
  const [tab, setTab] = useState<TabKey>("datos");

  const tabs: {
    key: TabKey;
    label: string;
    icon: ComponentType<IconProps>;
    badge?: number;
  }[] = [
    { key: "datos", label: "Datos del evento", icon: InfoIcon },
    { key: "salida", label: "Lista para llevar", icon: ClipboardIcon },
    { key: "regreso", label: "Lista de regreso", icon: RefreshIcon, badge: pendingReturns },
    { key: "reconteo", label: "Reconteo", icon: ListChecksIcon, badge: pendingRecounts },
  ];

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container p-1.5">
        <div className="flex min-w-max items-center gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;

            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-150 ease-out ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t.label}
                {!!t.badge && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${
                      isActive ? "bg-on-primary/20" : "bg-error/20 text-error"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        {tab === "datos" && <Fragment key="datos">{datos}</Fragment>}
        {tab === "salida" && <Fragment key="salida">{salida}</Fragment>}
        {tab === "regreso" && <Fragment key="regreso">{regreso}</Fragment>}
        {tab === "reconteo" && <Fragment key="reconteo">{reconteo}</Fragment>}
      </div>
    </div>
  );
}
