"use client";
import { useEffect, useState } from "react";
import { ArrowUpRightIcon, ArrowDownRightIcon, CheckIcon } from "@/components/ui/icons";

interface Movement {
  id: string;
  type: "INGRESO" | "RECEPCION" | "RETIRO" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
  amount: number;
  previousBalance: number;
  newBalance: number;
  notes: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

const formatDateTime = (v: string) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(v));

const TYPE_LABEL: Record<Movement["type"], string> = {
  INGRESO: "Ingreso desde el corte",
  RECEPCION: "Recibido en caja fuerte",
  RETIRO: "Retiro",
  AJUSTE_POSITIVO: "Ajuste (+)",
  AJUSTE_NEGATIVO: "Ajuste (-)",
};

const changesBalance = (type: Movement["type"]) => type !== "RECEPCION";

const amountLabel = (movement: Movement) => {
  if (movement.type === "RECEPCION") return `Confirmado: ${formatMoney(movement.amount)}`;
  if (movement.type === "RETIRO" || movement.type === "AJUSTE_NEGATIVO") {
    return `-${formatMoney(movement.amount)}`;
  }
  return `+${formatMoney(movement.amount)}`;
};

export function EnvelopeMovementHistory({ envelopeId }: { envelopeId: string }) {
  const [movements, setMovements] = useState<Movement[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cash-cuts/safe/envelopes/${envelopeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMovements(data.movements ?? []);
      })
      .catch(() => {
        if (!cancelled) setMovements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [envelopeId]);

  if (movements === null) {
    return <p className="mt-2 text-xs text-on-surface-variant">Cargando movimientos...</p>;
  }

  if (movements.length === 0) {
    return <p className="mt-2 text-xs text-on-surface-variant">Sin movimientos.</p>;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-outline-variant pt-3">
      {movements.map((m) => (
        <div key={m.id} className="flex items-start gap-2 text-xs">
          {m.type === "INGRESO" || m.type === "AJUSTE_POSITIVO" ? (
            <ArrowUpRightIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tertiary-fixed-dim" />
          ) : m.type === "RETIRO" ? (
            <ArrowDownRightIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
          ) : (
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-on-surface">{TYPE_LABEL[m.type]}</span>
              <span className={`font-bold ${m.type === "RETIRO" || m.type === "AJUSTE_NEGATIVO" ? "text-error" : "text-on-surface"}`}>
                {amountLabel(m)}
              </span>
            </div>
            <p className="text-on-surface-variant">
              {formatDateTime(m.createdAt)} · {m.user.name}
              {m.notes ? ` · ${m.notes}` : ""}
            </p>
            <p className="text-on-surface-variant">
              {changesBalance(m.type)
                ? `Saldo: ${formatMoney(m.previousBalance)} → ${formatMoney(m.newBalance)}`
                : `Saldo confirmado: ${formatMoney(m.newBalance)}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
