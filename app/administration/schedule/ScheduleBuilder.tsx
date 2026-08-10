"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  getScheduleForWeek,
  createScheduledShiftAction,
  deleteScheduledShiftAction,
  copyPreviousWeekAction,
} from "@/app/actions/schedule";
import {
  addDaysToDateOnly,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dateOnly";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { getInitials } from "@/lib/personnelRoles";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  PlusIcon,
  XIcon,
} from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

type User = { id: string; name: string };
type Branch = { id: string; name: string };
type Shift = {
  id: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  user: { id: string; name: string };
  branch: { id: string; name: string };
};
type Template = {
  branchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getMostRecentMonday() {
  return mondayOfWeek(todayDateOnly());
}

function addDays(dateStr: string, days: number) {
  return addDaysToDateOnly(dateStr, days);
}

function formatDayHeader(dateStr: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseDateOnly(dateStr));
}

function formatWeekRange(weekStart: string) {
  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(addDaysToDateOnly(weekStart, 6));
  const fmt = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export default function ScheduleBuilder() {
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(getMostRecentMonday());
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [formDay, setFormDay] = useState(0);
  const [formUser, setFormUser] = useState("");
  const [formBranch, setFormBranch] = useState("");
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("17:00");
  const [timeTouched, setTimeTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    const result = await getScheduleForWeek(weekStart);

    if ("error" in result) {
      setError(result.error ?? "Error");
      setLoading(false);
      return;
    }

    setUsers(result.users);
    setBranches(result.branches);
    setShifts(result.shifts as unknown as Shift[]);
    setTemplates((result.templates ?? []) as unknown as Template[]);
    if (result.users[0]) setFormUser((prev) => prev || result.users[0].id);
    if (result.branches[0]) setFormBranch((prev) => prev || result.branches[0].id);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // Autocompleta las horas del formulario según la plantilla de la
  // sucursal para el día elegido, mientras el usuario no las haya
  // editado a mano.
  useEffect(() => {
    if (timeTouched) return;
    if (!formBranch) return;

    const template = templates.find(
      (t) => t.branchId === formBranch && t.dayOfWeek === formDay
    );

    if (template) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormStart(template.startTime);
      setFormEnd(template.endTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formBranch, formDay, templates]);

  const activeTemplate = templates.find(
    (t) => t.branchId === formBranch && t.dayOfWeek === formDay
  );

  async function handleAddShift() {
    if (!formUser || !formBranch) {
      setError("Selecciona trabajador y sucursal.");
      return;
    }

    setSaving(true);
    setError(null);

    const date = addDays(weekStart, formDay);

    const result = await createScheduledShiftAction({
      userId: formUser,
      branchId: formBranch,
      date,
      startTime: formStart,
      endTime: formEnd,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setTimeTouched(false);
    await load();
    showToast("Turno agregado correctamente.");
  }

  async function handleDelete(shiftId: string) {
    await deleteScheduledShiftAction(shiftId);
    await load();
    showToast("Turno quitado correctamente.");
  }

  async function handleCopyPrevious() {
    setCopying(true);
    setError(null);

    const result = await copyPreviousWeekAction(weekStart);

    setCopying(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    await load();
    showToast("Semana anterior copiada correctamente.");
  }

  const shiftsByDay: Record<number, Shift[]> = {};
  for (let i = 0; i < 7; i++) shiftsByDay[i] = [];

  for (const shift of shifts) {
    const shiftDate = new Date(shift.date).toISOString().slice(0, 10);
    const dayIndex = Math.round(
      (new Date(shiftDate).getTime() - new Date(weekStart).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (dayIndex >= 0 && dayIndex < 7) {
      shiftsByDay[dayIndex].push(shift);
    }
  }

  const todayStr = todayDateOnly();

  const stats = useMemo(() => {
    const peopleScheduled = new Set(shifts.map((s) => s.user.id)).size;
    const branchesCovered = new Set(shifts.map((s) => s.branch.id)).size;

    return {
      total: shifts.length,
      peopleScheduled,
      branchesCovered,
    };
  }, [shifts]);

  const chartData = useMemo(
    () =>
      DAY_SHORT.map((label, i) => ({
        day: label,
        turnos: shiftsByDay[i]?.length ?? 0,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shifts, weekStart]
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid grid-cols-3 gap-4 lg:grid-cols-1">
          <Card>
            <CardLabel>Turnos</CardLabel>
            <CardValue>{stats.total}</CardValue>
          </Card>

          <Card highlight>
            <CardLabel>Personal programado</CardLabel>
            <CardValue>{stats.peopleScheduled}</CardValue>
          </Card>

          <Card>
            <CardLabel>Sucursales cubiertas</CardLabel>
            <CardValue>{stats.branchesCovered}</CardValue>
          </Card>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <p className="font-mono text-xs uppercase tracking-wide text-on-surface-variant">
            Turnos por día
          </p>

          <div className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444748" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#8e9192"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#8e9192"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={24}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.08)" }}
                  contentStyle={{
                    background: "#201f1f",
                    border: "1px solid #444748",
                    borderRadius: 12,
                    color: "#e5e2e1",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#c4c7c8" }}
                />
                <Bar dataKey="turnos" name="Turnos" fill="#f2f2f3" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((prev) => addDays(prev, -7))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:border-primary/40 hover:text-primary"
            aria-label="Semana anterior"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          <div className="min-w-[220px] text-center">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
              Semana
            </p>
            <p className="font-semibold text-on-surface">
              {formatWeekRange(weekStart)}
            </p>
          </div>

          <button
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:border-primary/40 hover:text-primary"
            aria-label="Semana siguiente"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>

          {weekStart !== getMostRecentMonday() && (
            <button
              onClick={() => setWeekStart(getMostRecentMonday())}
              className="ml-1 rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
            >
              Hoy
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopyPrevious}
            disabled={copying}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:border-primary/40 hover:text-primary disabled:opacity-60 disabled:hover:scale-100"
          >
            <ClipboardIcon className="h-4 w-4" />
            {copying ? "Copiando..." : "Copiar semana anterior"}
          </button>

          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            {showForm ? <XIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
            {showForm ? "Cancelar" : "Agregar turno"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {showForm && (
        <section className="overflow-hidden rounded-3xl border border-primary/25 bg-surface-container">
          <div className="border-b border-outline-variant bg-primary/[0.06] p-6 sm:p-8">
            <p className="font-mono text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant">
              Nuevo turno
            </p>
            <h2 className="mt-2 text-2xl font-bold text-on-surface">
              Agregar turno a la semana
            </h2>
          </div>

          <div className="space-y-5 p-6 sm:p-8">
            <Field label="Día">
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setFormDay(i);
                      setTimeTouched(false);
                    }}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      formDay === i
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Trabajador">
                <select
                  value={formUser}
                  onChange={(e) => setFormUser(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Sucursal">
                <select
                  value={formBranch}
                  onChange={(e) => {
                    setFormBranch(e.target.value);
                    setTimeTouched(false);
                  }}
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Entrada">
                <input
                  type="time"
                  value={formStart}
                  onChange={(e) => {
                    setFormStart(e.target.value);
                    setTimeTouched(true);
                  }}
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </Field>

              <Field label="Salida">
                <input
                  type="time"
                  value={formEnd}
                  onChange={(e) => {
                    setFormEnd(e.target.value);
                    setTimeTouched(true);
                  }}
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </Field>
            </div>

            {activeTemplate && !timeTouched && (
              <p className="text-xs text-on-surface-variant">
                Horas de la plantilla: {activeTemplate.startTime}–{activeTemplate.endTime}
              </p>
            )}

            <div className="flex flex-wrap gap-3 border-t border-outline-variant pt-5">
              <button
                onClick={handleAddShift}
                disabled={saving}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
              >
                {saving ? "Agregando..." : "Agregar turno"}
              </button>

              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
              >
                Cancelar
              </button>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-center text-on-surface-variant">Cargando...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DAY_LABELS.map((label, i) => {
            const dayDate = addDays(weekStart, i);
            const isToday = dayDate === todayStr;

            return (
              <div
                key={label}
                className={`overflow-hidden rounded-2xl border bg-surface-container ${
                  isToday ? "border-primary/30" : "border-outline-variant"
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b px-4 py-3 ${
                    isToday
                      ? "border-outline-variant bg-primary/[0.06]"
                      : "border-outline-variant bg-surface-container-high"
                  }`}
                >
                  <div>
                    <p
                      className={`font-mono text-[10px] font-black uppercase tracking-[0.2em] ${
                        isToday ? "text-primary" : "text-on-surface-variant"
                      }`}
                    >
                      {DAY_SHORT[i]} · {formatDayHeader(dayDate)}
                    </p>
                    <p className="font-bold text-on-surface">{label}</p>
                  </div>

                  <span className="rounded-full bg-surface-container-highest px-2.5 py-1 text-xs font-bold text-on-surface-variant">
                    {shiftsByDay[i].length}
                  </span>
                </div>

                <div className="space-y-2 p-3">
                  {shiftsByDay[i].length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-outline">
                      Sin turnos
                    </p>
                  )}

                  {shiftsByDay[i].map((shift) => (
                    <div
                      key={shift.id}
                      className="group flex items-center gap-3 rounded-xl border border-outline-variant bg-background px-3 py-2.5 transition hover:border-outline"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary ring-1 ring-primary/30">
                        {getInitials(shift.user.name)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-on-surface">
                          {shift.user.name}
                        </p>
                        <p className="truncate text-xs text-on-surface-variant">
                          {shift.branch.name} · {shift.startTime}–{shift.endTime}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDelete(shift.id)}
                        className="shrink-0 rounded-lg p-1.5 text-outline opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
                        aria-label="Quitar turno"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-on-surface-variant">
        {label}
      </span>
      {children}
    </label>
  );
}
