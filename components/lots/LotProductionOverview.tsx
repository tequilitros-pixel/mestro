import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TARGET_BRIX } from "@/lib/fermentation/fermentationMetrics";
import { totalRunLoadedLiters } from "@/lib/distillation/loadLedger";

const fmt = (value: number, digits = 1) =>
  value.toLocaleString("es-MX", { maximumFractionDigits: digits });
const when = (date: Date) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
const hours = (start: Date, end: Date) =>
  Math.max(0, (end.getTime() - start.getTime()) / 3600000);

type Reading = {
  createdAt: Date;
  brix: number | null;
  ph: number | null;
  temperature: number | null;
  alcohol: number | null;
  saccharometer: number | null;
};

function lastValue(readings: Reading[], field: "brix" | "ph" | "temperature" | "alcohol" | "saccharometer", fallback: number | null = null) {
  return readings.find((reading) => reading[field] != null)?.[field] ?? fallback;
}

// Avisos informativos; nunca se utilizan para bloquear ni cerrar una tina.
function fermentationWarnings(readings: Reading[], active: boolean, initialTemp: number, initialPh: number) {
  if (!active) return [];
  const warnings: string[] = [];
  const temperature = lastValue(readings, "temperature", initialTemp);
  const ph = lastValue(readings, "ph", initialPh);
  if (temperature !== null && (temperature < 25 || temperature > 35))
    warnings.push("Temperatura fuera del rango de referencia (25–35 °C)");
  if (ph !== null && (ph < 3.8 || ph > 5))
    warnings.push("pH fuera del rango de referencia (3.8–5)");
  const brix = readings.filter((item) => item.brix !== null).slice(0, 4);
  if (brix.length >= 3 &&
      hours(brix[brix.length - 1].createdAt, brix[0].createdAt) >= 2 &&
      Math.abs((brix[0].brix ?? 0) - (brix[brix.length - 1].brix ?? 0)) < 0.3)
    warnings.push("Brix casi sin cambio en las últimas lecturas");
  const current = readings[0];
  const previous = readings[1];
  if (current && previous && hours(previous.createdAt, current.createdAt) <= 2) {
    if (current.temperature != null && previous.temperature != null && Math.abs(current.temperature - previous.temperature) > 5)
      warnings.push("Cambio brusco de temperatura");
    if (current.ph != null && previous.ph != null && Math.abs(current.ph - previous.ph) > 0.8)
      warnings.push("Cambio brusco de pH");
  }
  return warnings;
}

type Props = {
  lotId: string;
  nextAction: string;
  nextHref: string;
  status: string;
  progress: number;
};

