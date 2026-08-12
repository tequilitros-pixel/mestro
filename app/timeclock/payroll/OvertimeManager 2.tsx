"use client";

import { useEffect, useState } from "react";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { AlertIcon, CheckIcon, XIcon, GearIcon } from "@/components/ui/icons";
import {
  getOvertimeForRange,
  syncOvertimeForRange,
  reviewOvertimeAction,
  approveAllPendingOvertimeAction,
  getPayrollSettings,
  updatePayrollSettingsAction,
  type OvertimeRow,
  type PayrollSettingsValues,
} from "@/app/actions/overtime";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const hours = (value: number) => `${value.toFixed(1)} h`;

const formatWeek = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const STATUS_STYLES: Record<OvertimeRow["status"], string> = {
  PENDIENTE: "bg-secondary/15 text-secondary",
  APROBADO: "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim",
  RECHAZADO: "bg-error/15 text-error",
};

export default function OvertimeManager({
  from,
  to,
  onChanged,
}: {
  from: string;
  to: string;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<OvertimeRow[]>([]);
  const [settings, setSettings] = useState<PayrollSettingsValues | null>(null);
  const [draftSettings, setDraftSettings] = useState<PayrollSettingsValues | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Se detecta el tiempo extra del rango antes de listarlo, para que
    // aparezcan las semanas nuevas sin que el admin haga nada.
    syncOvertimeForRange(from, to)
      .then(() => Promise.all([getOvertimeForRange(from, to), getPayrollSettings()]))
      .then(([result, currentSettings]) => {
        if (cancelled) return;

        if ("error" in result) {
          setError(result.error);
          setRows([]);
        } else {
          setError(null);
          setRows(result.rows);
        }

        setSettings(currentSettings);
        setDraftSettings(currentSettings);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
    onChanged?.();
  }

  async function handleReview(row: OvertimeRow, decision: "APROBADO" | "RECHAZADO") {
    if (!row.id) return;

    setBusyId(row.id);
    setMessage(null);
    setError(null);

    const result = await reviewOvertimeAction(row.id, decision);

    setBusyId(null);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setMessage(result.message);
    reload();
  }

  async function handleApproveAll() {
    setBusyId("all");
    setMessage(null);
    setError(null);

    const result = await approveAllPendingOvertimeAction(from, to);

    setBusyId(null);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setMessage(
      result.skipped > 0
        ? `${result.approved} aprobados. ${result.skipped} sin tarifa por hora quedaron pendientes.`
        : `${result.approved} registro(s) de tiempo extra aprobados.`,
    );
    reload();
  }

  async function handleSaveSettings() {
    if (!draftSettings) return;

    setBusyId("settings");
    setMessage(null);
    setError(null);

    const result = await updatePayrollSettingsAction(draftSettings);

    setBusyId(null);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSettings(draftSettings);
    setMessage(result.message);
    reload();
  }

  const pending = rows.filter((r) => r.status === "PENDIENTE");
  const approved = rows.filter((r) => r.status === "APROBADO");

  const pendingAmount = pending.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const approvedAmount = approved.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const pendingHours = pending.reduce((sum, r) => sum + r.overtimeHours, 0);

  if (loading) {
    return <p className="text-center text-on-surface-variant">Detectando tiempo extra...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardLabel>Por autorizar</CardLabel>
          <p className="text-2xl font-bold text-secondary">{money(pendingAmount)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {pending.length} registro(s) · {hours(pendingHours)}
          </p>
        </Card>

        <Card>
          <CardLabel>Aprobado</CardLabel>
          <p className="text-2xl font-bold text-tertiary-fixed-dim">
            {money(approvedAmount)}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {approved.length} registro(s)
          </p>
        </Card>

        <Card>
          <CardLabel>Umbral semanal</CardLabel>
          <CardValue>{settings ? `${settings.weeklyHourThreshold} h` : "—"}</CardValue>
          <p className="mt-1 text-xs text-on-surface-variant">
            A partir de aquí es extra
          </p>
        </Card>

        <Card>
          <CardLabel>Multiplicadores</CardLabel>
          <CardValue>
            {settings
              ? `${settings.firstTierMultiplier}x / ${settings.secondTierMultiplier}x`
              : "—"}
          </CardValue>
          <p className="mt-1 text-xs text-on-surface-variant">
            {settings ? `Primeras ${settings.firstTierHours} h, luego` : ""}
          </p>
        </Card>
      </div>

      {message && (
        <div className="rounded-xl border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 p-3 text-sm text-tertiary-fixed-dim">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {pending.length > 0 && (
          <button
            onClick={handleApproveAll}
            disabled={busyId !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-50"
          >
            <CheckIcon className="h-4 w-4" />
            {busyId === "all" ? "Aprobando..." : `Aprobar los ${pending.length} pendientes`}
          </button>
        )}

        <button
          onClick={() => setShowSettings((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-bold text-on-surface transition hover:bg-surface-container-high"
        >
          <GearIcon className="h-4 w-4" />
          Ajustes de cálculo
        </button>
      </div>

      {showSettings && draftSettings && (
        <Card>
          <CardLabel>Cómo se calcula el tiempo extra</CardLabel>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold text-on-surface-variant">
                Horas semanales normales
              </span>
              <input
                type="number"
                min="1"
                max="168"
                step="0.5"
                value={draftSettings.weeklyHourThreshold}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    weeklyHourThreshold: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-on-surface-variant">
                Horas del primer tramo
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={draftSettings.firstTierHours}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    firstTierHours: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-on-surface-variant">
                Multiplicador primer tramo
              </span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={draftSettings.firstTierMultiplier}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    firstTierMultiplier: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-on-surface-variant">
                Multiplicador segundo tramo
              </span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={draftSettings.secondTierMultiplier}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    secondTierMultiplier: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-outline">
            Por defecto sigue la Ley Federal del Trabajo: 48 h semanales, las primeras 9
            horas extra al doble y las siguientes al triple. Cambiar esto recalcula los
            registros pendientes, no los ya aprobados.
          </p>

          <button
            onClick={handleSaveSettings}
            disabled={busyId !== null}
            className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-50"
          >
            {busyId === "settings" ? "Guardando..." : "Guardar ajustes"}
          </button>
        </Card>
      )}

      <Card>
        <CardLabel>Tiempo extra detectado</CardLabel>

        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-on-surface-variant">
            Nadie pasó del umbral semanal en este periodo.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-left text-xs text-outline">
                  <th className="pb-2 font-medium">Persona</th>
                  <th className="pb-2 font-medium">Sucursal</th>
                  <th className="pb-2 font-medium">Semana</th>
                  <th className="pb-2 text-right font-medium">Trabajadas</th>
                  <th className="pb-2 text-right font-medium">Extra</th>
                  <th className="pb-2 text-right font-medium">Importe</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {rows.map((row) => (
                  <tr key={row.id ?? `${row.userId}-${row.weekStart}`}>
                    <td className="py-3 font-semibold text-on-surface">{row.userName}</td>
                    <td className="py-3 text-on-surface-variant">{row.branchName}</td>
                    <td className="py-3 text-xs text-on-surface-variant">
                      {formatWeek(row.weekStart)}
                    </td>
                    <td className="py-3 text-right text-on-surface-variant">
                      {hours(row.workedHours)}
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-bold text-on-surface">
                        {hours(row.overtimeHours)}
                      </span>
                      {row.tripleHours > 0 && (
                        <span className="block text-[10px] text-outline">
                          {hours(row.doubleHours)} + {hours(row.tripleHours)} al triple
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right font-bold text-on-surface">
                      {row.amount !== null ? (
                        money(row.amount)
                      ) : (
                        <span className="text-xs text-error">Falta tarifa</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[row.status]}`}
                      >
                        {row.status}
                      </span>
                      {row.reviewedByName && (
                        <span className="block text-[10px] text-outline">
                          {row.reviewedByName}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {row.status === "PENDIENTE" ? (
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => handleReview(row, "APROBADO")}
                            disabled={busyId !== null}
                            className="rounded-lg border border-tertiary-fixed-dim/40 px-2.5 py-1 text-xs font-bold text-tertiary-fixed-dim transition hover:bg-tertiary-fixed-dim/10 disabled:opacity-40"
                          >
                            <CheckIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleReview(row, "RECHAZADO")}
                            disabled={busyId !== null}
                            className="rounded-lg border border-error/40 px-2.5 py-1 text-xs font-bold text-error transition hover:bg-error/10 disabled:opacity-40"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            handleReview(
                              row,
                              row.status === "APROBADO" ? "RECHAZADO" : "APROBADO",
                            )
                          }
                          disabled={busyId !== null}
                          className="text-xs font-semibold text-on-surface-variant transition hover:text-on-surface disabled:opacity-40"
                        >
                          {row.status === "APROBADO" ? "Rechazar" : "Aprobar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-outline-variant bg-surface-container/60 p-4 text-xs text-on-surface-variant">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" />
        <span>
          El tiempo extra se detecta automáticamente desde el checador, pero solo el
          <strong className="text-on-surface"> aprobado</strong> cuenta como costo en el
          resto del tablero. Al aprobar se congela la tarifa y el importe, para que un
          cambio de sueldo posterior no altere una nómina ya autorizada.
        </span>
      </div>
    </div>
  );
}
