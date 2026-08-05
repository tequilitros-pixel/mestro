import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PrinterIcon } from "@/components/ui/icons";
import FinishDistillationModal from "@/components/FinishDistillationModal";
import DistillationTimeline from "@/components/DistillationTimeline";
import DistillationCharts from "@/components/DistillationCharts";
import {
  DistillationEventType,
  DistillationStatus,
  EquipmentStatus,
  LotStage,
} from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { advanceLotStage } from "@/lib/lotStage";
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

  const distillationEquipmentId = distillation.equipmentId;
  const distillationLotId = distillation.lotId;
  const distillationType = distillation.type;

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
    lastAlcoholCorrected
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

        await transaction.equipment.update({
          where: { id: distillationEquipmentId },
          data: {
            status: EquipmentStatus.DISPONIBLE,
            currentLoad: 0,
          },
        });

        await advanceLotStage(
          transaction,
          distillationLotId,
          distillationType === "RECTIFICACION"
            ? LotStage.TERMINADO
            : LotStage.RECTIFICACION
        );

        return updated;
      }
    );

    if (result.count === 0) {
      redirect(`/distillation/${id}`);
    }

    redirect(`/distillation/${id}`);
  }

  async function finishLot(formData: FormData) {
    "use server";

    const user = await getCurrentUser();

    if (!user) {
      redirect("/login");
    }

    const totalLiters = parseRequiredNumber(
      formData.get("totalLiters")
    );

    if (totalLiters === null || totalLiters <= 0) {
      redirect(`/distillation/${id}`);
    }

    const lot = await prisma.lot.findUnique({
      where: { id: distillationLotId },
      select: {
        stage: true,
        totalLitersObtained: true,
        qrToken: true,
      },
    });

    if (
      !lot ||
      lot.stage !== LotStage.TERMINADO ||
      lot.totalLitersObtained !== null
    ) {
      redirect(`/distillation/${id}`);
    }

    await prisma.lot.update({
      where: { id: distillationLotId },
      data: {
        finishedAt: new Date(),
        totalLitersObtained: totalLiters,
        qrToken: lot.qrToken ?? randomUUID(),
      },
    });

    redirect(`/distillation/${id}`);
  }

  const isFinalStep = distillationType === "RECTIFICACION";

  const lotReadyToFinish =
    hasFinished &&
    isFinalStep &&
    distillation.lot.stage === LotStage.TERMINADO;

  return (
    <main className="min-h-screen bg-background p-4 text-on-surface sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
    

        <header className="mt-8">
          <p className="font-mono text-sm uppercase tracking-[0.4em] text-outline">
            MAESTRO
          </p>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">
                Destilación{" "}
                {distillation.lot.code}
              </h1>

              <p className="mt-2 text-sm text-on-surface-variant">
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

        <section className="mt-8 rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8">
          <p className="font-mono text-sm uppercase tracking-[0.4em] text-outline">
            MAESTRO INTELIGENTE
          </p>

          <h2
            className={`mt-3 text-2xl font-bold sm:text-3xl ${advice.color}`}
          >
            {hasFinished
              ? "Proceso de destilación terminado"
              : advice.title}
          </h2>

          <p className="mt-2 text-on-surface-variant">
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

        {lotReadyToFinish && (
          <FinishLotSection
            lotId={distillation.lot.id}
            lotCode={distillation.lot.code}
            totalLitersObtained={
              distillation.lot.totalLitersObtained
            }
            qrToken={distillation.lot.qrToken}
            finishedAt={distillation.lot.finishedAt}
            onConfirm={finishLot}
          />
        )}

        {!hasFinished && (
          <section className="mt-8 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Acciones de destilación
              </h2>

              <p className="mt-2 text-sm text-on-surface-variant">
                Registra las lecturas y los cambios
                de corte conforme avanza el proceso.
              </p>
            </div>

            <form
              action={addEvent}
              className="rounded-2xl border border-outline-variant bg-surface-container-high p-5 sm:p-6"
            >
              <p className="mb-4 text-xl font-bold">
                Registro de destilación
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                    Tipo de registro
                  </span>

                  <select
                    name="type"
                    required
                    className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
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
                  <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                    Observaciones
                  </span>

                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Describe el comportamiento, aroma, flujo, corte realizado o cualquier detalle importante."
                    className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-on-primary transition hover:opacity-90"
              >
                Guardar registro
              </button>
            </form>

            <div className="mt-6 border-t border-outline-variant pt-6">
              <p className="mb-3 text-sm text-on-surface-variant">
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
    <section className="mt-8 overflow-hidden rounded-3xl border border-tertiary-fixed-dim/30 bg-surface-container">
      <header className="border-b border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 p-6 sm:p-8">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-tertiary-fixed-dim">
          Acta de cierre
        </p>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-on-surface sm:text-3xl">
              Destilación terminada
            </h2>

            <p className="mt-2 text-sm text-on-surface-variant">
              El proceso quedó cerrado y bloqueado
              para nuevos registros.
            </p>
          </div>

          <div className="w-fit rounded-full border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 px-4 py-2 font-mono text-sm font-bold text-tertiary-fixed-dim">
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
          <div className="mt-4 rounded-2xl border border-outline-variant bg-background p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-outline">
              Observaciones finales
            </p>

            <p className="mt-2 whitespace-pre-wrap text-on-surface-variant">
              {finalNotes}
            </p>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 p-5">
          <p className="font-bold text-tertiary-fixed-dim">
            Expediente de destilación cerrado
          </p>

          <p className="mt-1 text-sm text-tertiary-fixed-dim/70">
            Los resultados finales quedaron
            registrados en el historial del lote.
          </p>
        </div>
      </div>
    </section>
  );
}

function FinishLotSection({
  lotId,
  lotCode,
  totalLitersObtained,
  qrToken,
  finishedAt,
  onConfirm,
}: {
  lotId: string;
  lotCode: string;
  totalLitersObtained: number | null;
  qrToken: string | null;
  finishedAt: Date | null;
  onConfirm: (formData: FormData) => void;
}) {
  if (totalLitersObtained !== null && qrToken) {
    const publicUrl = `${
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    }/q/lote/${qrToken}`;

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
      publicUrl
    )}`;

    return (
      <section className="mt-8 overflow-hidden rounded-3xl border border-tertiary-fixed-dim/30 bg-surface-container">
        <header className="border-b border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 p-6 sm:p-8">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-tertiary-fixed-dim">
            Lote finalizado
          </p>

          <h2 className="mt-3 text-2xl font-bold text-on-surface sm:text-3xl">
            Lote {lotCode} listo para trazabilidad
          </h2>

          <p className="mt-2 text-sm text-on-surface-variant">
            {formatNumber(totalLitersObtained)} L totales
            obtenidos
            {finishedAt
              ? ` · Cerrado ${formatDateTime(finishedAt)}`
              : ""}
          </p>
        </header>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="rounded-3xl bg-white p-6">
            <img
              src={qrImageUrl}
              alt={`Código QR del lote ${lotCode}`}
              className="mx-auto aspect-square w-full max-w-[320px]"
            />
          </div>

          <div>
            <div className="rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
              <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-outline">
                Enlace del QR
              </p>

              <p className="mt-3 break-all font-mono text-sm text-on-surface-variant">
                {publicUrl}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={qrImageUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-primary px-5 py-3 text-center font-black text-on-primary transition hover:opacity-90"
              >
                Ver QR completo
              </a>

              <Link
                href={`/lots/${lotId}/qr`}
                className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-high px-5 py-3 text-center font-black text-primary transition duration-150 ease-out hover:scale-[1.04] hover:bg-surface-container-highest active:scale-[0.97]"
              >
                <PrinterIcon className="h-5 w-5" />
                Imprimir QR
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-secondary/30 bg-surface-container p-6 sm:p-8">
      <p className="font-mono text-sm uppercase tracking-[0.4em] text-secondary">
        Último paso
      </p>

      <h2 className="mt-3 text-2xl font-bold text-on-surface sm:text-3xl">
        Finalizar lote {lotCode}
      </h2>

      <p className="mt-2 text-on-surface-variant">
        Registra el total de litros obtenidos en todo el proceso
        para cerrar el lote y generar su código QR de
        trazabilidad.
      </p>

      <form
        action={onConfirm}
        className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]"
      >
        <NumberField
          name="totalLiters"
          label="Litros totales obtenidos"
          placeholder="Ej. 480"
          suffix="L"
          step="0.01"
          min="0"
        />

        <button
          type="submit"
          className="h-fit self-end rounded-xl bg-primary px-6 py-3 font-bold text-on-primary transition hover:opacity-90"
        >
          Finalizar lote y generar QR
        </button>
      </form>
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

function Mini({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-background p-3">
      <p className="text-xs text-outline">
        {title}
      </p>

      <p className="mt-1 font-bold text-on-surface">
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
          placeholder={placeholder}
          className={`w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary ${
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

function DistillationStatusBadge({
  finished,
  processStatus,
}: {
  finished: boolean;
  processStatus: string;
}) {
  if (finished) {
    return (
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-on-surface-variant/40 bg-on-surface-variant/10 px-4 py-2 text-sm font-bold text-on-surface-variant">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant" />
        Destilación terminada
      </div>
    );
  }

  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-secondary/40 bg-secondary/10 px-4 py-2 text-sm font-bold text-secondary">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
      {processStatus}
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