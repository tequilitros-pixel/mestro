"use client";

import Link from "next/link";
import { useState } from "react";

export type ProcessSwitcherItem = {
  id: string;
  label: string;
  detail?: string;
  status: string;
  active?: boolean;
};

export default function ProcessSwitcher({
  title,
  basePath,
  currentId,
  items,
  filterActive = false,
}: {
  title: string;
  basePath: string;
  currentId: string;
  items: ProcessSwitcherItem[];
  filterActive?: boolean;
}) {
  const [onlyActive, setOnlyActive] = useState(true);
  const visibleItems = filterActive && onlyActive
    ? items.filter((item) => item.active)
    : items;

  if (!filterActive && items.length < 2) return null;
  return (
    <nav aria-label={title} className="mb-6 rounded-2xl border border-outline-variant bg-surface-container p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">{title}</p>
        {filterActive && (
          <div role="group" aria-label="Filtrar alambiques" className="flex gap-2">
            {[{ label: "Solo activos", value: true }, { label: "Todos", value: false }].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={onlyActive === option.value}
                onClick={() => setOnlyActive(option.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${onlyActive === option.value ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant hover:border-primary"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {visibleItems.length === 0 && (
        <p role="status" className="text-sm text-on-surface-variant">
          No hay alambiques activos en esta etapa del lote. Selecciona Todos para consultar las cargas anteriores.
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visibleItems.map((item) => {
          const current = item.id === currentId;
          return (
            <Link
              key={item.id}
              href={`${basePath}/${item.id}`}
              aria-current={current ? "page" : undefined}
              className={`min-w-40 rounded-xl border px-4 py-3 text-sm transition ${current ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-high hover:border-primary"}`}
            >
              <span className="block font-bold">{item.label}</span>
              <span className={`mt-1 block text-xs ${current ? "text-on-primary/80" : "text-on-surface-variant"}`}>
                {[item.detail, item.status].filter(Boolean).join(" · ")}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
