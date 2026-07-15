import PlantHeader from "@/components/ui/PlantHeader";
import MaestroCard from "@/components/ui/MaestroCard";
import EquipmentCard from "@/components/ui/EquipmentCard";
import PlantStatusCard from "@/components/PlantStatusCard";
import AIReport from "@/components/ui/AIReport";
import MissionControl from "@/components/intelligence/MissionControl";
import RecordingBadge from "@/components/ui/RecordingBadge";

import { Predictor } from "@/lib/brain/Predictor";
import { ExcellenceEngine } from "@/lib/brain/ExcellenceEngine";
import { LearningEngine } from "@/lib/brain";
import { getActiveProcesses } from "@/lib/brain/data/getActiveProcesses";
import { analyzeActiveProcesses } from "@/lib/brain/analyzeActiveProcesses";
import { getRecordingStatus } from "@/lib/brain/getRecordingStatus";
import { getCurrentUser } from "@/lib/auth";

export default async function PlantPage() {
  const user = await getCurrentUser();

  const {
    cookings,
    millings,
    fermentations,
    distillations,
  } = await getActiveProcesses();

  const { alerts, recommendations } =
    await analyzeActiveProcesses();

  const recordingStatus = await getRecordingStatus();

  const alertMessages = alerts.map(
    (alert) => `${alert.source}: ${alert.message}`
  );

  const overdueCookingCount =
    recordingStatus.cooking.filter(
      (recording) => recording.isOverdue
    ).length;

  const overdueFermentationCount =
    recordingStatus.fermentation.filter(
      (recording) => recording.isOverdue
    ).length;

  const overdueProcesses =
    overdueCookingCount + overdueFermentationCount;

  const activeProcessesCount =
    cookings.length +
    millings.length +
    fermentations.length +
    distillations.length;

  const totalAgaveKg = cookings.reduce(
    (sum, cooking) => sum + cooking.agaveKg,
    0
  );

  /*
   * Predictor actualmente solicita un costo.
   * Mientras conectamos los gastos reales de los lotes,
   * evitamos presentar este valor como un costo oficial.
   */
  const prediction = Predictor.fromAgave({
    agaveKg: totalAgaveKg,
    totalCost: 0,
  });

  const latestCooking = cookings[0];

  const latestCookingTemperature =
    latestCooking !== undefined
      ? getCookingAverageTemperature(
          latestCooking.events
        )
      : null;

  const latestFermentation = fermentations[0];

  const latestFermentationAlcohol =
    latestFermentation !== undefined
      ? getLatestValidNumber(
          latestFermentation.readings,
          "alcohol"
        )
      : null;

  const excellence = ExcellenceEngine.evaluate({
    cookingTemp:
      latestCookingTemperature ?? undefined,
    fermentationAlcohol:
      latestFermentationAlcohol ?? undefined,
  });

  const learning = await LearningEngine.summary();

  const plantHealth = calculatePlantHealth({
    alertsCount: alertMessages.length,
    overdueProcesses,
    activeProcessesCount,
  });

  const plantStatus =
    alertMessages.length > 0 ||
    overdueProcesses > 0
      ? "🟡 Planta con observaciones"
      : activeProcessesCount > 0
        ? "🟢 Planta operando normalmente"
        : "⚪ Planta sin procesos activos";

  const greetingName =
    user?.name?.split(" ")[0] ?? "equipo";

  const maestroMessage =
    alertMessages.length > 0 ||
    overdueProcesses > 0
      ? `Buenos días, ${greetingName}. Detecté situaciones que requieren atención.`
      : activeProcessesCount > 0
        ? `Buenos días, ${greetingName}. MAESTRO analizó la planta y los procesos activos operan normalmente.`
        : `Buenos días, ${greetingName}. No hay procesos activos en este momento.`;

  const maestroTasks =
    recommendations.length > 0
      ? recommendations
      : overdueProcesses > 0
        ? [
            `${overdueProcesses} proceso${
              overdueProcesses === 1 ? "" : "s"
            } requiere${
              overdueProcesses === 1 ? "" : "n"
            } un nuevo registro.`,
          ]
        : ["Sin acciones pendientes."];

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <PlantHeader
          title="Destiladora del Norte"
          status={plantStatus}
          health={plantHealth}
        />

        <section>
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
              Estado actual
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Procesos activos
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Información más reciente de cada área de
              producción.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cookings.map((cooking) => {
              const averageTemperature =
                getCookingAverageTemperature(
                  cooking.events
                );

              const recording =
                recordingStatus.cooking.find(
                  (item) => item.id === cooking.id
                );

              const hasTemperatureAlert =
                averageTemperature !== null &&
                (averageTemperature < 85 ||
                  averageTemperature > 100);

              return (
                <div
                  key={cooking.id}
                  className="space-y-2"
                >
                  <PlantStatusCard
                    icon="🔥"
                    title={cooking.equipment.name}
                    value={
                      averageTemperature !== null
                        ? `${formatNumber(
                            averageTemperature
                          )} °C`
                        : "Sin lectura"
                    }
                    status={
                      hasTemperatureAlert
                        ? "warning"
                        : "ok"
                    }
                  />

                  {recording && (
                    <RecordingBadge
                      minutesSinceLastRecord={
                        recording.minutesSinceLastRecord
                      }
                      isOverdue={recording.isOverdue}
                    />
                  )}
                </div>
              );
            })}

            {millings.map((milling) => {
              const lastBrix =
                getLatestValidNumber(
                  milling.events,
                  "brix"
                );

              const lastTemperature =
                getLatestValidNumber(
                  milling.events,
                  "temperature"
                );

              const value =
                milling.mashLiters !== null
                  ? `${formatNumber(
                      milling.mashLiters,
                      0
                    )} L`
                  : lastBrix !== null
                    ? `${formatNumber(
                        lastBrix
                      )} °Brix`
                    : lastTemperature !== null
                      ? `${formatNumber(
                          lastTemperature
                        )} °C`
                      : "Sin registro";

              return (
                <PlantStatusCard
                  key={milling.id}
                  icon="⚙️"
                  title={milling.equipment.name}
                  value={value}
                  status="ok"
                />
              );
            })}

            {fermentations.map(
              (fermentation) => {
                const currentBrix =
                  getLatestValidNumber(
                    fermentation.readings,
                    "brix"
                  ) ??
                  Number(
                    fermentation.initialBrix
                  );

                const currentAlcohol =
                  getLatestValidNumber(
                    fermentation.readings,
                    "alcohol"
                  );

                const currentTemperature =
                  getLatestValidNumber(
                    fermentation.readings,
                    "temperature"
                  ) ??
                  Number(
                    fermentation.initialTemperature
                  );

                const hasAlert =
                  alertMessages.some((message) =>
                    message.startsWith(
                      fermentation.tank
                    )
                  ) ||
                  currentTemperature < 25 ||
                  currentTemperature > 35;

                const recording =
                  recordingStatus.fermentation.find(
                    (item) =>
                      item.id === fermentation.id
                  );

                const value =
                  currentAlcohol !== null
                    ? `${formatNumber(
                        currentAlcohol
                      )}% alcohol`
                    : `${formatNumber(
                        currentBrix
                      )} °Brix`;

                return (
                  <div
                    key={fermentation.id}
                    className="space-y-2"
                  >
                    <PlantStatusCard
                      icon="🧪"
                      title={fermentation.tank}
                      value={value}
                      status={
                        hasAlert
                          ? "warning"
                          : "ok"
                      }
                    />

                    {recording && (
                      <RecordingBadge
                        minutesSinceLastRecord={
                          recording.minutesSinceLastRecord
                        }
                        isOverdue={
                          recording.isOverdue
                        }
                      />
                    )}
                  </div>
                );
              }
            )}

            {distillations.map(
              (distillation) => {
                const alcohol =
                  getLatestValidNumber(
                    distillation.events,
                    "alcoholCorrected"
                  ) ??
                  getLatestValidNumber(
                    distillation.events,
                    "alcohol"
                  );

                const temperature =
                  getLatestValidNumber(
                    distillation.events,
                    "temperature"
                  );

                const hasAlert =
                  (alcohol !== null &&
                    (alcohol < 0 ||
                      alcohol > 100)) ||
                  (temperature !== null &&
                    temperature > 110);

                const value =
                  alcohol !== null
                    ? `${formatNumber(
                        alcohol
                      )} °GL`
                    : temperature !== null
                      ? `${formatNumber(
                          temperature
                        )} °C`
                      : "Sin lectura";

                return (
                  <PlantStatusCard
                    key={distillation.id}
                    icon="🥃"
                    title={
                      distillation.equipment.name
                    }
                    value={value}
                    status={
                      hasAlert
                        ? "warning"
                        : "ok"
                    }
                  />
                );
              }
            )}

            {activeProcessesCount === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center sm:col-span-2 lg:col-span-4">
                <p className="text-slate-400">
                  No hay procesos activos en este
                  momento.
                </p>
              </div>
            )}
          </div>
        </section>

        <MaestroCard
          message={maestroMessage}
          tasks={maestroTasks}
          production={
            totalAgaveKg > 0
              ? `${prediction.expectedLiters.toFixed(
                  0
                )} L estimados`
              : "Sin producción estimada"
          }
          confidence={
            totalAgaveKg > 0
              ? prediction.confidence
              : 0
          }
        />

        <MissionControl
          score={Math.round(excellence.score)}
          confidence={
            totalAgaveKg > 0
              ? prediction.confidence
              : 0
          }
          expectedLiters={
            totalAgaveKg > 0
              ? Math.round(
                  prediction.expectedLiters
                )
              : 0
          }
          recommendation={
            learning.recommendation
          }
          recommendations={recommendations}
          alerts={alertMessages}
        />

        <AIReport
          score={Math.round(excellence.score)}
          confidence={
            totalAgaveKg > 0
              ? prediction.confidence
              : 0
          }
          recommendation={
            learning.recommendation
          }
        />

        <section>
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
              Acceso operativo
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Procesos de la planta
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Abre directamente el proceso que deseas
              consultar o actualizar.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cookings.map((cooking) => {
              const averageTemperature =
                getCookingAverageTemperature(
                  cooking.events
                );

              return (
                <EquipmentCard
                  key={cooking.id}
                  icon="🔥"
                  title={cooking.equipment.name}
                  status={`Cocinando · ${cooking.lot.code}`}
                  value={
                    averageTemperature !== null
                      ? `${formatNumber(
                          averageTemperature
                        )} °C promedio`
                      : "Sin temperatura"
                  }
                  href={`/cooking/${cooking.id}`}
                />
              );
            })}

            {millings.map((milling) => {
              const lastBrix =
                getLatestValidNumber(
                  milling.events,
                  "brix"
                );

              return (
                <EquipmentCard
                  key={milling.id}
                  icon="⚙️"
                  title={milling.equipment.name}
                  status={`Moliendo · ${milling.lot.code}`}
                  value={
                    milling.mashLiters !== null
                      ? `${formatNumber(
                          milling.mashLiters,
                          0
                        )} L recuperados`
                      : lastBrix !== null
                        ? `${formatNumber(
                            lastBrix
                          )} °Brix`
                        : `${milling.events.length} registros`
                  }
                  href={`/milling/${milling.id}`}
                />
              );
            })}

            {fermentations.map(
              (fermentation) => {
                const currentBrix =
                  getLatestValidNumber(
                    fermentation.readings,
                    "brix"
                  ) ??
                  Number(
                    fermentation.initialBrix
                  );

                const currentAlcohol =
                  getLatestValidNumber(
                    fermentation.readings,
                    "alcohol"
                  );

                return (
                  <EquipmentCard
                    key={fermentation.id}
                    icon="🧪"
                    title={fermentation.tank}
                    status={`Fermentando · ${fermentation.lot.code}`}
                    value={
                      currentAlcohol !== null
                        ? `${formatNumber(
                            currentAlcohol
                          )}% alcohol`
                        : `${formatNumber(
                            currentBrix
                          )} °Brix`
                    }
                    href={`/fermentation/${fermentation.id}`}
                  />
                );
              }
            )}

            {distillations.map(
              (distillation) => {
                const alcohol =
                  getLatestValidNumber(
                    distillation.events,
                    "alcoholCorrected"
                  ) ??
                  getLatestValidNumber(
                    distillation.events,
                    "alcohol"
                  );

                const processType =
                  formatDistillationType(
                    distillation.type
                  );

                return (
                  <EquipmentCard
                    key={distillation.id}
                    icon="🥃"
                    title={
                      distillation.equipment.name
                    }
                    status={`${processType} · ${distillation.lot.code}`}
                    value={
                      alcohol !== null
                        ? `${formatNumber(
                            alcohol
                          )} °GL`
                        : "Sin alcohol registrado"
                    }
                    href={`/distillation/${distillation.id}`}
                  />
                );
              }
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function getCookingAverageTemperature(
  events: Array<{
    temperatureTop: number | null;
    temperatureMiddle: number | null;
    temperatureBottom: number | null;
  }>
) {
  const latestTemperatureEvent = events.find(
    (event) =>
      event.temperatureTop !== null ||
      event.temperatureMiddle !== null ||
      event.temperatureBottom !== null
  );

  if (!latestTemperatureEvent) {
    return null;
  }

  const temperatures = [
    latestTemperatureEvent.temperatureTop,
    latestTemperatureEvent.temperatureMiddle,
    latestTemperatureEvent.temperatureBottom,
  ].filter(
    (value): value is number =>
      value !== null && value !== undefined
  );

  if (temperatures.length === 0) {
    return null;
  }

  return (
    temperatures.reduce(
      (sum, value) => sum + value,
      0
    ) / temperatures.length
  );
}

function getLatestValidNumber<
  T extends Record<string, unknown>,
>(
  records: T[],
  field: keyof T
) {
  const record = records.find((item) => {
    const value = item[field];

    return (
      value !== null &&
      value !== undefined &&
      Number.isFinite(Number(value))
    );
  });

  if (!record) {
    return null;
  }

  return Number(record[field]);
}

function calculatePlantHealth({
  alertsCount,
  overdueProcesses,
  activeProcessesCount,
}: {
  alertsCount: number;
  overdueProcesses: number;
  activeProcessesCount: number;
}) {
  if (activeProcessesCount === 0) {
    return 100;
  }

  const alertPenalty = alertsCount * 8;
  const overduePenalty = overdueProcesses * 12;

  return Math.max(
    0,
    Math.min(
      100,
      100 - alertPenalty - overduePenalty
    )
  );
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
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(number);
}

function formatDistillationType(type: string) {
  if (type === "DESTROZADO") {
    return "Destrozado";
  }

  if (type === "RECTIFICACION") {
    return "Rectificación";
  }

  return type
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) =>
      letter.toUpperCase()
    );
}