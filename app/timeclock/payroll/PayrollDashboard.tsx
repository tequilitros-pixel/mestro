"use client";

import { useEffect, useState } from "react";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import PageTabs from "@/components/ui/PageTabs";
import {
  HomeIcon,
  StoreIcon,
  UsersIcon,
  CalendarIcon,
  ChartLineIcon,
  ClipboardIcon,
  AlertIcon,
  ClockIcon,
} from "@/components/ui/icons";
import { getPayrollAnalytics, type PayrollAnalytics } from "@/app/actions/payrollAnalytics";
import { addDaysToDateOnly, todayDateOnly } from "@/lib/dateOnly";
import {
  CostVsSalesChart,
  HoursTrendChart,
  RankingChart,
  CostShareChart,
  PlannedVsActualChart,
} from "./PayrollCharts";
import PayrollReport from "./PayrollReport";
import OvertimeManager from "./OvertimeManager";
import PayrollWeekView from "./PayrollWeekView";

const RANGE_OPTIONS = [
  { key: "7", label: "7 días" },
  { key: "14", label: "14 días" },
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
];

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const hours = (value: number) => `${value.toFixed(1)} h`;

/**
 * Umbral de referencia para el costo de nómina sobre ventas. En
 * restaurantes/bares un 25-30% se considera saludable; arriba de 35%
 * la operación empieza a comerse el margen.
 */
const LABOR_SHARE_WARNING = 30;
const LABOR_SHARE_DANGER = 35;

function shareTone(share: number | null) {
  if (share === null) return "text-on-surface";
  if (share >= LABOR_SHARE_DANGER) return "text-error";
  if (share >= LABOR_SHARE_WARNING) return "text-secondary";
  return "text-tertiary-fixed-dim";
}

