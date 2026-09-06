"use client";
import { CheckIcon } from "@/components/ui/icons";

type Step = "ventas" | "salidas" | "entradas" | "evidencias" | "cierre";

interface StepperProps {
  current: Step;
  statuses: Record<Step, "complete" | "empty" | "optional">;
  onSelect: (step: Step) => void;
}

const STEPS: { key: Step; label: string; abbr: string }[] = [
  { key: "ventas", label: "Ventas", abbr: "V" },
  { key: "salidas", label: "Salidas", abbr: "S" },
  { key: "entradas", label: "Entradas", abbr: "E" },
  { key: "evidencias", label: "Evidencias", abbr: "Ev" },
  { key: "cierre", label: "Cierre", abbr: "C" },
];

export function CompactStepper({ current, statuses, onSelect }: StepperProps) {
  return (
    <div className="flex items-center justify-between gap-1 mb-4 overflow-x-auto pb-2 px-1">
      {STEPS.map((step) => {
        const status = statuses[step.key];
        const isCurrent = step.key === current;

        return (
          <button
            key={step.key}
            onClick={() => onSelect(step.key)}
            title={step.label}
            className={`flex flex-col items-center gap-0.5 shrink-0 transition hover:scale-110 active:scale-95 ${
              isCurrent
                ? "opacity-100"
                : "opacity-60"
            }`}
          >
            <div
              className={`h-8 w-8 flex items-center justify-center rounded-full text-xs font-bold transition ${
                isCurrent
                  ? "bg-primary text-on-primary"
                  : status === "complete"
                    ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim ring-1 ring-tertiary-fixed-dim/30"
                    : status === "empty"
                      ? "bg-secondary/10 text-secondary ring-1 ring-secondary/20"
                      : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {status === "complete" && !isCurrent ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                step.abbr
              )}
            </div>
            <span className="text-xs font-medium text-on-surface-variant hidden sm:block">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
