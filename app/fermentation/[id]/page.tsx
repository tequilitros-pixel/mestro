import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import FermentationCharts from "@/components/FermentationCharts";
import FinishFermentationModal from "@/components/FinishFermentationModal";
import { FermentationStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

type NumericValue = number | null | undefined;

const TARGET_BRIX = 2;

export default async function FermentationDetailPage({ params }: Props) {
  const { id } = await params;

  const fermentation = await prisma.fermentation.findUnique({
    where: { id },
    include: {
      lot: true,
      finishedBy: true,
      readings: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!fermentation) notFound();

  async function addReading(formData: FormData) {
    "use server";

    const currentFermentation = await prisma.fermentation.findUnique({
      where: { id },
      select: {
        status: true,
      },
    });

    if (
      !currentFermentation ||
      currentFermentation.status === FermentationStatus.TERMINADA
    ) {
      redirect(`/fermentation/${id}`);
    }

    const brix = parseOptionalNumber(formData.get("brix"));
    const ph = parseOptionalNumber(formData.get("ph"));
    const temperature = parseOptionalNumber(
      formData.get("temperature")
    );
    const alcohol = parseOptionalNumber(formData.get("alcohol"));
    const saccharometer = parseOptionalNumber(
      formData.get("saccharometer")
    );
    const citricAcidGrams = parseOptionalNumber(
      formData.get("citricAcidGrams")
    );
    const bicarbonateGrams = parseOptionalNumber(
      formData.get("bicarbonateGrams")
    );
    const heatingMinutes = parseOptionalNumber(
      formData.get("heatingMinutes")
    );

    const notesValue = formData.get("notes");

    const notes =
      typeof notesValue === "string" && notesValue.trim()
        ? notesValue.trim()
        : null;

    const hasInformation =
      brix !== null ||
      ph !== null ||
      temperature !== null ||
      alcohol !== null ||
      saccharometer !== null ||
      citricAcidGrams !== null ||
      bicarbonateGrams !== null ||
      heatingMinutes !== null ||
      notes !== null;

    if (!hasInformation) {
      redirect(`/fermentation/${id}`);
    }

    await prisma.fermentationReading.create({
      data: {
        fermentationId: id,
        brix,
        ph,
        temperature,
        alcohol,
        saccharometer,
        citricAcidGrams,
        bicarbonateGrams,
        heated: heatingMinutes !== null && heatingMinutes > 0,
        heatingMinutes:
          heatingMinutes !== null
            ? Math.round(heatingMinutes)
            : null,
        notes,
      },
    });

    redirect(`/fermentation/${id}`);
  }

  async function finishFermentation(formData: FormData) {
    "use server";

    const user = await getCurrentUser();

    if (!user) {
      redirect("/login");
    }

    const finalBrix = parseRequiredNumber(
      formData.get("finalBrix")
    );

    const finalPh = parseRequiredNumber(formData.get("finalPh"));

    const finalAlcohol = parseRequiredNumber(
      formData.get("finalAlcohol")
    );

    const finalNotesValue = formData.get("finalNotes");

    const finalNotes =
      typeof finalNotesValue === "string" &&
      finalNotesValue.trim()
        ? finalNotesValue.trim()
        : null;

    if (
      finalBrix === null ||
      finalPh === null ||
      finalAlcohol === null
    ) {
      redirect(`/fermentation/${id}`);
    }

    if (
      finalBrix < 0 ||
      finalPh < 0 ||
      finalPh > 14 ||
      finalAlcohol < 0 ||
      finalAlcohol > 100
    ) {
      redirect(`/fermentation/${id}`);
    }

    const existingFermentation =
      await prisma.fermentation.findUnique({
        where: { id },
        select: {
          status: true,
          closureCode: true,
        },
      });

    if (!existingFermentation) {
      notFound();
    }

    if (
      existingFermentation.status ===
        FermentationStatus.TERMINADA ||
      existingFermentation.closureCode
    ) {
      redirect(`/fermentation/${id}`);
    }

    const finishedAt = new Date();
    const closureCode = await createClosureCode(finishedAt);

    const result = await prisma.fermentation.updateMany({
      where: {
        id,
        status: FermentationStatus.ACTIVA,
        closureCode: null,
      },
      data: {
        status: FermentationStatus.TERMINADA,
        finishedAt,
        finalBrix,
        finalPh,
        finalAlcohol,
        finalNotes,
        finishedById: user.id,
        closureCode,
      },
    });

    if (result.count === 0) {
      redirect(`/fermentation/${id}`);
    }

    redirect(`/fermentation/${id}`);
  }

  const currentBrix =
    getLatestNumericValue(fermentation.readings, "brix") ??
    Number(fermentation.initialBrix);

  const currentPh =
    getLatestNumericValue(fermentation.readings, "ph") ??
    Number(fermentation.initialPh);

  const currentTemp =
    getLatestNumericValue(
      fermentation.readings,
      "temperature"
    ) ?? Number(fermentation.initialTemperature);

  const currentAlcohol = getLatestNumericValue(
    fermentation.readings,
    "alcohol"
  );

  const currentSaccharometer = getLatestNumericValue(
    fermentation.readings,
    "saccharometer"
  );

  const previousBrix = getPreviousNumericValue(
    fermentation.readings,
    "brix"
  );

  const previousPh = getPreviousNumericValue(
    fermentation.readings,
    "ph"
  );

  const previousTemp = getPreviousNumericValue(
    fermentation.readings,
    "temperature"
  );

  const previousAlcohol = getPreviousNumericValue(
    fermentation.readings,
    "alcohol"
  );

  const totalAcid = fermentation.readings.reduce(
    (sum, reading) =>
      sum + Number(reading.citricAcidGrams ?? 0),
    0
  );

  const totalBicarbonate = fermentation.readings.reduce(
    (sum, reading) =>
      sum + Number(reading.bicarbonateGrams ?? 0),
    0
  );

  const totalHeatingMinutes = fermentation.readings.reduce(
    (sum, reading) =>
      sum + Number(reading.heatingMinutes ?? 0),
    0
  );

  const isFinished =
    fermentation.status === FermentationStatus.TERMINADA;

  const initialBrix = Number(fermentation.initialBrix);

  const progress =
    initialBrix > TARGET_BRIX
      ? Math.min(
          100,
          Math.max(
            0,
            ((initialBrix - currentBrix) /
              (initialBrix - TARGET_BRIX)) *
              100
          )
        )
      : 0;

  const temperatureStatus =
    currentTemp > 35
      ? "ALTA"
      : currentTemp < 25
        ? "BAJA"
        : "ÓPTIMA";

  const phStatus =
    currentPh > 5
      ? "ALTO"
      : currentPh < 3.8
        ? "BAJO"
        : "ÓPTIMO";

  const brixStatus =
    currentBrix <= TARGET_BRIX
      ? "LISTA"
      : currentBrix <= 5
        ? "CERCA DE META"
        : "DESCENDIENDO";

  const temperatureNeedsAttention =
    temperatureStatus !== "ÓPTIMA";

  const phNeedsAttention = phStatus !== "ÓPTIMO";

  const isReady = currentBrix <= TARGET_BRIX;

  const health:
    | "ATENCION"
    | "LISTA"
    | "SALUDABLE"
    | "TERMINADA" = isFinished
    ? "TERMINADA"
    : temperatureNeedsAttention || phNeedsAttention
      ? "ATENCION"
      : isReady
        ? "LISTA"
        : "SALUDABLE";

  const maestroMessages = buildMaestroMessages({
    currentBrix,
    previousBrix,
    currentPh,
    currentTemp,
    temperatureStatus,
    phStatus,
    isFinished,
  });

  const latestReading = fermentation.readings[0];

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
                Fermentación {fermentation.lot.code}
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                {latestReading
                  ? `Última lectura: ${formatDateTime(
                      latestReading.createdAt
                    )}`
                  : "Aún no existen lecturas posteriores al inicio."}
              </p>
            </div>

            <StatusBadge status={health} />
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            title="Tina"
            value={fermentation.tank}
            detail="Equipo asignado"
          />

          <Kpi
            title="Mosto"
            value={`${formatNumber(
              fermentation.mustLiters,
              0
            )} L`}
            detail="Volumen cargado"
          />

          <Kpi
            title="Estado"
            value={formatStatus(fermentation.status)}
            detail={
              isFinished
                ? "Proceso cerrado"
                : "Proceso activo"
            }
            highlight={!isFinished}
          />

          <Kpi
            title="Lecturas"
            value={fermentation.readings.length}
            detail={
              latestReading
                ? `Última: ${formatTime(
                    latestReading.createdAt
                  )}`
                : "Sin lecturas"
            }
          />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MeasurementKpi
            title="°Brix actual"
            value={formatNumber(currentBrix)}
            previous={previousBrix}
            current={currentBrix}
            lowerIsBetter
          />

          <MeasurementKpi
            title="pH actual"
            value={formatNumber(currentPh)}
            previous={previousPh}
            current={currentPh}
          />

          <MeasurementKpi
            title="Temperatura"
            value={`${formatNumber(currentTemp)} °C`}
            previous={previousTemp}
            current={currentTemp}
            suffix=" °C"
          />

          <MeasurementKpi
            title="Alcohol"
            value={
              currentAlcohol !== null
                ? `${formatNumber(currentAlcohol)} %`
                : "Sin registro"
            }
            previous={previousAlcohol}
            current={currentAlcohol}
            suffix=" %"
          />

          <Kpi
            title="Sacarímetro"
            value={
              currentSaccharometer !== null
                ? formatNumber(currentSaccharometer)
                : "Sin registro"
            }
            detail="Último valor válido"
          />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Kpi
            title="Ácido cítrico total"
            value={`${formatNumber(totalAcid)} g`}
            detail="Acumulado del proceso"
          />

          <Kpi
            title="Bicarbonato total"
            value={`${formatNumber(totalBicarbonate)} g`}
            detail="Acumulado del proceso"
          />

          <Kpi
            title="Calentamiento total"
            value={`${formatNumber(
              totalHeatingMinutes,
              0
            )} min`}
            detail="Tiempo acumulado"
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Avance de fermentación
                </p>

                <div className="mt-1 flex items-end gap-3">
                  <p className="text-4xl font-bold">
                    {progress.toFixed(0)}%
                  </p>

                  <p className="pb-1 text-sm text-slate-400">
                    hacia la meta de {TARGET_BRIX} °Brix
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5 text-center sm:text-right">
                <ProgressValue
                  title="Inicial"
                  value={`${formatNumber(initialBrix)}°`}
                />

                <ProgressValue
                  title="Actual"
                  value={`${formatNumber(currentBrix)}°`}
                />

                <ProgressValue
                  title="Meta"
                  value={`${TARGET_BRIX}°`}
                />
              </div>
            </div>

            <div className="mt-6 h-4 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid border-t border-slate-800 sm:grid-cols-3">
            <ProcessIndicator
              title="Temperatura"
              value={temperatureStatus}
              warning={temperatureNeedsAttention}
            />

            <ProcessIndicator
              title="pH"
              value={phStatus}
              warning={phNeedsAttention}
            />

            <ProcessIndicator
              title="°Brix"
              value={brixStatus}
              warning={false}
            />
          </div>
        </section>

        <section
          className={`mt-6 rounded-2xl border p-6 ${
            health === "ATENCION"
              ? "border-red-500/30 bg-red-500/10"
              : health === "LISTA"
                ? "border-green-500/30 bg-green-500/10"
                : health === "TERMINADA"
                  ? "border-blue-500/30 bg-blue-500/10"
                  : "border-amber-400/30 bg-amber-400/10"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">
            Análisis de MAESTRO
          </p>

          <h2
            className={`mt-3 text-2xl font-bold sm:text-3xl ${
              health === "ATENCION"
                ? "text-red-400"
                : health === "LISTA"
                  ? "text-green-400"
                  : health === "TERMINADA"
                    ? "text-blue-400"
                    : "text-amber-300"
            }`}
          >
            {getHealthTitle(health)}
          </h2>

          <div className="mt-5 space-y-3">
            {maestroMessages.map((message) => (
              <div
                key={message}
                className="flex items-start gap-3 rounded-xl bg-slate-950/40 p-3"
              >
                <span className="mt-0.5 text-amber-400">
                  ●
                </span>

                <p className="text-slate-200">{message}</p>
              </div>
            ))}
          </div>
        </section>

        {isFinished && (
          <ClosureAct
            closureCode={fermentation.closureCode}
            lotCode={fermentation.lot.code}
            tank={fermentation.tank}
            mustLiters={fermentation.mustLiters}
            initialBrix={fermentation.initialBrix}
            finalBrix={fermentation.finalBrix}
            finalPh={fermentation.finalPh}
            finalAlcohol={fermentation.finalAlcohol}
            finalNotes={fermentation.finalNotes}
            startedAt={fermentation.startedAt}
            finishedAt={fermentation.finishedAt}
            finishedByName={fermentation.finishedBy?.name}
            readingsCount={fermentation.readings.length}
          />
        )}

        {!isFinished && (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Registrar nueva lectura
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Solo llena los campos que mediste o las
                acciones que realizaste.
              </p>
            </div>

            <form
              action={addReading}
              className="grid gap-4 md:grid-cols-2"
            >
              <Field
                name="brix"
                label="°Brix"
                placeholder="Ej. 8.5"
                step="0.01"
                min="0"
              />

              <Field
                name="ph"
                label="pH"
                placeholder="Ej. 4.5"
                step="0.01"
                min="0"
                max="14"
              />

              <Field
                name="temperature"
                label="Temperatura"
                placeholder="Ej. 30"
                step="0.01"
                min="0"
                suffix="°C"
              />

              <Field
                name="alcohol"
                label="Alcohol"
                placeholder="Ej. 6.5"
                step="0.01"
                min="0"
                suffix="%"
              />

              <Field
                name="saccharometer"
                label="Sacarímetro / densímetro"
                placeholder="Ej. 5"
                step="0.01"
              />

              <Field
                name="citricAcidGrams"
                label="Ácido cítrico agregado"
                placeholder="Ej. 300"
                step="0.01"
                min="0"
                suffix="g"
              />

              <Field
                name="bicarbonateGrams"
                label="Bicarbonato agregado"
                placeholder="Ej. 100"
                step="0.01"
                min="0"
                suffix="g"
              />

              <Field
                name="heatingMinutes"
                label="Tiempo de calentamiento"
                placeholder="Ej. 15"
                step="1"
                min="0"
                suffix="min"
              />

              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Observaciones
                </span>

                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Describe espuma, aroma, movimiento, correcciones o cualquier situación importante."
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400"
                />
              </label>

              <button
                type="submit"
                className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-black transition hover:bg-amber-300 md:col-span-2"
              >
                Guardar lectura
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-6">
              <p className="mb-3 text-sm text-slate-400">
                Finaliza únicamente cuando hayas confirmado
                los valores finales del proceso.
              </p>

              <FinishFermentationModal
                lotCode={fermentation.lot.code}
                tank={fermentation.tank}
                mustLiters={fermentation.mustLiters}
                currentBrix={currentBrix}
                currentPh={currentPh}
                currentAlcohol={currentAlcohol}
                currentTemperature={currentTemp}
                readingsCount={fermentation.readings.length}
                action={finishFermentation}
              />
            </div>
          </section>
        )}

        <FermentationCharts
          readings={fermentation.readings}
        />

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Bitácora de fermentación
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Historial completo, de la lectura más reciente a
              la más antigua.
            </p>
          </div>

          {fermentation.readings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                Aún no hay lecturas registradas.
              </p>
            </div>
          ) : (
            <div className="relative space-y-5 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-slate-700">
              {fermentation.readings.map((reading, index) => (
                <article
                  key={reading.id}
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
                      <p className="font-semibold text-white">
                        {index === 0
                          ? "Lectura más reciente"
                          : `Lectura #${
                              fermentation.readings.length -
                              index
                            }`}
                      </p>

                      <p className="text-sm text-slate-400">
                        {formatDateTime(reading.createdAt)}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {reading.brix !== null && (
                        <Mini
                          title="°Brix"
                          value={formatNumber(reading.brix)}
                        />
                      )}

                      {reading.ph !== null && (
                        <Mini
                          title="pH"
                          value={formatNumber(reading.ph)}
                        />
                      )}

                      {reading.temperature !== null && (
                        <Mini
                          title="Temperatura"
                          value={`${formatNumber(
                            reading.temperature
                          )} °C`}
                        />
                      )}

                      {reading.alcohol !== null && (
                        <Mini
                          title="Alcohol"
                          value={`${formatNumber(
                            reading.alcohol
                          )} %`}
                        />
                      )}

                      {reading.saccharometer !== null && (
                        <Mini
                          title="Sacarímetro"
                          value={formatNumber(
                            reading.saccharometer
                          )}
                        />
                      )}
                    </div>

                    {(Number(
                      reading.citricAcidGrams ?? 0
                    ) > 0 ||
                      Number(
                        reading.bicarbonateGrams ?? 0
                      ) > 0 ||
                      Number(reading.heatingMinutes ?? 0) >
                        0) && (
                      <div className="mt-4 border-t border-slate-700 pt-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Acciones realizadas
                        </p>

                        <div className="grid gap-3 sm:grid-cols-3">
                          {Number(
                            reading.citricAcidGrams ?? 0
                          ) > 0 && (
                            <Mini
                              title="Ácido cítrico"
                              value={`${formatNumber(
                                reading.citricAcidGrams
                              )} g`}
                            />
                          )}

                          {Number(
                            reading.bicarbonateGrams ?? 0
                          ) > 0 && (
                            <Mini
                              title="Bicarbonato"
                              value={`${formatNumber(
                                reading.bicarbonateGrams
                              )} g`}
                            />
                          )}

                          {Number(
                            reading.heatingMinutes ?? 0
                          ) > 0 && (
                            <Mini
                              title="Calentamiento"
                              value={`${formatNumber(
                                reading.heatingMinutes,
                                0
                              )} min`}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {reading.notes && (
                      <div className="mt-4 rounded-xl bg-slate-900 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Observaciones
                        </p>

                        <p className="text-slate-300">
                          {reading.notes}
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

function ClosureAct({
  closureCode,
  lotCode,
  tank,
  mustLiters,
  initialBrix,
  finalBrix,
  finalPh,
  finalAlcohol,
  finalNotes,
  startedAt,
  finishedAt,
  finishedByName,
  readingsCount,
}: {
  closureCode: string | null;
  lotCode: string;
  tank: string;
  mustLiters: number;
  initialBrix: number;
  finalBrix: number | null;
  finalPh: number | null;
  finalAlcohol: number | null;
  finalNotes: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  finishedByName: string | undefined;
  readingsCount: number;
}) {
  const duration =
    finishedAt !== null
      ? formatDuration(startedAt, finishedAt)
      : "-";

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-green-500/30 bg-slate-900">
      <header className="border-b border-green-500/20 bg-green-500/10 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-400">
          Acta de cierre
        </p>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Fermentación terminada
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              El proceso quedó cerrado y bloqueado para
              nuevas lecturas.
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
          <ActValue title="Tina" value={tank} />
          <ActValue
            title="Mosto"
            value={`${formatNumber(mustLiters, 0)} L`}
          />
          <ActValue
            title="Lecturas"
            value={readingsCount}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActValue
            title="°Brix inicial"
            value={formatNumber(initialBrix)}
          />

          <ActValue
            title="°Brix final"
            value={formatNumber(finalBrix)}
            highlight
          />

          <ActValue
            title="pH final"
            value={formatNumber(finalPh)}
          />

          <ActValue
            title="Alcohol final"
            value={
              finalAlcohol !== null
                ? `${formatNumber(finalAlcohol)} %`
                : "-"
            }
            highlight
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

          <ActValue title="Duración" value={duration} />

          <ActValue
            title="Cerrado por"
            value={finishedByName ?? "Usuario no identificado"}
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
            Siguiente etapa: Destilación
          </p>

          <p className="mt-1 text-sm text-amber-100/70">
            La fermentación ya está disponible para continuar
            con el proceso de destilación.
          </p>
        </div>
      </div>
    </section>
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
          highlight ? "text-green-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
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
      <p className="text-sm text-slate-400">{title}</p>

      <p
        className={`mt-2 text-2xl font-bold ${
          highlight ? "text-green-400" : "text-white"
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

function MeasurementKpi({
  title,
  value,
  previous,
  current,
  suffix = "",
  lowerIsBetter = false,
}: {
  title: string;
  value: string | number;
  previous: number | null;
  current: number | null;
  suffix?: string;
  lowerIsBetter?: boolean;
}) {
  const delta =
    previous !== null && current !== null
      ? current - previous
      : null;

  const isPositiveMovement =
    delta !== null &&
    (lowerIsBetter ? delta < 0 : Math.abs(delta) <= 0.3);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>

      <p className="mt-2 text-2xl font-bold">{value}</p>

      {delta !== null ? (
        <p
          className={`mt-2 text-xs font-medium ${
            isPositiveMovement
              ? "text-green-400"
              : delta === 0
                ? "text-slate-400"
                : "text-amber-400"
          }`}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "●"}{" "}
          {delta === 0
            ? "Sin cambio"
            : `${formatNumber(
                Math.abs(delta)
              )}${suffix} respecto a la anterior`}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Sin lectura anterior comparable
        </p>
      )}
    </div>
  );
}

function ProgressValue({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
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
          warning ? "text-red-400" : "text-green-400"
        }`}
      >
        {warning ? "● " : "✓ "}
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
      <p className="text-xs text-slate-400">{title}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  step,
  min,
  max,
  suffix,
}: {
  name: string;
  label: string;
  placeholder: string;
  step: string;
  min?: string;
  max?: string;
  suffix?: string;
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
          className={`w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400 ${
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

function StatusBadge({
  status,
}: {
  status:
    | "ATENCION"
    | "LISTA"
    | "SALUDABLE"
    | "TERMINADA";
}) {
  const styles = {
    ATENCION:
      "border-red-500/40 bg-red-500/10 text-red-400",
    LISTA:
      "border-green-500/40 bg-green-500/10 text-green-400",
    SALUDABLE:
      "border-amber-400/40 bg-amber-400/10 text-amber-300",
    TERMINADA:
      "border-blue-500/40 bg-blue-500/10 text-blue-400",
  };

  return (
    <div
      className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${styles[status]}`}
    >
      {status === "ATENCION" && "🔴 Requiere atención"}
      {status === "LISTA" && "🟢 Lista para destilar"}
      {status === "SALUDABLE" &&
        "🟡 Fermentación saludable"}
      {status === "TERMINADA" &&
        "🔵 Fermentación terminada"}
    </div>
  );
}

function getHealthTitle(
  health:
    | "ATENCION"
    | "LISTA"
    | "SALUDABLE"
    | "TERMINADA"
) {
  if (health === "ATENCION") {
    return "Revisar fermentación";
  }

  if (health === "LISTA") {
    return "Lista para pasar a destilación";
  }

  if (health === "TERMINADA") {
    return "Proceso terminado";
  }

  return "La fermentación avanza correctamente";
}

function buildMaestroMessages({
  currentBrix,
  previousBrix,
  currentPh,
  currentTemp,
  temperatureStatus,
  phStatus,
  isFinished,
}: {
  currentBrix: number;
  previousBrix: number | null;
  currentPh: number;
  currentTemp: number;
  temperatureStatus: string;
  phStatus: string;
  isFinished: boolean;
}) {
  const messages: string[] = [];

  if (isFinished) {
    messages.push(
      "La fermentación está cerrada y su bitácora permanece disponible para consulta."
    );

    return messages;
  }

  if (temperatureStatus === "ALTA") {
    messages.push(
      `La temperatura actual es de ${formatNumber(
        currentTemp
      )} °C y se encuentra por encima del rango recomendado. Revisa el calentamiento de la tina.`
    );
  } else if (temperatureStatus === "BAJA") {
    messages.push(
      `La temperatura actual es de ${formatNumber(
        currentTemp
      )} °C y se encuentra baja. Revisa si la fermentación necesita apoyo térmico.`
    );
  } else {
    messages.push(
      `La temperatura se mantiene en un rango estable: ${formatNumber(
        currentTemp
      )} °C.`
    );
  }

  if (phStatus === "ALTO") {
    messages.push(
      `El pH está alto en ${formatNumber(
        currentPh
      )}. Conviene revisar el comportamiento microbiológico antes de realizar una corrección.`
    );
  } else if (phStatus === "BAJO") {
    messages.push(
      `El pH está bajo en ${formatNumber(
        currentPh
      )}. Verifica la medición y evita hacer ajustes sin confirmar una segunda lectura.`
    );
  } else {
    messages.push(
      `El pH se encuentra dentro del rango operativo: ${formatNumber(
        currentPh
      )}.`
    );
  }

  if (currentBrix <= TARGET_BRIX) {
    messages.push(
      `El °Brix alcanzó la meta de ${TARGET_BRIX}. Confirma alcohol, pH y condiciones sensoriales antes de finalizar.`
    );
  } else if (previousBrix !== null) {
    const brixChange = currentBrix - previousBrix;

    if (brixChange < 0) {
      messages.push(
        `El °Brix descendió ${formatNumber(
          Math.abs(brixChange)
        )} puntos desde la lectura anterior. La fermentación continúa avanzando.`
      );
    } else if (brixChange === 0) {
      messages.push(
        "El °Brix no cambió respecto a la lectura anterior. Realiza la próxima medición con atención para confirmar que la fermentación no se haya detenido."
      );
    } else {
      messages.push(
        `El °Brix aumentó ${formatNumber(
          brixChange
        )} puntos respecto a la lectura anterior. Conviene repetir la medición para descartar una variación del instrumento o de la muestra.`
      );
    }
  } else {
    messages.push(
      "Se necesita al menos otra lectura de °Brix para evaluar su velocidad de descenso."
    );
  }

  return messages;
}

function getLatestNumericValue<
  T extends {
    brix?: NumericValue;
    ph?: NumericValue;
    temperature?: NumericValue;
    alcohol?: NumericValue;
    saccharometer?: NumericValue;
  },
>(
  readings: T[],
  field: keyof Pick<
    T,
    | "brix"
    | "ph"
    | "temperature"
    | "alcohol"
    | "saccharometer"
  >
): number | null {
  for (const reading of readings) {
    const value = reading[field];

    if (value !== null && value !== undefined) {
      return Number(value);
    }
  }

  return null;
}

function getPreviousNumericValue<
  T extends {
    brix?: NumericValue;
    ph?: NumericValue;
    temperature?: NumericValue;
    alcohol?: NumericValue;
    saccharometer?: NumericValue;
  },
>(
  readings: T[],
  field: keyof Pick<
    T,
    | "brix"
    | "ph"
    | "temperature"
    | "alcohol"
    | "saccharometer"
  >
): number | null {
  let valuesFound = 0;

  for (const reading of readings) {
    const value = reading[field];

    if (value !== null && value !== undefined) {
      valuesFound += 1;

      if (valuesFound === 2) {
        return Number(value);
      }
    }
  }

  return null;
}

async function createClosureCode(date: Date) {
  const year = date.getFullYear();

  const startOfYear = new Date(year, 0, 1);
  const startOfNextYear = new Date(year + 1, 0, 1);

  const closuresThisYear =
    await prisma.fermentation.count({
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

  return `ACTA-FER-${year}-${consecutive}`;
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

  return Number.isFinite(number) ? number : null;
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

  return Number.isFinite(number) ? number : null;
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

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(start: Date, end: Date) {
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