export default async function LotProductionOverview({ lotId, nextAction, nextHref, status, progress }: Props) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      cookings: { orderBy: { startedAt: "asc" } },
      millings: { orderBy: { startedAt: "asc" } },
      fermentations: {
        orderBy: { startedAt: "asc" },
        include: {
          readings: { orderBy: { createdAt: "desc" } },
          distillations: { select: {
            id: true, type: true, status: true, loadedLiters: true,
            finalLiters: true, finalAlcohol: true, startedAt: true,
            supplementalLoads: { select: { liters: true } },
          } },
          supplementalLoads: {
            where: { distillation: { status: { not: "CANCELADA" } } },
            select: { liters: true, distillation: { select: { status: true } } },
          },
        },
      },
      distillations: { orderBy: { startedAt: "asc" }, include: {
        equipment: { select: { name: true } },
        supplementalLoads: { select: { liters: true } },
      } },
      boilerProcessLinks: { orderBy: { startedAt: "asc" }, include: {
        boilerSession: { select: { equipment: { select: { name: true } } } },
      } },
    },
  });
  if (!lot) return null;
  const now = new Date();
  const activeCooking = lot.cookings.filter((process) => process.status === "ACTIVA");
  const activeMilling = lot.millings.filter((process) => process.status === "ACTIVA");
  const activeFermentation = lot.fermentations.filter((process) => process.status === "ACTIVA");
  const activeDistillation = lot.distillations.filter((process) => process.status === "ACTIVA");
  const pending = [
    ...activeCooking.map((item) => ({ label: "Terminar cocimiento", href: "/cooking/" + item.id })),
    ...activeMilling.map((item) => ({ label: "Continuar molienda", href: "/milling/" + item.id })),
    ...activeFermentation.map((item) => ({ label: "Registrar lectura o cerrar " + item.tank, href: "/fermentation/" + item.id })),
    ...activeDistillation.map((item) => ({ label: "Registrar salida y terminar " + item.equipment.name, href: "/distillation/" + item.id })),
  ];
  if (!pending.length && lot.stage !== "TERMINADO") {
    const scopedHref = nextHref === "/cooking" ? "/cooking/new?lotId=" + lotId
      : nextHref === "/milling" ? "/milling/new?lotId=" + lotId
      : nextHref === "/fermentation" ? "/fermentation/new?lotId=" + lotId
      : nextHref === "/distillation" ? "/distillation/lots/" + lotId
      : nextHref === "/distillation/new" ? "/distillation/new?lotId=" + lotId
      : nextHref;
    pending.push({ label: nextAction, href: scopedHref });
  }

  const cookingHours = lot.cookings.reduce((sum, item) => sum + hours(item.startedAt, item.finishedAt ?? now), 0);
  const millingLiters = lot.millings.reduce((sum, item) => sum + (item.finalMashLiters ?? item.mashLiters ?? 0), 0);
  const fermentedLiters = lot.fermentations.reduce((sum, item) => sum + item.mustLiters, 0);
  const completedFermentations = lot.fermentations.filter((item) => item.finishedAt);
  const averageFermentationHours = completedFermentations.length
    ? completedFermentations.reduce((sum, item) => sum + hours(item.startedAt, item.finishedAt!), 0) / completedFermentations.length
    : null;

  const rectifications = lot.distillations.filter((run) => run.type === "RECTIFICACION" && run.status === "TERMINADA");
  const hasCompleteFinalAlcohol = rectifications.length > 0 && rectifications.every((run) =>
    (run.finalLiters ?? 0) > 0 && run.finalAlcohol != null && run.finalAlcohol > 0);
  const absoluteAlcohol = hasCompleteFinalAlcohol
    ? rectifications.reduce((sum, run) => sum + (run.finalLiters ?? 0) * (run.finalAlcohol ?? 0) / 100, 0)
    : null;
  const at55 = absoluteAlcohol === null ? null : absoluteAlcohol / 0.55;
  const at36 = absoluteAlcohol === null ? null : absoluteAlcohol / 0.36;
  const finishedWithPending = lot.stage === "TERMINADO" && pending.length > 0;

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Etapa actual y pendientes</p>
            <h2 className="mt-2 text-2xl font-bold text-primary">{finishedWithPending ? "Terminado con pendientes" : status}</h2>
          </div>
          <span className="rounded-full bg-surface-container-high px-3 py-1 text-sm">{progress}% de avance</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full bg-primary" style={{ width: String(progress) + "%" }} />
        </div>
        {pending.length === 0 ? <p className="mt-4 text-sm text-on-surface-variant">Sin operaciones abiertas por atender.</p> :
          <div className="mt-4 space-y-2">
            {pending.map((item, index) => (
              <Link key={index} href={item.href} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm font-semibold hover:border-primary">
                <span>{item.label}</span><span className="shrink-0 text-primary">Continuar →</span>
              </Link>
            ))}
          </div>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Panorama de producción</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Agave recibido" value={fmt(lot.agaveKg, 0) + " kg"} />
          <Metric label="Cocimiento acumulado" value={lot.cookings.length ? fmt(cookingHours) + " h" : "Sin registro"} />
          <Metric label="Mosto de molienda" value={lot.millings.length ? fmt(millingLiters) + " L" : "Sin registro"} />
          <Metric label="Mosto en fermentación" value={lot.fermentations.length ? fmt(fermentedLiters) + " L" : "Sin registro"} />
          <Metric label="Tinas registradas" value={String(lot.fermentations.length)} />
          <Metric label="Corridas de alambique" value={String(lot.distillations.length)} />
          <Metric label="Caldera vinculada" value={lot.boilerProcessLinks.length ? String(lot.boilerProcessLinks.length) + " intervalos" : "Sin vínculos"} />
          <Metric label="Mosto / kg de agave" value={lot.agaveKg > 0 && lot.millings.length ? fmt(millingLiters / lot.agaveKg, 2) + " L/kg" : "—"} />
        </div>
        <p className="text-xs text-on-surface-variant">Las duraciones son suma de procesos registrados. Los litros de molienda usan el cierre final cuando existe; no son una medición de alcohol.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Fermentación y rendimiento por tina</h2>
        <p className="text-sm text-on-surface-variant">Todas las tinas pertenecen al lote actual. Los grados Brix son lecturas aparentes; su caída no equivale directamente al rendimiento alcohólico.</p>
        {!lot.fermentations.length && <p className="rounded-xl border border-dashed border-outline-variant p-4 text-sm">Todavía no hay tinas registradas.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {lot.fermentations.map((tina) => {
            const active = tina.status === "ACTIVA";
            const brix = lastValue(tina.readings, "brix", tina.finalBrix ?? tina.initialBrix);
            const ph = lastValue(tina.readings, "ph", tina.finalPh ?? tina.initialPh);
            const temp = lastValue(tina.readings, "temperature", tina.initialTemperature);
            const sac = lastValue(tina.readings, "saccharometer");
            const warnings = fermentationWarnings(tina.readings, active, tina.initialTemperature, tina.initialPh);
            const destrozados = tina.distillations.filter((run) => run.type === "DESTROZADO" && run.status !== "CANCELADA");
            const charged = destrozados.reduce((sum, run) => sum + run.loadedLiters, 0)
              + tina.supplementalLoads.reduce((sum, load) => sum + load.liters, 0);
            // La salida de una mezcla NO se puede atribuir a una tina sin medición independiente.
            const blended = destrozados.some((run) => run.supplementalLoads.length > 0)
              || tina.supplementalLoads.length > 0;
            const attributable = destrozados.filter((run) =>
              run.status === "TERMINADA" && run.supplementalLoads.length === 0);
            const produced = attributable.reduce((sum, run) => sum + (run.finalLiters ?? 0), 0);
            const hasMeasuredOutput = attributable.length > 0
              && attributable.every((run) => run.finalLiters !== null);
            const expected = active && averageFermentationHours !== null
              ? new Date(tina.startedAt.getTime() + averageFermentationHours * 3600000) : null;
            const currentTime = hours(tina.startedAt, tina.finishedAt ?? now);
            if (active && averageFermentationHours !== null && currentTime > averageFermentationHours * 1.25) warnings.push("Fermentación supera la duración promedio del lote");
            return (
              <article key={tina.id} className="rounded-2xl border border-outline-variant bg-surface-container p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold">{tina.tank}</h3>
                  <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs">{active ? "En fermentación" : "Cerrada"}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Datum label="Mosto inicial" value={fmt(tina.mustLiters) + " L"} />
                  <Datum label="Brix inicio → actual" value={fmt(tina.initialBrix) + "° → " + (brix === null ? "—" : fmt(brix) + "°")} />
                  <Datum label="Temperatura" value={temp === null ? "—" : fmt(temp) + " °C"} />
                  <Datum label="pH" value={ph === null ? "—" : fmt(ph, 2)} />
                  <Datum label="Sacarímetro" value={sac === null ? "—" : fmt(sac, 2)} />
                  <Datum label="Tiempo" value={fmt(currentTime) + " h"} />
                  <Datum label="Mosto cargado a destrozado" value={fmt(charged) + " L"} />
                  <Datum label="Salida atribuible sin mezcla" value={hasMeasuredOutput ? fmt(produced) + " L" : blended ? "Mezcla no atribuible" : "Por completar"} />
                  <Datum label="Salida / 1,000 L mosto" value={hasMeasuredOutput && charged > 0 ? fmt(produced / charged * 1000) + " L" : "—"} />
                </div>
                {blended && <p className="mt-3 text-xs text-on-surface-variant">La tina compartió alambique con otra fuente: los litros cargados se cuentan por origen, pero la salida mezclada solo se informa a nivel de corrida y lote.</p>}
                {expected && <p className="mt-3 text-xs text-on-surface-variant">Proyección orientativa de cierre: {when(expected)} (según duración de otras tinas terminadas de este lote; no predice el alcohol).</p>}
                {active && !expected && <p className="mt-3 text-xs text-on-surface-variant">Proyección pendiente: faltan tinas terminadas para establecer una referencia.</p>}
                {warnings.length > 0 && <div className="mt-3 rounded-xl border border-amber-500/40 p-3 text-sm">
                  <p className="font-semibold">Avisos de fermentación</p>
                  <ul className="mt-1 list-inside list-disc">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </div>}
                <Link href={"/fermentation/" + tina.id} className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline">Abrir gráficas y bitácora →</Link>
              </article>
            );
          })}
        </div>
        <p className="text-xs text-on-surface-variant">El destrozado se atribuye directamente a la tina de origen registrada. El tequila rectificado que pasó por un receptor compartido no se asigna artificialmente a una tina.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Resultado de rectificación del lote</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Tequila equivalente a 55°" value={at55 === null ? "Pendiente" : fmt(at55) + " L"} />
          <Metric label="Equivalente a 36°" value={at36 === null ? "Pendiente" : fmt(at36) + " L"} />
          <Metric label="Alcohol absoluto" value={absoluteAlcohol === null ? "Pendiente" : fmt(absoluteAlcohol) + " LAA"} />
          <Metric label="Equivalente 55° por tonelada de agave" value={at55 === null || lot.agaveKg <= 0 ? "—" : fmt(at55 / lot.agaveKg * 1000) + " L/t"} />
        </div>
        <p className="text-xs text-on-surface-variant">Estos equivalentes solo se muestran si todas las rectificaciones finalizadas tienen volumen y grado alcohólico registrados. Cálculos teóricos antes de contracción de mezclas y correcciones de temperatura. Objetivo de referencia de Brix: {TARGET_BRIX}°; no se usa para estimar alcohol.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Historial completo del lote</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <History title="Cocimiento" items={lot.cookings.map((item) => ({ id: item.id, label: fmt(item.agaveKg, 0) + " kg · " + fmt(hours(item.startedAt, item.finishedAt ?? now)) + " h", detail: item.status, href: "/cooking/" + item.id, date: item.startedAt }))} />
          <History title="Molienda" items={lot.millings.map((item) => ({ id: item.id, label: fmt(item.finalMashLiters ?? item.mashLiters ?? 0) + " L mosto", detail: item.status, href: "/milling/" + item.id, date: item.startedAt }))} />
          <History title="Fermentación" items={lot.fermentations.map((item) => ({ id: item.id, label: item.tank + " · " + fmt(item.mustLiters) + " L", detail: item.status, href: "/fermentation/" + item.id, date: item.startedAt }))} />
          <History title="Destilación" items={lot.distillations.map((item) => ({ id: item.id, label: item.equipment.name + " · " + (item.type === "DESTROZADO" ? "Destrozado" : "Rectificación") + " · " + fmt(totalRunLoadedLiters(item)) + " L", detail: item.status, href: "/distillation/" + item.id, date: item.startedAt }))} />
        </div>
        <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <h3 className="font-semibold">Caldera vinculada a este lote</h3>
          {lot.boilerProcessLinks.length === 0 ? <p className="mt-2 text-sm text-on-surface-variant">Sin intervalos vinculados.</p> :
            <div className="mt-2 space-y-2">{lot.boilerProcessLinks.map((link) =>
              <p key={link.id} className="text-sm">{link.boilerSession.equipment.name} · {link.stage} · {when(link.startedAt)} · {link.endedAt ? "Finalizado" : "Abierto"}</p>
            )}</div>}
          <Link href="/boiler" className="mt-3 inline-flex text-sm font-semibold text-primary underline">Ver caldera →</Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-outline-variant bg-surface-container p-3 sm:p-4"><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-2 break-words text-xl font-bold text-primary">{value}</p></div>;
}
function Datum({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-on-surface-variant">{label}</p><p className="font-semibold">{value}</p></div>;
}
type HistoryItem = { id: string; label: string; detail: string; date: Date; href: string };
function History({ title, items }: { title: string; items: HistoryItem[] }) {
  return <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
    <h3 className="text-base font-bold">{title} · {items.length}</h3>
    {items.length === 0 ? <p className="mt-2 text-sm text-on-surface-variant">Sin registros en este lote.</p> :
      <div className="mt-2 divide-y divide-outline-variant">
        {items.map((item) => <Link href={item.href} key={item.id} className="flex min-h-14 items-center justify-between gap-3 py-2 hover:text-primary">
          <div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-on-surface-variant">{when(item.date)} · {item.detail}</p></div><span aria-hidden>→</span>
        </Link>)}
      </div>}
  </div>;
}
