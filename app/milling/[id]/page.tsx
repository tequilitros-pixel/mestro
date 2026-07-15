import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import MillingCharts from "@/components/MillingCharts";
import FinishMillingModal from "@/components/FinishMillingModal";
import {
  MillingEventType,
  MillingStatus,
} from "@prisma/client";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

type DischargeForAverage = {
  litersRecovered: number;
  brix: number;
  ph: number;
  temperature: number;
};

function weightedAverage(
  items: DischargeForAverage[],
  getValue: (item: DischargeForAverage) => number
) {
  const totalLiters = items.reduce(
    (sum, item) => sum + item.litersRecovered,
    0
  );

  if (totalLiters <= 0) return null;

  return (
    items.reduce(
      (sum, item) =>
        sum + item.litersRecovered * getValue(item),
      0
    ) / totalLiters
  );
}

export default async function MillingDetailPage({
  params,
}: Props) {
  const { id } = await params;

  const milling = await prisma.milling.findUnique({
    where: { id },
    include: {
      lot: true,
      equipment: true,
      finishedBy: true,
      events: {
        orderBy: {
          createdAt: "asc",
        },
      },
      discharges: {
        include: {
          tank: true,
          createdBy: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!milling) notFound();

  const tanks = await prisma.equipment.findMany({
    where: {
      type: "TINA",
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const hasFinished =
    milling.status === MillingStatus.TERMINADA;

  const totalLiters = milling.discharges.reduce(
    (sum, discharge) =>
      sum + Number(discharge.litersRecovered),
    0
  );

  const averageBrix = weightedAverage(
    milling.discharges,
    (discharge) => Number(discharge.brix)
  );

  const averagePh = weightedAverage(
    milling.discharges,
    (discharge) => Number(discharge.ph)
  );

  const averageTemperature = weightedAverage(
    milling.discharges,
    (discharge) => Number(discharge.temperature)
  );

  const tanksUsed = Array.from(
    new Set(
      milling.discharges
        .map(
          (discharge) =>
            discharge.tank?.name ?? "Sin tina asignada"
        )
        .filter(Boolean)
    )
  );

  const duration = formatDuration(
    milling.startedAt,
    milling.finishedAt ?? new Date()
  );

  const recoveryYield =
    milling.cookedKg > 0
      ? (totalLiters / milling.cookedKg) * 100
      : 0;

  const millingHealth = getMillingHealth({
    hasFinished,
    dischargesCount: milling.discharges.length,
    totalLiters,
    averageBrix,
    averagePh,
    averageTemperature,
  });

  async function addDischarge(formData: FormData) {
    "use server";

    const user = await getCurrentUser();

    if (!user) {
      redirect("/login");
    }

    const currentMilling =
      await prisma.milling.findUnique({
        where: { id },
        select: {
          status: true,
          closureCode: true,
        },
      });

    if (
      !currentMilling ||
      currentMilling.status === MillingStatus.TERMINADA ||
      currentMilling.closureCode
    ) {
      redirect(`/milling/${id}`);
    }

    const tankIdValue = formData.get("tankId");

    const tankId =
      typeof tankIdValue === "string" &&
      tankIdValue.trim()
        ? tankIdValue.trim()
        : null;

    const litersRecovered = parseRequiredNumber(
      formData.get("litersRecovered")
    );

    const brix = parseRequiredNumber(
      formData.get("brix")
    );

    const ph = parseRequiredNumber(
      formData.get("ph")
    );

    const temperature = parseRequiredNumber(
      formData.get("temperature")
    );

    const notesValue = formData.get("notes");

    const notes =
      typeof notesValue === "string" &&
      notesValue.trim()
        ? notesValue.trim()
        : null;

    if (
      litersRecovered === null ||
      brix === null ||
      ph === null ||
      temperature === null
    ) {
      redirect(`/milling/${id}`);
    }

    if (
      litersRecovered <= 0 ||
      brix < 0 ||
      ph < 0 ||
      ph > 14 ||
      temperature < 0
    ) {
      redirect(`/milling/${id}`);
    }

    if (tankId) {
      const selectedTank =
        await prisma.equipment.findFirst({
          where: {
            id: tankId,
            type: "TINA",
            active: true,
          },
          select: {
            id: true,
          },
        });

      if (!selectedTank) {
        redirect(`/milling/${id}`);
      }
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.millingDischarge.create({
        data: {
          millingId: id,
          tankId,
          litersRecovered,
          brix,
          ph,
          temperature,
          notes,
          createdById: user.id,
        },
      });

      await transaction.millingEvent.create({
        data: {
          millingId: id,
          type: MillingEventType.OBSERVACION,
          brix,
          ph,
          temperature,
          notes:
            notes ??
            `Descarga de ${formatNumber(
              litersRecovered
            )} L registrada${
              tankId ? " hacia tina asignada" : ""
            }.`,
        },
      });
    });

    redirect(`/milling/${id}`);
  }

  async function finishMilling(formData: FormData) {
    "use server";

    const user = await getCurrentUser();

    if (!user) {
      redirect("/login");
    }

    const finalMashLiters = parseRequiredNumber(
      formData.get("finalMashLiters")
    );

    const finalAverageBrix = parseRequiredNumber(
      formData.get("finalAverageBrix")
    );

    const finalAveragePh = parseRequiredNumber(
      formData.get("finalAveragePh")
    );

    const finalAverageTemp = parseRequiredNumber(
      formData.get("finalAverageTemp")
    );

    const finalBagasseKg = parseOptionalNumber(
      formData.get("finalBagasseKg")
    );

    const finalWaterLiters = parseOptionalNumber(
      formData.get("finalWaterLiters")
    );

    const finalPressPasses = parseOptionalInteger(
      formData.get("finalPressPasses")
    );

    const finalNotesValue =
      formData.get("finalNotes");

    const finalNotes =
      typeof finalNotesValue === "string" &&
      finalNotesValue.trim()
        ? finalNotesValue.trim()
        : null;

    if (
      finalMashLiters === null ||
      finalAverageBrix === null ||
      finalAveragePh === null ||
      finalAverageTemp === null
    ) {
      redirect(`/milling/${id}`);
    }

    if (
      finalMashLiters < 0 ||
      finalAverageBrix < 0 ||
      finalAveragePh < 0 ||
      finalAveragePh > 14 ||
      finalAverageTemp < 0 ||
      (finalBagasseKg !== null &&
        finalBagasseKg < 0) ||
      (finalWaterLiters !== null &&
        finalWaterLiters < 0) ||
      (finalPressPasses !== null &&
        finalPressPasses < 0)
    ) {
      redirect(`/milling/${id}`);
    }

    const currentMilling =
      await prisma.milling.findUnique({
        where: { id },
        select: {
          status: true,
          closureCode: true,
        },
      });

    if (!currentMilling) {
      notFound();
    }

    if (
      currentMilling.status === MillingStatus.TERMINADA ||
      currentMilling.closureCode
    ) {
      redirect(`/milling/${id}`);
    }

    const finishedAt = new Date();

    const closureCode =
      await createMillingClosureCode(finishedAt);

    const result = await prisma.$transaction(
      async (transaction) => {
        const updated =
          await transaction.milling.updateMany({
            where: {
              id,
              status: {
                not: MillingStatus.TERMINADA,
              },
              closureCode: null,
            },
            data: {
              status: MillingStatus.TERMINADA,
              finishedAt,
              finalMashLiters,
              finalAverageBrix,
              finalAveragePh,
              finalAverageTemp,
              finalBagasseKg,
              finalWaterLiters,
              finalPressPasses,
              finalNotes,
              closureCode,
              finishedById: user.id,

              mashLiters: finalMashLiters,
              brix: finalAverageBrix,
              ph: finalAveragePh,
              temperature: finalAverageTemp,
              bagasseKg: finalBagasseKg,
              waterLiters: finalWaterLiters,
              pressPasses: finalPressPasses,
              observations:
                finalNotes ?? undefined,
            },
          });

        if (updated.count === 0) {
          return updated;
        }

        await transaction.millingEvent.create({
          data: {
            millingId: id,
            type: MillingEventType.FIN_MOLIENDA,
            brix: finalAverageBrix,
            ph: finalAveragePh,
            temperature: finalAverageTemp,
            bagasseKg: finalBagasseKg,
            waterLiters: finalWaterLiters,
            pressPasses: finalPressPasses,
            notes:
              finalNotes ??
              `Molienda cerrada mediante ${closureCode}.`,
          },
        });

        return updated;
      }
    );

    if (result.count === 0) {
      redirect(`/milling/${id}`);
    }

    redirect(`/milling/${id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
    

        <header className="mt-8">
          <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
            MAESTRO
          </p>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">
                Molienda {milling.lot.code}
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                {milling.equipment.name} · Inicio{" "}
                {formatDateTime(milling.startedAt)}
              </p>
            </div>

            <MillingStatusBadge status={millingHealth} />
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            title="Equipo"
            value={milling.equipment.name}
            detail="Equipo principal"
          />

          <Kpi
            title="Kg cocidos"
            value={`${formatNumber(
              milling.cookedKg,
              0
            )} kg`}
            detail="Carga recibida de cocción"
          />

          <Kpi
            title="Estado"
            value={formatStatus(milling.status)}
            detail={
              hasFinished
                ? "Proceso cerrado"
                : "Proceso activo"
            }
            highlight={!hasFinished}
          />

          <Kpi
            title="Duración"
            value={duration}
            detail={
              hasFinished
                ? "Duración oficial"
                : "Tiempo transcurrido"
            }
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-blue-500/20 bg-blue-950/60">
          <div className="p-6 sm:p-8">
            <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
              Mosto acumulado
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryMetric
                title="Litros recuperados"
                value={`${formatNumber(
                  totalLiters,
                  0
                )} L`}
                highlight
              />

              <SummaryMetric
                title="Descargas"
                value={milling.discharges.length}
              />

              <SummaryMetric
                title="°Brix promedio"
                value={formatNumber(averageBrix)}
              />

              <SummaryMetric
                title="pH promedio"
                value={formatNumber(averagePh)}
              />

              <SummaryMetric
                title="Temperatura promedio"
                value={
                  averageTemperature !== null
                    ? `${formatNumber(
                        averageTemperature
                      )} °C`
                    : "-"
                }
              />
            </div>
          </div>

          <div className="grid border-t border-blue-500/10 sm:grid-cols-3">
            <ProcessIndicator
              title="Recuperación"
              value={`${formatNumber(
                recoveryYield
              )} L por cada 100 kg`}
              warning={totalLiters <= 0}
            />

            <ProcessIndicator
              title="Tinas utilizadas"
              value={String(tanksUsed.length)}
              warning={tanksUsed.length === 0}
            />

            <ProcessIndicator
              title="Proceso"
              value={formatStatus(milling.status)}
              warning={false}
            />
          </div>
        </section>

        <section
          className={`mt-6 rounded-2xl border p-6 ${
            millingHealth === "ATENCION"
              ? "border-red-500/30 bg-red-500/10"
              : millingHealth === "TERMINADA"
                ? "border-blue-500/30 bg-blue-500/10"
                : millingHealth === "LISTA"
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-amber-400/30 bg-amber-400/10"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">
            Análisis de MAESTRO
          </p>

          <h2
            className={`mt-3 text-2xl font-bold sm:text-3xl ${
              millingHealth === "ATENCION"
                ? "text-red-400"
                : millingHealth === "TERMINADA"
                  ? "text-blue-400"
                  : millingHealth === "LISTA"
                    ? "text-green-400"
                    : "text-amber-300"
            }`}
          >
            {getMillingHealthTitle(millingHealth)}
          </h2>

          <div className="mt-5 space-y-3">
            {buildMillingMessages({
              hasFinished,
              totalLiters,
              dischargesCount:
                milling.discharges.length,
              averageBrix,
              averagePh,
              averageTemperature,
              tanksUsed,
            }).map((message) => (
              <div
                key={message}
                className="flex items-start gap-3 rounded-xl bg-slate-950/40 p-3"
              >
                <span className="mt-0.5 text-amber-400">
                  ●
                </span>

                <p className="text-slate-200">
                  {message}
                </p>
              </div>
            ))}
          </div>
        </section>

        {hasFinished && (
          <MillingClosureAct
            closureCode={milling.closureCode}
            lotCode={milling.lot.code}
            equipmentName={milling.equipment.name}
            cookedKg={milling.cookedKg}
            finalMashLiters={
              milling.finalMashLiters
            }
            finalAverageBrix={
              milling.finalAverageBrix
            }
            finalAveragePh={
              milling.finalAveragePh
            }
            finalAverageTemp={
              milling.finalAverageTemp
            }
            finalBagasseKg={
              milling.finalBagasseKg
            }
            finalWaterLiters={
              milling.finalWaterLiters
            }
            finalPressPasses={
              milling.finalPressPasses
            }
            finalNotes={milling.finalNotes}
            startedAt={milling.startedAt}
            finishedAt={milling.finishedAt}
            finishedByName={
              milling.finishedBy?.name
            }
            dischargesCount={
              milling.discharges.length
            }
            tanksUsed={tanksUsed}
          />
        )}

        {!hasFinished && (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Descargas a fermentación
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Registra cada descarga de mosto con su
                tina destino y mediciones.
              </p>
            </div>

            <form
              action={addDischarge}
              className="grid gap-4 md:grid-cols-2"
            >
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Tina destino
                </span>

                <select
                  name="tankId"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-amber-400"
                >
                  <option value="">
                    Sin tina asignada
                  </option>

                  {tanks.map((tank) => (
                    <option
                      key={tank.id}
                      value={tank.id}
                    >
                      {tank.name}
                    </option>
                  ))}
                </select>
              </label>

              <NumberField
                name="litersRecovered"
                label="Litros recuperados"
                placeholder="Ej. 500"
                suffix="L"
                step="0.1"
                min="0.1"
                required
              />

              <NumberField
                name="brix"
                label="°Brix"
                placeholder="Ej. 13.5"
                step="0.1"
                min="0"
                required
              />

              <NumberField
                name="ph"
                label="pH"
                placeholder="Ej. 4.5"
                step="0.01"
                min="0"
                max="14"
                required
              />

              <NumberField
                name="temperature"
                label="Temperatura"
                placeholder="Ej. 29"
                suffix="°C"
                step="0.1"
                min="0"
                required
              />

              <label>
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Observaciones
                </span>

                <input
                  name="notes"
                  placeholder="Observación opcional"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
                />
              </label>

              <button
                type="submit"
                className="rounded-xl bg-amber-400 py-3 font-bold text-black transition hover:bg-amber-300 md:col-span-2"
              >
                Guardar descarga
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-6">
              <p className="mb-3 text-sm text-slate-400">
                Finaliza únicamente después de confirmar
                todas las descargas y resultados oficiales.
              </p>

              <FinishMillingModal
                lotCode={milling.lot.code}
                equipmentName={milling.equipment.name}
                cookedKg={milling.cookedKg}
                totalLiters={totalLiters}
                averageBrix={averageBrix}
                averagePh={averagePh}
                averageTemperature={
                  averageTemperature
                }
                currentBagasseKg={milling.bagasseKg}
                currentWaterLiters={
                  milling.waterLiters
                }
                currentPressPasses={
                  milling.pressPasses
                }
                dischargesCount={
                  milling.discharges.length
                }
                action={finishMilling}
              />
            </div>
          </section>
        )}

        <MillingCharts events={milling.events} />

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Descargas registradas
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Historial de mosto enviado a las tinas de
              fermentación.
            </p>
          </div>

          {milling.discharges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                Aún no hay descargas registradas.
              </p>
            </div>
          ) : (
            <div className="relative space-y-5 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-slate-700">
              {milling.discharges.map(
                (discharge, index) => (
                  <article
                    key={discharge.id}
                    className="relative pl-9"
                  >
                    <div
                      className={`absolute left-0 top-6 h-6 w-6 rounded-full border-4 border-slate-900 ${
                        index === 0
                          ? "bg-amber-400"
                          : "bg-slate-600"
                      }`}
                    />

                    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-amber-400">
                            {discharge.tank?.name ??
                              "Sin tina asignada"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Registrado por{" "}
                            {discharge.createdBy?.name ??
                              "Usuario no identificado"}
                          </p>
                        </div>

                        <p className="text-sm text-slate-400">
                          {formatDateTime(
                            discharge.createdAt
                          )}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Mini
                          title="Litros"
                          value={`${formatNumber(
                            discharge.litersRecovered
                          )} L`}
                        />

                        <Mini
                          title="°Brix"
                          value={formatNumber(
                            discharge.brix
                          )}
                        />

                        <Mini
                          title="pH"
                          value={formatNumber(
                            discharge.ph
                          )}
                        />

                        <Mini
                          title="Temperatura"
                          value={`${formatNumber(
                            discharge.temperature
                          )} °C`}
                        />
                      </div>

                      {discharge.notes && (
                        <div className="mt-4 rounded-xl bg-slate-900 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Observaciones
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-slate-300">
                            {discharge.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Bitácora de molienda
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Eventos generales registrados durante el
              proceso.
            </p>
          </div>

          {milling.events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                Aún no hay eventos registrados.
              </p>
            </div>
          ) : (
            <div className="relative space-y-5 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-slate-700">
              {[...milling.events]
                .reverse()
                .map((event, index) => (
                  <article
                    key={event.id}
                    className="relative pl-9"
                  >
                    <div
                      className={`absolute left-0 top-6 h-6 w-6 rounded-full border-4 border-slate-900 ${
                        index === 0
                          ? "bg-amber-400"
                          : "bg-slate-600"
                      }`}
                    />

                    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold text-amber-400">
                          {getMillingEventLabel(
                            event.type
                          )}
                        </p>

                        <p className="text-sm text-slate-400">
                          {formatDateTime(
                            event.createdAt
                          )}
                        </p>
                      </div>

                      {(event.brix !== null ||
                        event.ph !== null ||
                        event.temperature !== null ||
                        event.waterLiters !== null ||
                        event.bagasseKg !== null ||
                        event.pressPasses !== null) && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {event.brix !== null && (
                            <Mini
                              title="°Brix"
                              value={formatNumber(
                                event.brix
                              )}
                            />
                          )}

                          {event.ph !== null && (
                            <Mini
                              title="pH"
                              value={formatNumber(
                                event.ph
                              )}
                            />
                          )}

                          {event.temperature !==
                            null && (
                            <Mini
                              title="Temperatura"
                              value={`${formatNumber(
                                event.temperature
                              )} °C`}
                            />
                          )}

                          {event.waterLiters !==
                            null && (
                            <Mini
                              title="Agua"
                              value={`${formatNumber(
                                event.waterLiters
                              )} L`}
                            />
                          )}

                          {event.bagasseKg !== null && (
                            <Mini
                              title="Bagazo"
                              value={`${formatNumber(
                                event.bagasseKg
                              )} kg`}
                            />
                          )}

                          {event.pressPasses !==
                            null && (
                            <Mini
                              title="Pasadas"
                              value={event.pressPasses}
                            />
                          )}
                        </div>
                      )}

                      {event.notes && (
                        <div className="mt-4 rounded-xl bg-slate-900 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Observaciones
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-slate-300">
                            {event.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MillingClosureAct({
  closureCode,
  lotCode,
  equipmentName,
  cookedKg,
  finalMashLiters,
  finalAverageBrix,
  finalAveragePh,
  finalAverageTemp,
  finalBagasseKg,
  finalWaterLiters,
  finalPressPasses,
  finalNotes,
  startedAt,
  finishedAt,
  finishedByName,
  dischargesCount,
  tanksUsed,
}: {
  closureCode: string | null;
  lotCode: string;
  equipmentName: string;
  cookedKg: number;
  finalMashLiters: number | null;
  finalAverageBrix: number | null;
  finalAveragePh: number | null;
  finalAverageTemp: number | null;
  finalBagasseKg: number | null;
  finalWaterLiters: number | null;
  finalPressPasses: number | null;
  finalNotes: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  finishedByName: string | undefined;
  dischargesCount: number;
  tanksUsed: string[];
}) {
  const duration =
    finishedAt !== null
      ? formatDuration(startedAt, finishedAt)
      : "-";

  const recovery =
    finalMashLiters !== null && cookedKg > 0
      ? (finalMashLiters / cookedKg) * 100
      : null;

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-green-500/30 bg-slate-900">
      <header className="border-b border-green-500/20 bg-green-500/10 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-400">
          Acta de cierre
        </p>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Molienda terminada
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              El proceso quedó cerrado y bloqueado para
              nuevas descargas.
            </p>
          </div>

          <div className="w-fit rounded-full border border-green-500/40 bg-green-500/10 px-4 py-2 font-mono text-sm font-bold text-green-300">
            {closureCode ?? "Acta sin folio"}
          </div>
        </div>
      </header>

      <div className="p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActValue title="Lote" value={lotCode} />

          <ActValue
            title="Equipo"
            value={equipmentName}
          />

          <ActValue
            title="Kg cocidos"
            value={`${formatNumber(
              cookedKg,
              0
            )} kg`}
          />

          <ActValue
            title="Descargas"
            value={dischargesCount}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActValue
            title="Mosto final"
            value={
              finalMashLiters !== null
                ? `${formatNumber(
                    finalMashLiters
                  )} L`
                : "-"
            }
            highlight
          />

          <ActValue
            title="°Brix promedio"
            value={formatNumber(
              finalAverageBrix
            )}
            highlight
          />

          <ActValue
            title="pH promedio"
            value={formatNumber(finalAveragePh)}
          />

          <ActValue
            title="Temperatura promedio"
            value={
              finalAverageTemp !== null
                ? `${formatNumber(
                    finalAverageTemp
                  )} °C`
                : "-"
            }
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActValue
            title="Bagazo final"
            value={
              finalBagasseKg !== null
                ? `${formatNumber(
                    finalBagasseKg
                  )} kg`
                : "-"
            }
          />

          <ActValue
            title="Agua agregada"
            value={
              finalWaterLiters !== null
                ? `${formatNumber(
                    finalWaterLiters
                  )} L`
                : "-"
            }
          />

          <ActValue
            title="Pasadas de prensa"
            value={finalPressPasses ?? "-"}
          />

          <ActValue
            title="Recuperación"
            value={
              recovery !== null
                ? `${formatNumber(
                    recovery
                  )} L/100 kg`
                : "-"
            }
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ActValue
            title="Fecha de cierre"
            value={
              finishedAt
                ? formatDateTime(finishedAt)
                : "-"
            }
          />

          <ActValue
            title="Duración"
            value={duration}
          />

          <ActValue
            title="Cerrado por"
            value={
              finishedByName ??
              "Usuario no identificado"
            }
          />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tinas utilizadas
          </p>

          <p className="mt-2 text-slate-300">
            {tanksUsed.length > 0
              ? tanksUsed.join(", ")
              : "Sin tinas asignadas"}
          </p>
        </div>

        {finalNotes && (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Observaciones finales
            </p>

            <p className="mt-2 whitespace-pre-wrap text-slate-300">
              {finalNotes}
            </p>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
          <p className="font-bold text-amber-300">
            Siguiente etapa: Fermentación
          </p>

          <p className="mt-1 text-sm text-amber-100/70">
            El mosto quedó documentado y disponible
            para iniciar las fermentaciones
            correspondientes.
          </p>
        </div>
      </div>
    </section>
  );
}

function Kpi({
  title,
  value,
  detail,
  highlight = false,
}: {
  title: string;
  value: string | number;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">
        {title}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${
          highlight
            ? "text-green-400"
            : "text-white"
        }`}
      >
        {value}
      </p>

      {detail && (
        <p className="mt-2 text-xs text-slate-500">
          {detail}
        </p>
      )}
    </div>
  );
}

function SummaryMetric({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-slate-400">
        {title}
      </p>

      <p
        className={`mt-2 text-3xl font-bold ${
          highlight
            ? "text-white"
            : "text-slate-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Mini({
  title,
  value,
}: {
  title: string | number;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-slate-900 p-3">
      <p className="text-xs text-slate-400">
        {title}
      </p>

      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function ActValue({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {title}
      </p>

      <p
        className={`mt-2 font-bold ${
          highlight
            ? "text-green-400"
            : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ProcessIndicator({
  title,
  value,
  warning,
}: {
  title: string;
  value: string;
  warning: boolean;
}) {
  return (
    <div className="border-slate-800 p-5 sm:border-r sm:last:border-r-0">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {title}
      </p>

      <p
        className={`mt-1 font-bold ${
          warning
            ? "text-amber-400"
            : "text-green-400"
        }`}
      >
        {warning ? "● " : "✓ "}
        {value}
      </p>
    </div>
  );
}

function NumberField({
  name,
  label,
  placeholder,
  suffix,
  step,
  min,
  max,
  required = false,
}: {
  name: string;
  label: string;
  placeholder: string;
  suffix?: string;
  step: string;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </span>

      <div className="relative">
        <input
          name={name}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          required={required}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-400 ${
            suffix ? "pr-14" : ""
          }`}
        />

        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function MillingStatusBadge({
  status,
}: {
  status:
    | "ATENCION"
    | "ACTIVA"
    | "LISTA"
    | "TERMINADA";
}) {
  const styles = {
    ATENCION:
      "border-red-500/40 bg-red-500/10 text-red-400",
    ACTIVA:
      "border-amber-400/40 bg-amber-400/10 text-amber-300",
    LISTA:
      "border-green-500/40 bg-green-500/10 text-green-400",
    TERMINADA:
      "border-blue-500/40 bg-blue-500/10 text-blue-400",
  };

  return (
    <div
      className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${styles[status]}`}
    >
      {status === "ATENCION" &&
        "🔴 Requiere atención"}

      {status === "ACTIVA" &&
        "🟡 Molienda activa"}

      {status === "LISTA" &&
        "🟢 Lista para cerrar"}

      {status === "TERMINADA" &&
        "🔵 Molienda terminada"}
    </div>
  );
}

function getMillingHealth({
  hasFinished,
  dischargesCount,
  totalLiters,
  averageBrix,
  averagePh,
  averageTemperature,
}: {
  hasFinished: boolean;
  dischargesCount: number;
  totalLiters: number;
  averageBrix: number | null;
  averagePh: number | null;
  averageTemperature: number | null;
}):
  | "ATENCION"
  | "ACTIVA"
  | "LISTA"
  | "TERMINADA" {
  if (hasFinished) {
    return "TERMINADA";
  }

  if (
    averagePh !== null &&
    (averagePh < 3 || averagePh > 6)
  ) {
    return "ATENCION";
  }

  if (
    averageTemperature !== null &&
    averageTemperature > 40
  ) {
    return "ATENCION";
  }

  if (
    dischargesCount > 0 &&
    totalLiters > 0 &&
    averageBrix !== null &&
    averagePh !== null &&
    averageTemperature !== null
  ) {
    return "LISTA";
  }

  return "ACTIVA";
}

function getMillingHealthTitle(
  status:
    | "ATENCION"
    | "ACTIVA"
    | "LISTA"
    | "TERMINADA"
) {
  if (status === "ATENCION") {
    return "Revisar las condiciones del mosto";
  }

  if (status === "LISTA") {
    return "La molienda tiene datos suficientes para cerrar";
  }

  if (status === "TERMINADA") {
    return "Proceso de molienda terminado";
  }

  return "La molienda continúa activa";
}

function buildMillingMessages({
  hasFinished,
  totalLiters,
  dischargesCount,
  averageBrix,
  averagePh,
  averageTemperature,
  tanksUsed,
}: {
  hasFinished: boolean;
  totalLiters: number;
  dischargesCount: number;
  averageBrix: number | null;
  averagePh: number | null;
  averageTemperature: number | null;
  tanksUsed: string[];
}) {
  const messages: string[] = [];

  if (hasFinished) {
    messages.push(
      "La molienda está cerrada y su expediente permanece disponible para consulta."
    );

    return messages;
  }

  if (dischargesCount === 0) {
    messages.push(
      "Todavía no existen descargas registradas hacia fermentación."
    );
  } else {
    messages.push(
      `Se han registrado ${dischargesCount} descargas con un total de ${formatNumber(
        totalLiters
      )} litros de mosto.`
    );
  }

  if (averageBrix !== null) {
    messages.push(
      `El °Brix promedio ponderado es de ${formatNumber(
        averageBrix
      )}.`
    );
  }

  if (averagePh !== null) {
    if (averagePh < 3 || averagePh > 6) {
      messages.push(
        `El pH promedio es de ${formatNumber(
          averagePh
        )} y conviene verificar las mediciones antes de iniciar fermentación.`
      );
    } else {
      messages.push(
        `El pH promedio se encuentra en ${formatNumber(
          averagePh
        )}.`
      );
    }
  }

  if (averageTemperature !== null) {
    messages.push(
      `La temperatura promedio del mosto es de ${formatNumber(
        averageTemperature
      )} °C.`
    );
  }

  if (tanksUsed.length > 0) {
    messages.push(
      `El mosto fue distribuido en: ${tanksUsed.join(
        ", "
      )}.`
    );
  }

  return messages;
}

async function createMillingClosureCode(
  date: Date
) {
  const year = date.getFullYear();

  const startOfYear = new Date(year, 0, 1);
  const startOfNextYear = new Date(
    year + 1,
    0,
    1
  );

  const closuresThisYear =
    await prisma.milling.count({
      where: {
        closureCode: {
          not: null,
        },
        finishedAt: {
          gte: startOfYear,
          lt: startOfNextYear,
        },
      },
    });

  const consecutive = String(
    closuresThisYear + 1
  ).padStart(6, "0");

  return `ACTA-MOL-${year}-${consecutive}`;
}

function parseRequiredNumber(
  value: FormDataEntryValue | null
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function parseOptionalNumber(
  value: FormDataEntryValue | null
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function parseOptionalInteger(
  value: FormDataEntryValue | null
) {
  const number = parseOptionalNumber(value);

  if (number === null) {
    return null;
  }

  return Math.round(number);
}

function getMillingEventLabel(
  type: MillingEventType
) {
  const labels: Record<
    MillingEventType,
    string
  > = {
    INICIO_MOLIENDA: "▶️ Inicio de molienda",
    REGISTRO_BRIX: "🍬 Registro de °Brix",
    REGISTRO_PH: "🧪 Registro de pH",
    REGISTRO_TEMPERATURA:
      "🌡️ Registro de temperatura",
    AGREGAR_AGUA: "💧 Agua agregada",
    CAMBIO_PRENSA: "⚙️ Cambio de prensa",
    LAVADO_BAGAZO: "🚿 Lavado de bagazo",
    REGISTRO_BAGAZO: "🌿 Registro de bagazo",
    FIN_MOLIENDA: "🏁 Cierre de molienda",
    OBSERVACION: "📝 Observación",
  };

  return labels[type];
}

function formatNumber(
  value: number | string | null | undefined,
  maximumFractionDigits = 2
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(number);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(
  start: Date,
  end: Date
) {
  const milliseconds = Math.max(
    0,
    end.getTime() - start.getTime()
  );

  const totalMinutes = Math.floor(
    milliseconds / 1000 / 60
  );

  const days = Math.floor(totalMinutes / 1440);

  const hours = Math.floor(
    (totalMinutes % 1440) / 60
  );

  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} d`);
  }

  if (hours > 0) {
    parts.push(`${hours} h`);
  }

  parts.push(`${minutes} min`);

  return parts.join(" ");
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) =>
      letter.toUpperCase()
    );
}