import { BoilerEventType, EquipmentType, GasReadingType, PressureUnit } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBusinessDateTime } from "@/lib/dateTime";
import { deriveBoilerHorometer, deriveGasSummary } from "@/lib/boiler/units";
import PageTabs from "@/components/ui/PageTabs";
import OfflineBoilerForm from "@/components/offline/OfflineBoilerForm";
import {
  createBoilerEventAction,
  createBoilerIncidentAction,
  createBoilerMaintenanceAction,
  createBoilerPressureAction,
  createGasReadingAction,
  startBoilerSessionAction,
  stopBoilerSessionAction,
} from "../actions";

const inputClass = "rounded-xl border border-outline-variant bg-surface px-3 py-2";
const buttonClass = "rounded-xl bg-primary px-4 py-3 font-bold text-on-primary";
const field = (name: string, label: string, type = "text", required = false) => (
  <label className="grid gap-1 text-sm"><span className="font-semibold">{label}</span><input name={name} type={type} required={required} min={type === "number" ? "0" : undefined} max={type === "number" ? "100" : undefined} step={type === "number" ? "0.01" : undefined} className={inputClass} /></label>
);
const shell = (children: React.ReactNode) => <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">{children}</div>;

export default async function BoilerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.equipment.findFirst({
    where: { id, type: EquipmentType.CALDERA, active: true },
    include: {
      boilerSessions: {
        orderBy: { startedAt: "desc" },
        take: 50,
        include: {
          gasReadings: { orderBy: { occurredAt: "asc" } },
          pressureReadings: { orderBy: { occurredAt: "asc" } },
          processLinks: { include: { lot: { select: { code: true } } }, orderBy: { startedAt: "asc" } },
          events: { orderBy: { occurredAt: "asc" } },
        },
      },
      boilerMaintenances: { orderBy: { occurredAt: "desc" }, take: 20 },
      boilerIncidents: { orderBy: { occurredAt: "desc" }, take: 20 },
    },
  });
  if (!item) notFound();
  const active = item.boilerSessions.find((session) => !session.endedAt) ?? null;
  const latestGas = active?.gasReadings.at(-1);
  const latestPressure = active?.pressureReadings.at(-1);
  const horometerHours = deriveBoilerHorometer(item.boilerSessions);

  const register = (
    <div className="grid gap-4 lg:grid-cols-2">
      {!active && shell(
        <OfflineBoilerForm kind="boiler.session.start" entityField="equipmentId" entityId={id} fallbackAction={startBoilerSessionAction} className="space-y-4">
          <h2 className="text-xl font-bold">Encender Caldera</h2><input type="hidden" name="equipmentId" value={id} />
          {field("initialGasPercent", "Gas inicial (%)", "number", true)}{field("notes", "Notas")}
          <button className={buttonClass}>Registrar encendido</button>
        </OfflineBoilerForm>,
      )}
      {shell(
        <OfflineBoilerForm kind="boiler.session.stop" entityField="sessionId" entityId={active?.id ?? id} fallbackAction={stopBoilerSessionAction} className="space-y-4">
          <h2 className="text-xl font-bold">Cerrar sesión</h2>
          {active ? <><input type="hidden" name="sessionId" value={active.id} />{field("finalGasPercent", "Gas final (%)", "number", true)}{field("closeReason", "Motivo (opcional)")}<button className={buttonClass}>Registrar apagado y consumo</button></> : <p className="text-sm text-on-surface-variant">No hay una sesión activa.</p>}
        </OfflineBoilerForm>,
      )}
      {shell(
        <OfflineBoilerForm kind="boiler.gas.reading.create" entityField="sessionId" entityId={active?.id ?? id} fallbackAction={createGasReadingAction} className="space-y-4">
          <h2 className="text-xl font-bold">Lectura de gas</h2>
          {active ? <><input type="hidden" name="sessionId" value={active.id} />{field("percent", "Nivel (%)", "number", true)}<label className="grid gap-1 text-sm font-semibold">Tipo<select name="type" className={inputClass}>{Object.values(GasReadingType).map((value) => <option key={value}>{value}</option>)}</select></label>{field("notes", "Notas")}<button className={buttonClass}>Guardar lectura</button></> : <p className="text-sm text-on-surface-variant">Enciende la Caldera primero.</p>}
        </OfflineBoilerForm>,
      )}
      {shell(
        <OfflineBoilerForm kind="boiler.pressure.reading.create" entityField="sessionId" entityId={active?.id ?? id} fallbackAction={createBoilerPressureAction} className="space-y-4">
          <h2 className="text-xl font-bold">Presión</h2>
          {active ? <><input type="hidden" name="sessionId" value={active.id} />{field("value", "Valor", "number", true)}<label className="grid gap-1 text-sm font-semibold">Unidad<select name="unit" className={inputClass}>{Object.values(PressureUnit).map((value) => <option key={value}>{value === "KG_CM2" ? "kg/cm²" : value}</option>)}</select></label>{field("notes", "Notas")}<button className={buttonClass}>Guardar presión</button></> : <p className="text-sm text-on-surface-variant">Enciende la Caldera primero.</p>}
        </OfflineBoilerForm>,
      )}
      {shell(
        <OfflineBoilerForm kind="boiler.event.create" entityField="sessionId" entityId={active?.id ?? ""} fallbackAction={createBoilerEventAction} className="space-y-4">
          <h2 className="text-xl font-bold">Evento</h2><label className="grid gap-1 text-sm font-semibold">Tipo<select name="type" className={inputClass}>{Object.values(BoilerEventType).map((value) => <option key={value}>{value}</option>)}</select></label>{field("notes", "Notas")}<button className={buttonClass}>Registrar evento</button>
        </OfflineBoilerForm>,
      )}
      {shell(
        <OfflineBoilerForm kind="boiler.incident.create" entityField="equipmentId" entityId={id} fallbackAction={createBoilerIncidentAction} className="space-y-4">
          <h2 className="text-xl font-bold">Incidencia</h2><input type="hidden" name="equipmentId" value={id} />{active && <input type="hidden" name="sessionId" value={active.id} />}{field("notes", "Detalle", "text", true)}<button className={buttonClass}>Registrar incidencia</button>
        </OfflineBoilerForm>,
      )}
    </div>
  );

  const log = item.boilerSessions.flatMap((session) => [
    ...session.events.map((event) => ({ at: event.occurredAt, label: event.type, detail: event.notes })),
    ...session.gasReadings.map((reading) => ({ at: reading.occurredAt, label: `GAS ${reading.type}`, detail: `${Number(reading.levelPercent)}% · ${Number(reading.levelLiters)} L` })),
    ...session.pressureReadings.map((reading) => ({ at: reading.occurredAt, label: "PRESIÓN", detail: `${Number(reading.originalValue)} ${reading.originalUnit} · ${Number(reading.canonicalPsi)} PSI` })),
  ]).sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Operación de planta</p><h1 className="mt-2 text-3xl font-bold">{item.name}</h1><p className="mt-2 text-on-surface-variant">Tanque nominal de 1,000 L: cada 1% equivale a 10 L. El apagado exige lectura final para calcular consumo.</p></header>
      <PageTabs tabs={[
        { key: "summary", label: "Resumen", content: <section className="grid gap-4 sm:grid-cols-3"><Metric label="Estado" value={active ? "ENCENDIDA" : "APAGADA"} /><Metric label="Gas" value={latestGas ? `${Number(latestGas.levelPercent)}% · ${Number(latestGas.levelLiters)} L` : "—"} /><Metric label="Presión" value={latestPressure ? `${Number(latestPressure.canonicalPsi)} PSI` : "—"} /><Metric label="Horómetro" value={`${horometerHours.toFixed(2)} h`} /><div className="sm:col-span-3 rounded-2xl border border-outline-variant bg-surface-container p-5"><h2 className="font-bold">Consumidores activos</h2><p className="mt-2 text-sm text-on-surface-variant">{active?.processLinks.filter((link) => !link.endedAt).map((link) => `${link.processType}: ${link.lot.code}`).join(", ") || "Ninguno"}</p></div></section> },
        { key: "register", label: "Registrar", content: register },
        { key: "usage", label: "Uso y consumo", content: <section className="space-y-3">{item.boilerSessions.map((session) => { const summary = deriveGasSummary(session.gasReadings); return <article key={session.id} className="rounded-2xl border border-outline-variant bg-surface-container p-5"><p className="font-bold">{formatBusinessDateTime(session.startedAt)} — {session.endedAt ? formatBusinessDateTime(session.endedAt) : "activa"}</p><p className="mt-2 text-sm">Consumo neto: <strong>{summary.netConsumptionLiters.toFixed(2)} L</strong> · {summary.litersPerHour?.toFixed(2) ?? "—"} L/h · recargas {summary.refillLiters.toFixed(2)} L</p><div className="mt-3 space-y-1">{session.processLinks.map((link) => <p key={link.id} className="text-sm text-on-surface-variant">{link.processType} · lote {link.lot.code} · {hoursBetween(link.startedAt, link.endedAt).toFixed(2)} h {link.endedAt ? "" : "(activo)"}</p>)}{session.processLinks.length === 0 && <p className="text-sm text-on-surface-variant">Sin proceso vinculado.</p>}</div></article>; })}</section> },
        { key: "log", label: "Bitácora", content: <section className="rounded-2xl border border-outline-variant bg-surface-container p-5"><div className="space-y-3">{log.map((entry, index) => <div key={`${entry.at.toISOString()}-${index}`} className="border-b border-outline-variant pb-3"><p className="text-sm font-bold">{entry.label}</p><p className="text-xs text-on-surface-variant">{formatBusinessDateTime(entry.at)}{entry.detail ? ` · ${entry.detail}` : ""}</p></div>)}{log.length === 0 && <p className="text-sm text-on-surface-variant">Sin registros.</p>}</div></section> },
        { key: "maintenance", label: "Mantenimiento", content: <section className="space-y-4">{shell(<OfflineBoilerForm kind="boiler.maintenance.create" entityField="equipmentId" entityId={id} fallbackAction={createBoilerMaintenanceAction} className="space-y-4"><input type="hidden" name="equipmentId" value={id} />{field("notes", "Mantenimiento realizado", "text", true)}<button className={buttonClass}>Registrar mantenimiento</button></OfflineBoilerForm>)}{item.boilerMaintenances.map((maintenance) => <div key={maintenance.id} className="rounded-xl border border-outline-variant p-4 text-sm">{formatBusinessDateTime(maintenance.occurredAt)} · {maintenance.notes}</div>)}</section> },
      ]} />
    </main>
  );
}

function hoursBetween(start: Date, end: Date | null) {
  return Math.max(0, ((end ?? new Date()).getTime() - start.getTime()) / 3_600_000);
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-outline-variant bg-surface-container p-5"><p className="text-sm text-on-surface-variant">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}
