import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import FinishDistillationModal from "@/components/FinishDistillationModal";
import DistillationTimeline from "@/components/DistillationTimeline";
import DistillationCharts from "@/components/DistillationCharts";
import {
  DistillationEventType,
  DistillationStatus,
} from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import {
  getCurrentAlcohol,
  getCurrentTemperature,
  getTotalLiters,
  getHeartLiters,
  getHeadsLiters,
  getTailLiters,
  getCorrectedAlcohol,
  getAbsoluteAlcohol,
  getYield,
  getDistillationStatus,
} from "@/lib/services/distillation";
import { getMasterAdvice } from "@/lib/services/maestroDistillation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DistillationDetailPage({
  params,
}: Props) {
  const { id } = await params;

  const distillation = await prisma.distillation.findUnique({
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
    },
  });

  if (!distillation) notFound();

  const hasFinished =
    distillation.status === DistillationStatus.TERMINADA;

  const lastTemperature = getCurrentTemperature(
    distillation.events
  );

  const lastOutputTemperature =
    [...distillation.events]
      .reverse()
      .find(
        (event) => event.outputTemperature !== null
      )?.outputTemperature ?? null;

  const lastAlcohol = getCurrentAlcohol(
    distillation.events
  );

  const lastRegisteredCorrectedAlcohol =
    [...distillation.events]
      .reverse()
      .find(
        (event) => event.alcoholCorrected !== null
      )?.alcoholCorrected ?? null;

  const calculatedCorrectedAlcohol =
    getCorrectedAlcohol(
      lastAlcohol,
      lastOutputTemperature
    );

  const lastAlcoholCorrected =
    lastRegisteredCorrectedAlcohol ??
    calculatedCorrectedAlcohol;

  const totalLiters = getTotalLiters(
    distillation.events
  );

  const headsLiters = getHeadsLiters(
    distillation.events
  );

  const heartLiters = getHeartLiters(
    distillation.events
  );

  const tailLiters = getTailLiters(
    distillation.events
  );

  const absoluteAlcohol = getAbsoluteAlcohol(
    totalLiters,
    lastAlcoholCorrected
  );

  const distillationYield = getYield(
    distillation.loadedLiters,
    totalLiters
  );

  const processStatus = hasFinished
    ? "TERMINADA"
    : getDistillationStatus(
        distillation.events
      );

  const advice = getMasterAdvice(
    lastTemperature,
    lastAlcohol,
    lastAlcoholCorrected,
    distillation.events
  );

  async function addEvent(formData: FormData) {
    "use server";

    const currentDistillation =
      await prisma.distillation.findUnique({
        where: { id },
        select: {
          status: true,
          closureCode: true,
        },
      });

    if (
      !currentDistillation ||
      currentDistillation.status ===
        DistillationStatus.TERMINADA ||
      currentDistillation.closureCode
    ) {
      redirect(`/distillation/${id}`);
    }

    const typeValue = formData.get("type");

    if (
      typeof typeValue !== "string" ||
      !isDistillationEventType(typeValue)
    ) {
      redirect(`/distillation/${id}`);
    }

    const type =
      typeValue as DistillationEventType;

    /*
     * FIN_DESTILACION ya no puede guardarse desde
     * el formulario normal. El cierre se realiza
     * exclusivamente mediante el Acta de Cierre.
     */
    if (
      type ===
      DistillationEventType.FIN_DESTILACION
    ) {
      redirect(`/distillation/${id}`);
    }

    const temperature = parseOptionalNumber(
      formData.get("temperature")
    );

    const outputTemperature =
      parseOptionalNumber(
        formData.get("outputTemperature")
      );

    const alcohol = parseOptionalNumber(
      formData.get("alcohol")
    );

    const alcoholCorrected =
      parseOptionalNumber(
        formData.get("alcoholCorrected")
      );

    const liters = parseOptionalNumber(
      formData.get("liters")
    );

    const notesValue = formData.get("notes");

    const notes =
      typeof notesValue === "string" &&
      notesValue.trim()
        ? notesValue.trim()
        : null;

    const hasInformation =
      temperature !== null ||
      outputTemperature !== null ||
      alcohol !== null ||
      alcoholCorrected !== null ||
      liters !== null ||
      notes !== null ||
      isActionOnlyEvent(type);

    if (!hasInformation) {
      redirect(`/distillation/${id}`);
    }

    if (
      temperature !== null &&
      temperature < 0
    ) {
      redirect(`/distillation/${id}`);
    }

    if (
      outputTemperature !== null &&
      outputTemperature < 0
    ) {
      redirect(`/distillation/${id}`);
    }

    if (
      alcohol !== null &&
      (alcohol < 0 || alcohol > 100)
    ) {
      redirect(`/distillation/${id}`);
    }

    if (
      alcoholCorrected !== null &&
      (alcoholCorrected < 0 ||
        alcoholCorrected > 100)
    ) {
      redirect(`/distillation/${id}`);
    }

    if (liters !== null && liters < 0) {
      redirect(`/distillation/${id}`);
    }

    await prisma.distillationEvent.create({
      data: {
        distillationId: id,
        type,
        temperature,
        outputTemperature,
        alcohol,
        alcoholCorrected,
        liters,
        notes,
      },
    });

    redirect(`/distillation/${id}`);
  }

  async function finishDistillation(
    formData: FormData
  ) {
    "use server";

    const user = await getCurrentUser();

    if (!user) {
      redirect("/login");
    }

    const finalLiters = parseRequiredNumber(
      formData.get("finalLiters")
    );

    const finalAlcohol =
      parseRequiredNumber(
        formData.get("finalAlcohol")
      );

    const finalNotesValue =
      formData.get("finalNotes");

    const finalNotes =
      typeof finalNotesValue === "string" &&
      finalNotesValue.trim()
        ? finalNotesValue.trim()
        : null;

    if (
      finalLiters === null ||
      finalAlcohol === null
    ) {
      redirect(`/distillation/${id}`);
    }

    if (
      finalLiters < 0 ||
      finalAlcohol < 0 ||
      finalAlcohol > 100
    ) {
      redirect(`/distillation/${id}`);
    }

    const currentDistillation =
      await prisma.distillation.findUnique({
        where: { id },
        include: {
          events: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

    if (!currentDistillation) {
      notFound();
    }

    if (
      currentDistillation.status ===
        DistillationStatus.TERMINADA ||
      currentDistillation.closureCode
    ) {
      redirect(`/distillation/${id}`);
    }

    const officialHeadsLiters =
      getHeadsLiters(
        currentDistillation.events
      );

    const officialHeartLiters =
      getHeartLiters(
        currentDistillation.events
      );

    const officialTailLiters =
      getTailLiters(
        currentDistillation.events
      );

    const finishedAt = new Date();

    const closureCode =
      await createDistillationClosureCode(
        finishedAt
      );

    const result = await prisma.$transaction(
      async (transaction) => {
        const updated =
          await transaction.distillation.updateMany({
            where: {
              id,
              status:
                DistillationStatus.ACTIVA,
              closureCode: null,
            },
            data: {
              status:
                DistillationStatus.TERMINADA,
              finishedAt,
              finalAlcohol,
              finalLiters,
              finalHeadsLiters:
                officialHeadsLiters,
              finalHeartLiters:
                officialHeartLiters,
              finalTailsLiters:
                officialTailLiters,
              finalNotes,
              closureCode,
              finishedById: user.id,
            },
          });

        if (updated.count === 0) {
          return updated;
        }

        await transaction.distillationEvent.create({
          data: {
            distillationId: id,
            type: DistillationEventType.FIN_DESTILACION,
            liters: finalLiters,
            alcoholCorrected: finalAlcohol,
            notes:
              finalNotes ??
              `Destilación cerrada mediante ${closureCode}.`,
          },
        });

        return updated;
      }
    );

    if (result.count === 0) {
      redirect(`/distillation/${id}`);
    }

    redirect(`/distillation/${id}`);
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
                Destilación{" "}
                {distillation.lot.code}
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                {distillation.equipment.name} ·{" "}
                {formatDistillationType(
                  distillation.type
                )}{" "}
                · Inicio{" "}
                {formatDateTime(
                  distillation.startedAt
                )}
              </p>
            </div>

            <DistillationStatusBadge
              finished={hasFinished}
              processStatus={processStatus}
            />
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
            MAESTRO INTELIGENTE
          </p>

          <h2
            className={`mt-3 text-2xl font-bold sm:text-3xl ${advice.color}`}
          >
            {hasFinished
              ? "Proceso de destilación terminado"
              : advice.title}
          </h2>

          <p className="mt-2 text-slate-300">
            {hasFinished
              ? "La destilación quedó cerrada y su expediente permanece disponible para consulta."
              : advice.message}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Mini
              title="Alcohol actual"
              value={
                lastAlcohol !== null &&
                lastAlcohol !== undefined
                  ? `${formatNumber(
                      lastAlcohol
                    )} %`
                  : "-"
              }
            />

            <Mini
              title="Alcohol corregido"
              value={
                lastAlcoholCorrected !== null &&
                lastAlcoholCorrected !==
                  undefined
                  ? `${formatNumber(
                      lastAlcoholCorrected
                    )} %`
                  : "-"
              }
            />

            <Mini
              title="Temperatura"
              value={
                lastTemperature !== null &&
                lastTemperature !== undefined
                  ? `${formatNumber(
                      lastTemperature
                    )} °C`
                  : "-"
              }
            />
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            title="Alambique"
            value={distillation.equipment.name}
            detail="Equipo asignado"
          />

          <Card
            title="Tipo"
            value={formatDistillationType(
              distillation.type
            )}
            detail="Etapa de destilación"
          />

          <Card
            title="Cargado"
            value={`${formatNumber(
              distillation.loadedLiters
            )} L`}
            detail="Volumen inicial"
          />

          <Card
            title="Estado"
            value={formatStatus(
              distillation.status
            )}
            detail={
              hasFinished
                ? "Proceso cerrado"
                : processStatus
            }
            highlight={!hasFinished}
          />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            title="Temp. alambique"
            value={
              lastTemperature !== null &&
              lastTemperature !== undefined
                ? `${formatNumber(
                    lastTemperature
                  )} °C`
                : "-"
            }
          />

          <Card
            title="Temp. salida"
            value={
              lastOutputTemperature !== null
                ? `${formatNumber(
                    lastOutputTemperature
                  )} °C`
                : "-"
            }
          />

          <Card
            title="Alcohol leído"
            value={
              lastAlcohol !== null &&
              lastAlcohol !== undefined
                ? `${formatNumber(
                    lastAlcohol
                  )} %`
                : "-"
            }
          />

          <Card
            title="Alcohol corregido"
            value={
              lastAlcoholCorrected !== null &&
              lastAlcoholCorrected !==
                undefined
                ? `${formatNumber(
                    lastAlcoholCorrected
                  )} %`
                : "-"
            }
            highlight
          />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            title="Litros acumulados"
            value={`${formatNumber(
              totalLiters
            )} L`}
          />

          <Card
            title="Alcohol absoluto"
            value={
              absoluteAlcohol !== null
                ? `${formatNumber(
                    absoluteAlcohol
                  )} LAA`
                : "-"
            }
          />

          <Card
            title="Rendimiento"
            value={`${formatNumber(
              distillationYield
            )} %`}
          />

          <Card
            title="Eventos"
            value={distillation.events.length}
          />

          <Card
            title="Cabezas"
            value={`${formatNumber(
              headsLiters
            )} L`}
          />

          <Card
            title="Corazón"
            value={`${formatNumber(
              heartLiters
            )} L`}
            highlight
          />

          <Card
            title="Colas"
            value={`${formatNumber(
              tailLiters
            )} L`}
          />

          <Card
            title="Alcohol inicial"
            value={
              distillation.initialAlcohol !==
              null
                ? `${formatNumber(
                    distillation.initialAlcohol
                  )} %`
                : "-"
            }
          />
        </section>

        {hasFinished && (
          <DistillationClosureAct
            closureCode={
              distillation.closureCode
            }
            lotCode={distillation.lot.code}
            equipmentName={
              distillation.equipment.name
            }
            type={distillation.type}
            loadedLiters={
              distillation.loadedLiters
            }
            initialAlcohol={
              distillation.initialAlcohol
            }
            finalLiters={
              distillation.finalLiters
            }
            finalAlcohol={
              distillation.finalAlcohol
            }
            finalHeadsLiters={
              distillation.finalHeadsLiters
            }
            finalHeartLiters={
              distillation.finalHeartLiters
            }
            finalTailsLiters={
              distillation.finalTailsLiters
            }
            finalNotes={
              distillation.finalNotes
            }
            startedAt={
              distillation.startedAt
            }
            finishedAt={
              distillation.finishedAt
            }
            finishedByName={
              distillation.finishedBy?.name
            }
            eventsCount={
              distillation.events.length
            }
          />
        )}

        {!hasFinished && (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Acciones de destilación
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Registra las lecturas y los cambios
                de corte conforme avanza el proceso.
              </p>
            </div>

            <form
              action={addEvent}
              className="rounded-2xl border border-slate-700 bg-slate-800 p-5 sm:p-6"
            >
              <p className="mb-4 text-xl font-bold">
                Registro de destilación
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-300">
                    Tipo de registro
                  </span>

                  <select
                    name="type"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-amber-400"
                  >
                    <option value="">
                      Selecciona una acción
                    </option>

                    <option value="INICIO_CALENTAMIENTO">
                      Inicio de calentamiento
                    </option>

                    <option value="TEMPERATURA">
                      Temperatura
                    </option>

                    <option value="ALCOHOL">
                      Alcohol
                    </option>

                    <option value="LITROS">
                      Registrar litros
                    </option>

                    <option value="CORTE_CABEZAS">
                      Corte de cabezas
                    </option>

                    <option value="INICIO_CORAZON">
                      Inicio de corazón
                    </option>

                    <option value="FIN_CORAZON">
                      Fin de corazón
                    </option>

                    <option value="INICIO_COLAS">
                      Inicio de colas
                    </option>

                    <option value="OBSERVACION">
                      Observación
                    </option>
                  </select>
                </label>

                <NumberField
                  name="temperature"
                  label="Temperatura del alambique"
                  placeholder="Ej. 92"
                  suffix="°C"
                  step="0.01"
                  min="0"
                />

                <NumberField
                  name="outputTemperature"
                  label="Temperatura de salida"
                  placeholder="Ej. 20"
                  suffix="°C"
                  step="0.01"
                  min="0"
                />

                <NumberField
                  name="alcohol"
                  label="Alcohol leído"
                  placeholder="Ej. 55"
                  suffix="%"
                  step="0.01"
                  min="0"
                  max="100"
                />

                <NumberField
                  name="alcoholCorrected"
                  label="Alcohol corregido"
                  placeholder="Ej. 54.7"
                  suffix="%"
                  step="0.01"
                  min="0"
                  max="100"
                />

                <NumberField
                  name="liters"
                  label="Litros obtenidos"
                  placeholder="Ej. 40"
                  suffix="L"
                  step="0.01"
                  min="0"
                />

                <label className="md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-300">
                    Observaciones
                  </span>

                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Describe el comportamiento, aroma, flujo, corte realizado o cualquier detalle importante."
                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="mt-5 w-full rounded-xl bg-amber-400 py-3 font-bold text-black transition hover:bg-amber-300"
              >
                Guardar registro
              </button>
            </form>

            <div className="mt-6 border-t border-slate-700 pt-6">
              <p className="mb-3 text-sm text-slate-400">
                Finaliza únicamente después de
                confirmar el volumen y alcohol
                oficiales.
              </p>

              <FinishDistillationModal
                onConfirm={finishDistillation}
              />
            </div>
          </section>
        )}

        {/* Las gráficas quedan antes de la bitácora */}
        <DistillationCharts
          events={distillation.events}
        />

        <DistillationTimeline
          events={distillation.events}
        />
      </div>
    </main>
  );
}

function DistillationClosureAct({
  closureCode,
  lotCode,
  equipmentName,
  type,
  loadedLiters,
  initialAlcohol,
  finalLiters,
  finalAlcohol,
  finalHeadsLiters,
  finalHeartLiters,
  finalTailsLiters,
  finalNotes,
  startedAt,
  finishedAt,
  finishedByName,
  eventsCount,
}: {
  closureCode: string | null;
  lotCode: string;
  equipmentName: string;
  type: string;
  loadedLiters: number;
  initialAlcohol: number | null;
  finalLiters: number | null;
  finalAlcohol: number | null;
  finalHeadsLiters: number | null;
  finalHeartLiters: number | null;
  finalTailsLiters: number | null;
  finalNotes: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  finishedByName: string | undefined;
  eventsCount: number;
}) {
  const duration =
    finishedAt !== null
      ? formatDuration(
          startedAt,
          finishedAt
        )
      : "-";

  const absoluteAlcohol =
    finalLiters !== null &&
    finalAlcohol !== null
      ? (finalLiters * finalAlcohol) / 100
      : null;

  const yieldPercentage =
    finalLiters !== null &&
    loadedLiters > 0
      ? (finalLiters / loadedLiters) * 100
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
              Destilación terminada
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              El proceso quedó cerrado y bloqueado
              para nuevos registros.
            </p>
          </div>

          <div className="w-fit rounded-full border border-green-500/40 bg-green-500/10 px-4 py-2 font-mono text-sm font-bold text-green-300">
            {closureCode ??
              "Acta sin folio"}
          </div>
        </div>
      </header>

      <div className="p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActValue
            title="Lote"
            value={lotCode}
          />

          <ActValue
            title="Alambique"
            value={equipmentName}
          />

          <ActValue
            title="Tipo"
            value={formatDistillationType(
              type
            )}
          />

          <ActValue
            title="Eventos"
            value={eventsCount}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActValue
            title="Carga inicial"
            value={`${formatNumber(
              loadedLiters
            )} L`}
          />

          <ActValue
            title="Alcohol inicial"
            value={
              initialAlcohol !== null
                ? `${formatNumber(
                    initialAlcohol
                  )} %`
                : "-"
            }
          />

          <ActValue
            title="Litros finales"
            value={
              finalLiters !== null
                ? `${formatNumber(
                    finalLiters
                  )} L`
                : "-"
            }
            highlight
          />

          <ActValue
            title="Alcohol final"
            value={
              finalAlcohol !== null
                ? `${formatNumber(
                    finalAlcohol
                  )} %`
                : "-"
            }
            highlight
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActValue
            title="Cabezas"
            value={`${formatNumber(
              finalHeadsLiters
            )} L`}
          />

          <ActValue
            title="Corazón"
            value={`${formatNumber(
              finalHeartLiters
            )} L`}
            highlight
          />

          <ActValue
            title="Colas"
            value={`${formatNumber(
              finalTailsLiters
            )} L`}
          />

          <ActValue
            title="Alcohol absoluto"
            value={
              absoluteAlcohol !== null
                ? `${formatNumber(
                    absoluteAlcohol
                  )} LAA`
                : "-"
            }
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActValue
            title="Rendimiento volumétrico"
            value={
              yieldPercentage !== null
                ? `${formatNumber(
                    yieldPercentage
                  )} %`
                : "-"
            }
          />

          <ActValue
            title="Fecha de cierre"
            value={
              finishedAt
                ? formatDateTime(
                    finishedAt
                  )
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
            Expediente de destilación cerrado
          </p>

          <p className="mt-1 text-sm text-amber-100/70">
            Los resultados finales quedaron
            registrados en el historial del lote.
          </p>
        </div>
      </div>
    </section>
  );
}

function Card({
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

function Mini({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-slate-950 p-3">
      <p className="text-xs text-slate-500">
        {title}
      </p>

      <p className="mt-1 font-bold text-white">
        {value}
      </p>
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

function NumberField({
  name,
  label,
  placeholder,
  suffix,
  step,
  min,
  max,
}: {
  name: string;
  label: string;
  placeholder: string;
  suffix?: string;
  step: string;
  min?: string;
  max?: string;
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
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-400 ${
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

function DistillationStatusBadge({
  finished,
  processStatus,
}: {
  finished: boolean;
  processStatus: string;
}) {
  if (finished) {
    return (
      <div className="w-fit rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-400">
        🔵 Destilación terminada
      </div>
    );
  }

  return (
    <div className="w-fit rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-300">
      🟡 {processStatus}
    </div>
  );
}

async function createDistillationClosureCode(
  date: Date
) {
  const year = date.getFullYear();

  const startOfYear = new Date(
    year,
    0,
    1
  );

  const startOfNextYear = new Date(
    year + 1,
    0,
    1
  );

  const closuresThisYear =
    await prisma.distillation.count({
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

  return `ACTA-DES-${year}-${consecutive}`;
}

function isDistillationEventType(
  value: string
): value is DistillationEventType {
  return Object.values(
    DistillationEventType
  ).includes(
    value as DistillationEventType
  );
}

function isActionOnlyEvent(
  type: DistillationEventType
) {
  const actionOnlyEvents: DistillationEventType[] = [
    DistillationEventType.INICIO_CALENTAMIENTO,
    DistillationEventType.INICIO_CORAZON,
    DistillationEventType.INICIO_COLAS,
  ];

  return actionOnlyEvents.includes(type);
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

function formatNumber(
  value:
    | number
    | string
    | null
    | undefined,
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

  const days = Math.floor(
    totalMinutes / 1440
  );

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

function formatDistillationType(
  type: string
) {
  if (type === "DESTROZADO") {
    return "Destrozado";
  }

  if (type === "RECTIFICACION") {
    return "Rectificación";
  }

  return formatStatus(type);
}