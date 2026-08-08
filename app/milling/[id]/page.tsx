import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import MillingCharts from "@/components/MillingCharts";
import FinishMillingModal from "@/components/FinishMillingModal";
import {
  EquipmentStatus,
  LotStage,
  MillingEventType,
  MillingStatus,
} from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { advanceLotStage } from "@/lib/lotStage";
import PageTabs from "@/components/ui/PageTabs";
import {
  ClipboardIcon,
  HomeIcon,
  ChartLineIcon,
  BookIcon,
} from "@/components/ui/icons";

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

  const millingEquipmentId = milling.equipmentId;
  const millingLotId = milling.lotId;

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

        await transaction.equipment.update({
          where: { id: millingEquipmentId },
          data: {
            status: EquipmentStatus.DISPONIBLE,
            currentLoad: 0,
          },
        });

        await advanceLotStage(
          transaction,
          millingLotId,
          LotStage.FERMENTACION
        );

        return updated;
      }
    );

    if (result.count === 0) {
      redirect(`/milling/${id}`);
    }

    redirect(`/milling/${id}`);
  }

  const homeTabContent = (
    <>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <section className="mt-6 overflow-hidden rounded-2xl border border-on-surface-variant/20 bg-on-surface-variant/10">
          <div className="p-6 sm:p-8">
            <p className="font-mono text-sm uppercase tracking-[0.35em] text-on-surface-variant">
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

          <div className="grid border-t border-on-surface-variant/10 sm:grid-cols-3">
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
              ? "border-error/30 bg-error/10"
              : millingHealth === "TERMINADA"
                ? "border-on-surface-variant/30 bg-on-surface-variant/10"
                : millingHealth === "LISTA"
                  ? "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10"
                  : "border-secondary/30 bg-secondary/10"
          }`}
        >
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
            Análisis de MAESTRO
          </p>

          <h2
            className={`mt-3 text-2xl font-bold sm:text-3xl ${
              millingHealth === "ATENCION"
                ? "text-error"
                : millingHealth === "TERMINADA"
                  ? "text-on-surface-variant"
                  : millingHealth === "LISTA"
                    ? "text-tertiary-fixed-dim"
                    : "text-secondary"
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
                className="flex items-start gap-3 rounded-xl bg-surface-dim/40 p-3"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant" />

                <p className="text-on-surface">
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
    </>
  );

  const registrarTabContent = (
    <>
        {!hasFinished && (
          <section className="rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Descargas a fermentación
              </h2>

              <p className="mt-2 text-sm text-on-surface-variant">
                Registra cada descarga de mosto con su
                tina destino y mediciones.
              </p>
            </div>

            <form
              action={addDischarge}
              className="grid gap-4 md:grid-cols-2"
            >
              <label>
                <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Tina destino
                </span>

                <select
                  name="tankId"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
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
                <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Observaciones
                </span>

                <input
                  name="notes"
                  placeholder="Observación opcional"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                />
              </label>

              <button
                type="submit"
                className="rounded-xl bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] md:col-span-2"
              >
                Guardar descarga
              </button>
            </form>

            <div className="mt-6 border-t border-outline-variant pt-6">
              <p className="mb-3 text-sm text-on-surface-variant">
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
            {hasFinished && (
          <section className="rounded-2xl border border-outline-variant bg-surface-container p-8 text-center">
            <h2 className="text-xl font-bold text-on-surface">
              Esta etapa ya está cerrada
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
              Ya no se pueden registrar más datos. Consulta lo capturado en las
              pestañas Home, Gráficas y Bitácora.
            </p>
          </section>
        )}
    </>
  );

  const graficasTabContent = (
    <MillingCharts events={milling.events} />
  );

  const bitacoraTabContent = (
    <>
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Descargas registradas
            </h2>

            <p className="mt-2 text-sm text-on-surface-variant">
              Historial de mosto enviado a las tinas de
              fermentación.
            </p>
          </div>

          {milling.discharges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center">
              <p className="text-on-surface-variant">
                Aún no hay descargas registradas.
              </p>
            </div>
          ) : (
            <div className="relative space-y-5 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-surface-container-highest">
              {milling.discharges.map(
                (discharge, index) => (
                  <article
                    key={discharge.id}
                    className="relative pl-9"
                  >
                    <div
                      className={`absolute left-0 top-6 h-6 w-6 rounded-full border-4 border-outline-variant ${
                        index === 0
                          ? "bg-primary"
                          : "bg-surface-container-highest"
                      }`}
                    />

                    <div className="rounded-2xl border border-outline-variant bg-surface-container-high p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-primary">
                            {discharge.tank?.name ??
                              "Sin tina asignada"}
                          </p>

                          <p className="mt-1 text-xs text-outline">
                            Registrado por{" "}
                            {discharge.createdBy?.name ??
                              "Usuario no identificado"}
                          </p>
                        </div>

                        <p className="text-sm text-on-surface-variant">
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
                        <div className="mt-4 rounded-xl bg-surface-container p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-outline">
                            Observaciones
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-on-surface-variant">
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

        <section className="mt-8 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Bitácora de molienda
            </h2>

            <p className="mt-2 text-sm text-on-surface-variant">
              Eventos generales registrados durante el
              proceso.
            </p>
          </div>

          {milling.events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center">
              <p className="text-on-surface-variant">
                Aún no hay eventos registrados.
              </p>
            </div>
          ) : (
            <div className="relative space-y-5 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-surface-container-highest">
              {[...milling.events]
                .reverse()
                .map((event, index) => (
                  <article
                    key={event.id}
                    className="relative pl-9"
                  >
                    <div
                      className={`absolute left-0 top-6 h-6 w-6 rounded-full border-4 border-outline-variant ${
                        index === 0
                          ? "bg-primary"
                          : "bg-surface-container-highest"
                      }`}
                    />

                    <div className="rounded-2xl border border-outline-variant bg-surface-container-high p-5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold text-primary">
                          {getMillingEventLabel(
                            event.type
                          )}
                        </p>

                        <p className="text-sm text-on-surface-variant">
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
                        <div className="mt-4 rounded-xl bg-surface-container p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-outline">
                            Observaciones
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-on-surface-variant">
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
    </>
  );

  const tabs = [
    {
      key: "home",
      label: "Home",
      icon: <HomeIcon className="h-4 w-4" />,
      content: homeTabContent,
    },
    {
      key: "registrar",
      label: "Registrar datos",
      icon: <ClipboardIcon className="h-4 w-4" />,
      content: registrarTabContent,
    },
    {
      key: "graficas",
      label: "Gráficas",
      icon: <ChartLineIcon className="h-4 w-4" />,
      content: graficasTabContent,
    },
    {
      key: "bitacora",
      label: "Bitácora",
      icon: <BookIcon className="h-4 w-4" />,
      content: bitacoraTabContent,
    },
  ];

  return (
    <main className="min-h-screen bg-background p-4 text-on-surface sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mt-8">
          <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
            MAESTRO
          </p>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">
                Molienda {milling.lot.code}
              </h1>

              <p className="mt-2 text-sm text-on-surface-variant">
                {milling.equipment.name} · Inicio{" "}
                {formatDateTime(milling.startedAt)}
              </p>
            </div>

            <MillingStatusBadge status={millingHealth} />
          </div>
        </header>

        <div className="mt-8">
          <PageTabs tabs={tabs} />
        </div>
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
    <section className="mt-8 overflow-hidden rounded-3xl border border-tertiary-fixed-dim/30 bg-surface-container">
      <header className="border-b border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 p-6 sm:p-8">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-tertiary-fixed-dim">
          Acta de cierre
        </p>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-on-surface sm:text-3xl">
              Molienda terminada
            </h2>

            <p className="mt-2 text-sm text-on-surface-variant">
              El proceso quedó cerrado y bloqueado para
              nuevas descargas.
            </p>
          </div>

          <div className="w-fit rounded-full border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 px-4 py-2 font-mono text-sm font-bold text-tertiary-fixed-dim">
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

        <div className="mt-4 rounded-2xl border border-outline-variant bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-outline">
            Tinas utilizadas
          </p>

          <p className="mt-2 text-on-surface-variant">
            {tanksUsed.length > 0
              ? tanksUsed.join(", ")
              : "Sin tinas asignadas"}
          </p>
        </div>

        {finalNotes && (
          <div className="mt-4 rounded-2xl border border-outline-variant bg-background p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-outline">
              Observaciones finales
            </p>

            <p className="mt-2 whitespace-pre-wrap text-on-surface-variant">
              {finalNotes}
            </p>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-outline-variant bg-surface-container-high/60 p-5">
          <p className="font-bold text-primary">
            Siguiente etapa: Fermentación
          </p>

          <p className="mt-1 text-sm text-on-surface-variant">
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
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <p className="text-sm text-on-surface-variant">
        {title}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${
          highlight
            ? "text-tertiary-fixed-dim"
            : "text-on-surface"
        }`}
      >
        {value}
      </p>

      {detail && (
        <p className="mt-2 text-xs text-outline">
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
      <p className="text-sm text-on-surface-variant">
        {title}
      </p>

      <p
        className={`mt-2 text-3xl font-bold ${
          highlight
            ? "text-on-surface"
            : "text-on-surface"
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
    <div className="rounded-xl bg-surface-container p-3">
      <p className="text-xs text-on-surface-variant">
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
    <div className="rounded-2xl border border-outline-variant bg-background p-4">
      <p className="text-xs uppercase tracking-wider text-outline">
        {title}
      </p>

      <p
        className={`mt-2 font-bold ${
          highlight
            ? "text-tertiary-fixed-dim"
            : "text-on-surface"
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
    <div className="border-outline-variant p-5 sm:border-r sm:last:border-r-0">
      <p className="text-xs uppercase tracking-wider text-outline">
        {title}
      </p>

      <p
        className={`mt-1 font-bold ${
          warning
            ? "text-secondary"
            : "text-tertiary-fixed-dim"
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
      <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
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
          className={`w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary ${
            suffix ? "pr-14" : ""
          }`}
        />

        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-outline">
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
      "border-error/40 bg-error/10 text-error",
    ACTIVA:
      "border-secondary/40 bg-secondary/10 text-secondary",
    LISTA:
      "border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim",
    TERMINADA:
      "border-on-surface-variant/40 bg-on-surface-variant/10 text-on-surface-variant",
  };

  const dotStyles: Record<
    | "ATENCION"
    | "ACTIVA"
    | "LISTA"
    | "TERMINADA",
    string
  > = {
    ATENCION: "bg-error",
    ACTIVA: "bg-secondary",
    LISTA: "bg-tertiary-fixed-dim",
    TERMINADA: "bg-on-surface-variant",
  };

  return (
    <div
      className={`flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${styles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotStyles[status]}`}
      />

      {status === "ATENCION" &&
        "Requiere atención"}

      {status === "ACTIVA" &&
        "Molienda activa"}

      {status === "LISTA" &&
        "Lista para cerrar"}

      {status === "TERMINADA" &&
        "Molienda terminada"}
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
    INICIO_MOLIENDA: "Inicio de molienda",
    REGISTRO_BRIX: "Registro de °Brix",
    REGISTRO_PH: "Registro de pH",
    REGISTRO_TEMPERATURA:
      "Registro de temperatura",
    AGREGAR_AGUA: "Agua agregada",
    CAMBIO_PRENSA: "Cambio de prensa",
    LAVADO_BAGAZO: "Lavado de bagazo",
    REGISTRO_BAGAZO: "Registro de bagazo",
    FIN_MOLIENDA: "Cierre de molienda",
    OBSERVACION: "Observación",
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