export default function PayrollDashboard() {
  const [rangeDays, setRangeDays] = useState("30");
  const [data, setData] = useState<PayrollAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const to = todayDateOnly();
  const from = addDaysToDateOnly(to, -(Number(rangeDays) - 1));

  useEffect(() => {
    let cancelled = false;

    getPayrollAnalytics(from, to).then((result) => {
      if (cancelled) return;

      if ("error" in result) {
        setError(result.error);
        setData(null);
      } else {
        setError(null);
        setData(result.data);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [from, to, refreshKey]);

  function handleRangeChange(value: string) {
    setRangeDays(value);
    setLoading(true);
  }

  const rangeSelector = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex gap-1 rounded-2xl border border-outline-variant bg-surface-container p-1.5">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => handleRangeChange(option.key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              rangeDays === option.key
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && <span className="text-xs text-on-surface-variant">Cargando...</span>}
    </div>
  );

  if (error) {
    return (
      <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {rangeSelector}
        <p className="text-center text-on-surface-variant">Cargando información...</p>
      </div>
    );
  }

  const { totals, branches, people, daily } = data;

  const topBranch = branches[0];
  const topPerson = people[0];
  const overLimit = people.filter((p) => p.overLegalLimit);
  const worstShare = branches
    .filter((b) => b.laborShare !== null)
    .sort((a, b) => (b.laborShare ?? 0) - (a.laborShare ?? 0))[0];

  const alerts: Array<{ tone: "danger" | "warning"; text: string }> = [];

  if (totals.peopleWithoutRate > 0) {
    alerts.push({
      tone: "danger",
      text: `${totals.peopleWithoutRate} persona(s) sin tarifa por hora capturada — ${hours(totals.hoursWithoutRate)} trabajadas no están costeadas. El costo real es mayor al mostrado.`,
    });
  }

  if (totals.openShifts > 0) {
    alerts.push({
      tone: "warning",
      text: `${totals.openShifts} turno(s) sin cerrar en el periodo. Esas horas no cuentan hasta que se cierren.`,
    });
  }

  if (overLimit.length > 0) {
    alerts.push({
      tone: "warning",
      text: `${overLimit.length} persona(s) promedian más de 48 h por semana (límite de la Ley Federal del Trabajo): ${overLimit.map((p) => p.name).join(", ")}.`,
    });
  }

  if (totals.missedShifts > 0) {
    alerts.push({
      tone: "warning",
      text: `${totals.missedShifts} turno(s) programados sin checada registrada.`,
    });
  }

  if (!data.overtimeAvailable) {
    alerts.push({
      tone: "danger",
      text: "El tiempo extra no está disponible todavía: falta actualizar la base de datos. Corre `npx prisma db push` y reinicia el servidor.",
    });
  }

  if (totals.pendingOvertimeCount > 0) {
    alerts.push({
      tone: "warning",
      text: `${money(totals.pendingOvertimeCost)} de tiempo extra esperando tu autorización (${totals.pendingOvertimeCount} registro(s)). No está contado en el costo hasta que lo apruebes.`,
    });
  }

  if (worstShare && (worstShare.laborShare ?? 0) >= LABOR_SHARE_DANGER) {
    alerts.push({
      tone: "danger",
      text: `${worstShare.name} gasta ${(worstShare.laborShare ?? 0).toFixed(0)}% de sus ventas en nómina.`,
    });
  }

  return (
    <PageTabs
      defaultTab="nomina"
      tabs={[
        {
          key: "resumen",
          label: "Resumen",
          icon: <HomeIcon className="h-4 w-4" />,
          content: (
            <div className="space-y-6">
              {rangeSelector}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Card>
                  <CardLabel>Costo de nómina</CardLabel>
                  <CardValue>{money(totals.cost)}</CardValue>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {totals.overtimeCost > 0
                      ? `${money(totals.baseCost)} base + ${money(totals.overtimeCost)} extra`
                      : `${data.days} días · ${totals.shifts} turnos`}
                  </p>
                </Card>

                <Card>
                  <CardLabel>Nómina sobre ventas</CardLabel>
                  <p className={`text-2xl font-bold ${shareTone(totals.laborShare)}`}>
                    {totals.laborShare !== null
                      ? `${totals.laborShare.toFixed(1)}%`
                      : "Sin ventas"}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Ventas {money(totals.sales)}
                  </p>
                </Card>

                <Card>
                  <CardLabel>Horas trabajadas</CardLabel>
                  <CardValue>{hours(totals.hours)}</CardValue>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {totals.people} personas activas
                  </p>
                </Card>

                <Card>
                  <CardLabel>Costo por hora</CardLabel>
                  <CardValue>{money(totals.averageHourlyCost)}</CardValue>
                  <p className="mt-1 text-xs text-on-surface-variant">Promedio real</p>
                </Card>
              </div>

              {alerts.length > 0 && (
                <Card>
                  <CardLabel>Requiere tu atención</CardLabel>
                  <div className="mt-2 space-y-2">
                    {alerts.map((alert, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                          alert.tone === "danger"
                            ? "border-error/30 bg-error/10 text-error"
                            : "border-secondary/30 bg-secondary/10 text-secondary"
                        }`}
                      >
                        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{alert.text}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardLabel>Sucursal que más gasta</CardLabel>
                  {topBranch ? (
                    <>
                      <CardValue>{topBranch.name}</CardValue>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {money(topBranch.cost)} ·{" "}
                        {topBranch.laborShare !== null
                          ? `${topBranch.laborShare.toFixed(1)}% de sus ventas`
                          : "sin ventas registradas"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-on-surface-variant">Sin datos</p>
                  )}
                </Card>

                <Card>
                  <CardLabel>Quien más horas trabaja</CardLabel>
                  {topPerson ? (
                    <>
                      <CardValue>{topPerson.name}</CardValue>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {hours(topPerson.hours)} · {topPerson.shifts} turnos ·{" "}
                        {hours(topPerson.weeklyHours)}/semana
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-on-surface-variant">Sin datos</p>
                  )}
                </Card>
              </div>

              <Card>
                <CardLabel>Costo de nómina vs ventas por día</CardLabel>
                <CostVsSalesChart data={daily} />
              </Card>
            </div>
          ),
        },

        {
          key: "sucursales",
          label: "Sucursales",
          icon: <StoreIcon className="h-4 w-4" />,
          content: (
            <div className="space-y-6">
              {rangeSelector}

              {branches.length === 0 ? (
                <Card className="text-center">
                  <p className="text-sm text-on-surface-variant">
                    No hay horas registradas en este periodo.
                  </p>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardLabel>Costo de nómina por sucursal</CardLabel>
                      <RankingChart
                        data={branches.map((b) => ({
                          name: b.name,
                          value: Math.round(b.cost),
                        }))}
                        valueLabel="Costo"
                      />
                    </Card>

                    <Card>
                      <CardLabel>Reparto del costo</CardLabel>
                      <CostShareChart
                        data={branches.map((b) => ({
                          name: b.name,
                          value: Math.round(b.cost),
                        }))}
                      />
                    </Card>
                  </div>

                  <Card>
                    <CardLabel>Comparativa por sucursal</CardLabel>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b border-outline-variant text-left text-xs text-outline">
                            <th className="pb-2 font-medium">Sucursal</th>
                            <th className="pb-2 text-right font-medium">Costo</th>
                            <th className="pb-2 text-right font-medium">Ventas</th>
                            <th className="pb-2 text-right font-medium">% nómina</th>
                            <th className="pb-2 text-right font-medium">Horas</th>
                            <th className="pb-2 text-right font-medium">Personas</th>
                            <th className="pb-2 text-right font-medium">Faltas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {branches.map((branch) => (
                            <tr key={branch.id}>
                              <td className="py-3 font-semibold text-on-surface">
                                {branch.name}
                              </td>
                              <td className="py-3 text-right font-bold text-on-surface">
                                {money(branch.cost)}
                              </td>
                              <td className="py-3 text-right text-on-surface-variant">
                                {money(branch.sales)}
                              </td>
                              <td
                                className={`py-3 text-right font-bold ${shareTone(branch.laborShare)}`}
                              >
                                {branch.laborShare !== null
                                  ? `${branch.laborShare.toFixed(1)}%`
                                  : "—"}
                              </td>
                              <td className="py-3 text-right text-on-surface-variant">
                                {hours(branch.hours)}
                              </td>
                              <td className="py-3 text-right text-on-surface-variant">
                                {branch.people}
                              </td>
                              <td className="py-3 text-right text-on-surface-variant">
                                {branch.missedShifts}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="mt-3 text-xs text-outline">
                      % nómina = costo de mano de obra sobre las ventas del Punto de
                      Venta de esa sucursal. Referencia: hasta 30% saludable, arriba de
                      35% requiere acción.
                    </p>
                  </Card>
                </>
              )}
            </div>
          ),
        },

        {
          key: "personas",
          label: "Personas",
          icon: <UsersIcon className="h-4 w-4" />,
          content: (
            <div className="space-y-6">
              {rangeSelector}

              {people.length === 0 ? (
                <Card className="text-center">
                  <p className="text-sm text-on-surface-variant">
                    No hay horas registradas en este periodo.
                  </p>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardLabel>Horas trabajadas por persona</CardLabel>
                      <RankingChart
                        data={people.slice(0, 10).map((p) => ({
                          name: p.name,
                          value: p.hours,
                        }))}
                        valueLabel="Horas"
                        money={false}
                      />
                    </Card>

                    <Card>
                      <CardLabel>Costo por persona</CardLabel>
                      <RankingChart
                        data={people
                          .slice()
                          .sort((a, b) => b.cost - a.cost)
                          .slice(0, 10)
                          .map((p) => ({ name: p.name, value: Math.round(p.cost) }))}
                        valueLabel="Costo"
                      />
                    </Card>
                  </div>

                  <Card>
                    <CardLabel>Detalle por persona</CardLabel>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-outline-variant text-left text-xs text-outline">
                            <th className="pb-2 font-medium">Persona</th>
                            <th className="pb-2 font-medium">Sucursales</th>
                            <th className="pb-2 text-right font-medium">Horas</th>
                            <th className="pb-2 text-right font-medium">h/semana</th>
                            <th className="pb-2 text-right font-medium">Turnos</th>
                            <th className="pb-2 text-right font-medium">Turno prom.</th>
                            <th className="pb-2 text-right font-medium">Extra</th>
                            <th className="pb-2 text-right font-medium">Tarifa</th>
                            <th className="pb-2 text-right font-medium">Costo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {people.map((person) => (
                            <tr key={person.id}>
                              <td className="py-3 font-semibold text-on-surface">
                                {person.name}
                                {person.overLegalLimit && (
                                  <span className="ml-2 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
                                    +48h
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-xs text-on-surface-variant">
                                {person.branches.join(", ")}
                              </td>
                              <td className="py-3 text-right font-bold text-on-surface">
                                {hours(person.hours)}
                              </td>
                              <td
                                className={`py-3 text-right ${
                                  person.overLegalLimit
                                    ? "font-bold text-secondary"
                                    : "text-on-surface-variant"
                                }`}
                              >
                                {hours(person.weeklyHours)}
                              </td>
                              <td className="py-3 text-right text-on-surface-variant">
                                {person.shifts}
                              </td>
                              <td className="py-3 text-right text-on-surface-variant">
                                {hours(person.averageShiftHours)}
                              </td>
                              <td className="py-3 text-right">
                                {person.overtimeHours > 0 ? (
                                  <>
                                    <span className="font-bold text-secondary">
                                      {hours(person.overtimeHours)}
                                    </span>
                                    <span className="block text-[10px] text-outline">
                                      {money(person.overtimeCost)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-outline">—</span>
                                )}
                              </td>
                              <td className="py-3 text-right text-on-surface-variant">
                                {person.hourlyRate !== null ? (
                                  money(person.hourlyRate)
                                ) : (
                                  <span className="text-error">Falta tarifa</span>
                                )}
                              </td>
                              <td className="py-3 text-right font-bold text-on-surface">
                                {person.hourlyRate !== null ? money(person.cost) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}
            </div>
          ),
        },

        {
          key: "planeado",
          label: "Planeado vs real",
          icon: <CalendarIcon className="h-4 w-4" />,
          content: (
            <div className="space-y-6">
              {rangeSelector}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Card>
                  <CardLabel>Horas planeadas</CardLabel>
                  <CardValue>{hours(totals.scheduledHours)}</CardValue>
                  <p className="mt-1 text-xs text-on-surface-variant">Según horarios</p>
                </Card>

                <Card>
                  <CardLabel>Horas reales</CardLabel>
                  <CardValue>{hours(totals.hours)}</CardValue>
                  <p className="mt-1 text-xs text-on-surface-variant">Según checador</p>
                </Card>

                <Card>
                  <CardLabel>Diferencia</CardLabel>
                  <p
                    className={`text-2xl font-bold ${
                      totals.hours > totals.scheduledHours
                        ? "text-error"
                        : "text-tertiary-fixed-dim"
                    }`}
                  >
                    {totals.hours >= totals.scheduledHours ? "+" : ""}
                    {hours(totals.hours - totals.scheduledHours)}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {totals.hours > totals.scheduledHours
                      ? "Se trabajó de más"
                      : "Se trabajó de menos"}
                  </p>
                </Card>

                <Card>
                  <CardLabel>Turnos sin checada</CardLabel>
                  <p
                    className={`text-2xl font-bold ${
                      totals.missedShifts > 0 ? "text-error" : "text-on-surface"
                    }`}
                  >
                    {totals.missedShifts}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Posibles faltas
                  </p>
                </Card>
              </div>

              {branches.length > 0 && (
                <Card>
                  <CardLabel>Horas planeadas vs reales por sucursal</CardLabel>
                  <PlannedVsActualChart
                    data={branches.map((b) => ({
                      name: b.name,
                      planeadas: Math.round(b.scheduledHours * 10) / 10,
                      reales: Math.round(b.hours * 10) / 10,
                    }))}
                  />
                </Card>
              )}

              <p className="text-xs text-outline">
                Las faltas se infieren: un turno programado sin ninguna checada de esa
                persona en esa sucursal ese día. El sistema no tiene un registro
                explícito de ausencias, permisos ni vacaciones.
              </p>
            </div>
          ),
        },

        {
          key: "tendencia",
          label: "Tendencia",
          icon: <ChartLineIcon className="h-4 w-4" />,
          content: (
            <div className="space-y-6">
              {rangeSelector}

              {daily.length === 0 ? (
                <Card className="text-center">
                  <p className="text-sm text-on-surface-variant">
                    No hay actividad en este periodo.
                  </p>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardLabel>Costo de nómina vs ventas por día</CardLabel>
                    <CostVsSalesChart data={daily} />
                  </Card>

                  <Card>
                    <CardLabel>Horas trabajadas por día</CardLabel>
                    <HoursTrendChart data={daily} />
                  </Card>

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Card>
                      <CardLabel>Costo diario promedio</CardLabel>
                      <CardValue>
                        {money(totals.cost / Math.max(daily.length, 1))}
                      </CardValue>
                    </Card>

                    <Card>
                      <CardLabel>Horas diarias promedio</CardLabel>
                      <CardValue>
                        {hours(totals.hours / Math.max(daily.length, 1))}
                      </CardValue>
                    </Card>

                    <Card>
                      <CardLabel>Día más caro</CardLabel>
                      <CardValue>
                        {money(Math.max(...daily.map((d) => d.cost), 0))}
                      </CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {daily.slice().sort((a, b) => b.cost - a.cost)[0]?.label ?? "—"}
                      </p>
                    </Card>

                    <Card>
                      <CardLabel>Turnos totales</CardLabel>
                      <CardValue>{totals.shifts}</CardValue>
                    </Card>
                  </div>
                </>
              )}
            </div>
          ),
        },

        {
          key: "extra",
          label: "Tiempo extra",
          icon: <ClockIcon className="h-4 w-4" />,
          content: (
            <div className="space-y-6">
              {rangeSelector}

              <OvertimeManager
                from={from}
                to={to}
                onChanged={() => setRefreshKey((k) => k + 1)}
              />
            </div>
          ),
        },

        {
          key: "nomina",
          label: "Nómina semanal",
          icon: <ClockIcon className="h-4 w-4" />,
          content: <PayrollWeekView />,
        },

        {
          key: "semanal",
          label: "Detalle semanal",
          icon: <ClipboardIcon className="h-4 w-4" />,
          content: <PayrollReport />,
        },
      ]}
    />
  );
}
