"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from "@/components/ui/icons";
import type { ApprovedPayrollHistoryItem } from "@/app/actions/employeePayrollHistory";

export type EmployeePayrollSummary = {
  hourlyRate: number | null;
  hasOpenShift: boolean;
  todayHours: number;
  weekHours: number;
  todayPay: number | null;
  weekPay: number | null;
};

function formatHours(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function formatWeek(weekStart: string, weekEnd: string) {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${weekStart}T12:00:00.000Z`))} – ${formatter.format(
    new Date(`${weekEnd}T12:00:00.000Z`),
  )}`;
}

function formatApprovalDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

export default function EmployeePayrollView({
  userName,
  summary,
  history,
}: {
  userName: string;
  summary: EmployeePayrollSummary | { error: string };
  history: ApprovedPayrollHistoryItem[] | { error: string };
}) {
  const approvedHistory = "error" in history ? [] : history;
  const [activeTab, setActiveTab] = useState<"RESUMEN" | "PAGOS">("RESUMEN");
  const [paymentIndex, setPaymentIndex] = useState(0);
  const selectedPayment = approvedHistory[paymentIndex] ?? null;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/timeclock"
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Volver al checador
        </Link>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Trabajador</p>
          <h1 className="mt-1 text-3xl font-bold">Mi nómina</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{userName} · horas y pago de la semana</p>
        </div>

        <div className="inline-flex w-full rounded-2xl border border-outline-variant bg-surface-container p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("RESUMEN")}
            aria-pressed={activeTab === "RESUMEN"}
            className={`min-w-32 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === "RESUMEN"
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            Resumen
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PAGOS")}
            aria-pressed={activeTab === "PAGOS"}
            className={`min-w-32 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === "PAGOS"
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            Pagos
          </button>
        </div>

        {activeTab === "RESUMEN" && (
          <>
            {"error" in summary ? (
              <p className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">{summary.error}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Card highlight>
                    <CardLabel>Hoy</CardLabel>
                    <CardValue>{formatHours(summary.todayHours)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {summary.todayPay === null ? "Sin tarifa" : formatCurrency(summary.todayPay)}
                    </p>
                  </Card>
                  <Card>
                    <CardLabel>Esta semana</CardLabel>
                    <CardValue>{formatHours(summary.weekHours)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {summary.weekPay === null ? "Sin tarifa" : formatCurrency(summary.weekPay)}
                    </p>
                  </Card>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/timeclock/calendar"
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold hover:border-primary/40"
                  >
                    <CalendarIcon className="h-4 w-4" /> Mi horario
                  </Link>
                  <Link
                    href="/timeclock/hours"
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold hover:border-primary/40"
                  >
                    <ClockIcon className="h-4 w-4" /> Horas trabajadas
                  </Link>
                </div>

                <p className="text-xs text-on-surface-variant">
                  {summary.hasOpenShift
                    ? "Tienes un turno abierto; el tiempo actual ya está incluido en el estimado."
                    : "La semana se calcula con tus entradas y salidas registradas."}
                  {summary.hourlyRate === null && " Falta configurar tu tarifa para calcular el pago."}
                </p>
              </>
            )}
          </>
        )}

        {activeTab === "PAGOS" && (
          <Card>
            <CardLabel>Pagos aprobados</CardLabel>
            <p className="mt-1 text-sm text-on-surface-variant">
              Consulta una semana a la vez. Las horas y el pago no cambian después de su aprobación.
            </p>

            {"error" in history ? (
              <p className="mt-4 rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">{history.error}</p>
            ) : !selectedPayment ? (
              <p className="mt-4 rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">
                Aún no tienes semanas de nómina aprobadas.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentIndex((index) => Math.max(0, index - 1))}
                    disabled={paymentIndex === 0}
                    aria-label="Ver semana más reciente"
                    className="rounded-xl border border-outline-variant p-2 text-on-surface transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <p className="text-center text-sm font-bold text-on-surface">
                    Pago {paymentIndex + 1} de {approvedHistory.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPaymentIndex((index) => Math.min(approvedHistory.length - 1, index + 1))}
                    disabled={paymentIndex === approvedHistory.length - 1}
                    aria-label="Ver semana anterior"
                    className="rounded-xl border border-outline-variant p-2 text-on-surface transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 rounded-xl border border-outline-variant p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-on-surface">
                        {formatWeek(selectedPayment.weekStart, selectedPayment.weekEnd)}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {selectedPayment.regularHours.toFixed(2)} h regulares
                        {selectedPayment.overtimeHours > 0 && ` · ${selectedPayment.overtimeHours.toFixed(2)} h extra`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        selectedPayment.status === "PAGADA"
                          ? "bg-primary/15 text-primary"
                          : "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                      }`}
                    >
                      {selectedPayment.status === "PAGADA" ? "Pagada" : "Aprobada"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-on-surface-variant">Horas aprobadas</p>
                      <p className="font-semibold text-on-surface">{formatHours(selectedPayment.totalHours)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-on-surface-variant">Pago aprobado</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(selectedPayment.totalPay)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {selectedPayment.paidAt
                      ? `Pagada el ${formatApprovalDate(selectedPayment.paidAt)}`
                      : selectedPayment.approvedAt
                        ? `Aprobada el ${formatApprovalDate(selectedPayment.approvedAt)}`
                        : "Aprobada"}
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
