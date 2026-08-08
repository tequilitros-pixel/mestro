import PlantHeader from "@/components/ui/PlantHeader";
import MaestroCard from "@/components/ui/MaestroCard";
import EquipmentCard from "@/components/ui/EquipmentCard";
import PlantStatusCard from "@/components/PlantStatusCard";
import AIReport from "@/components/ui/AIReport";
import MissionControl from "@/components/intelligence/MissionControl";
import RecordingBadge from "@/components/ui/RecordingBadge";
import PageTabs from "@/components/ui/PageTabs";
import {
  FlameIcon,
  GearIcon,
  FlaskIcon,
  StillIcon,
  GlassWaterIcon,
  PackageIcon,
  ToolboxIcon,
  BrainIcon,
  GridIcon,
} from "@/components/ui/icons";

import { Predictor } from "@/lib/brain/Predictor";
import { ExcellenceEngine } from "@/lib/brain/ExcellenceEngine";
import { LearningEngine } from "@/lib/brain";
import { getActiveProcesses } from "@/lib/brain/data/getActiveProcesses";
import { analyzeActiveProcesses } from "@/lib/brain/analyzeActiveProcesses";
import { getRecordingStatus } from "@/lib/brain/getRecordingStatus";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Equipment, EquipmentType } from "@prisma/client";
import type { ReactNode } from "react";

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

  const allEquipment = await prisma.equipment.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  // Para el equipo OPERANDO, enlaza directo al proceso activo
  // que lo está usando, en vez de a la pantalla de "nuevo".
  const activeHrefByEquipmentId = new Map<string, string>();

  for (const cooking of cookings) {
    activeHrefByEquipmentId.set(
      cooking.equipmentId,
      `/cooking/${cooking.id}`
    );
  }

  for (const milling of millings) {
    activeHrefByEquipmentId.set(
      milling.equipmentId,
      `/milling/${milling.id}`
    );
  }

  for (const distillation of distillations) {
    activeHrefByEquipmentId.set(
      distillation.equipmentId,
      `/distillation/${distillation.id}`
    );
  }

  const alertMessages = alerts.map(
    (alert) => `${alert.source}: ${alert.message}`
  );

  const overdueCookingCount =
    recordingStatus.cooking.filter(
      (recording) => recording.isOverdue
    ).length;

  const overdueMillingCount =
    recordingStatus.milling.filter(
      (recording) => recording.isOverdue
    ).length;

  const overdueFermentationCount =
    recordingStatus.fermentation.filter(
      (recording) => recording.isOverdue
    ).length;

  const overdueDistillationCount =
    recordingStatus.distillation.filter(
      (recording) => recording.isOverdue
    ).length;

  const overdueProcesses =
    overdueCookingCount +
    overdueMillingCount +
    overdueFermentationCount +
    overdueDistillationCount;

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

  const plantStatusLevel: "ok" | "warning" | "neutral" =
    alertMessages.length > 0 || overdueProcesses > 0
      ? "warning"
      : activeProcessesCount > 0
        ? "ok"
        : "neutral";

  const plantStatus =
    plantStatusLevel === "warning"
      ? "Planta con observaciones"
      : plantStatusLevel === "ok"
        ? "Planta operando normalmente"
        : "Planta sin procesos activos";

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
    <main className="min-h-screen bg-background p-4 text-on-surface sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <PlantHeader
          title="Destiladora del Norte"
          status={plantStatus}
          statusLevel={plantStatusLevel}
          health={plantHealth}
        />

        <PageTabs
          tabs={[
            {
              key: "procesos",
              label: "Procesos activos",
              icon: <FlameIcon className="h-4 w-4" />,
              content: (
                <>
                          <section>
                            <div className="mb-5">
                              <p className="font-mono text-sm uppercase tracking-[0.35em] text-on-surface-variant">
                                Estado actual
                              </p>

                              <h2 className="mt-2 text-3xl font-bold">
                                Procesos activos
                              </h2>

                              <p className="mt-2 text-sm text-on-surface-variant">
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
                                      icon={<FlameIcon />}
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

                                const recording =
                                  recordingStatus.milling.find(
                                    (item) => item.id === milling.id
                                  );

                                return (
                                  <div
                                    key={milling.id}
                                    className="space-y-2"
                                  >
                                    <PlantStatusCard
                                      icon={<GearIcon />}
                                      title={milling.equipment.name}
                                      value={value}
                                      status="ok"
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
                                        icon={<FlaskIcon />}
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

                                  const recording =
                                    recordingStatus.distillation.find(
                                      (item) =>
                                        item.id === distillation.id
                                    );

                                  return (
                                    <div
                                      key={distillation.id}
                                      className="space-y-2"
                                    >
                                      <PlantStatusCard
                                        icon={<StillIcon />}
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

                              {activeProcessesCount === 0 && (
                                <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center sm:col-span-2 lg:col-span-4">
                                  <p className="text-on-surface-variant">
                                    No hay procesos activos en este
                                    momento.
                                  </p>
                                </div>
                              )}
                            </div>
                          </section>
                </>
              ),
            },
            {
              key: "equipo",
              label: "Equipo",
              icon: <ToolboxIcon className="h-4 w-4" />,
              content: (
                <>
                          <section>
                            <div className="mb-5">
                              <p className="font-mono text-sm uppercase tracking-[0.35em] text-on-surface-variant">
                                Estado del equipo
                              </p>

                              <h2 className="mt-2 text-3xl font-bold">
                                Equipo de planta
                              </h2>

                              <p className="mt-2 text-sm text-on-surface-variant">
                                Disponibilidad de hornos, molinos, tinas y
                                alambiques, estén o no en uso ahora mismo.
                              </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                              {allEquipment.map((equipment) => {
                                const info = getEquipmentDisplay(equipment);
                                const activeHref = activeHrefByEquipmentId.get(
                                  equipment.id
                                );

                                return (
                                  <EquipmentCard
                                    key={equipment.id}
                                    icon={info.icon}
                                    title={equipment.name}
                                    status={info.statusLabel}
                                    tone={info.tone}
                                    subtitle={equipment.location ?? undefined}
                                    href={activeHref ?? info.newHref}
                                  />
                                );
                              })}

                              {allEquipment.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center sm:col-span-2 lg:col-span-4">
                                  <p className="text-on-surface-variant">
                                    No hay equipo activo registrado.
                                  </p>
                                </div>
                              )}
                            </div>
                          </section>
                </>
              ),
            },
            {
              key: "maestro",
              label: "MAESTRO",
              icon: <BrainIcon className="h-4 w-4" />,
              content: (
                <>
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
                            level={excellence.level}
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
                </>
              ),
            },
            {
              key: "accesos",
              label: "Accesos",
              icon: <GridIcon className="h-4 w-4" />,
              content: (
                <>

                          <section>
                            <div className="mb-5">
                              <p className="font-mono text-sm uppercase tracking-[0.35em] text-on-surface-variant">
                                Acceso operativo
                              </p>

                              <h2 className="mt-2 text-3xl font-bold">
                                Procesos de la planta
                              </h2>

                              <p className="mt-2 text-sm text-on-surface-variant">
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
                                    icon={<FlameIcon />}
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
                                    icon={<GearIcon />}
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
                                      icon={<FlaskIcon />}
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
                                      icon={<StillIcon />}
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
                </>
              ),
            },
          ]}
        />
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

const EQUIPMENT_TYPE_INFO: Record<
  EquipmentType,
  { icon: ReactNode; newHref: string }
> = {
  HORNO: { icon: <FlameIcon />, newHref: "/cooking/new" },
  DESGARRADORA: { icon: <GearIcon />, newHref: "/milling/new" },
  PRENSA: { icon: <GearIcon />, newHref: "/milling/new" },
  TINA: { icon: <FlaskIcon />, newHref: "/fermentation/new" },
  ALAMBIQUE: { icon: <StillIcon />, newHref: "/distillation/new" },
  BOMBA: { icon: <GlassWaterIcon />, newHref: "/plant" },
  TANQUE: { icon: <PackageIcon />, newHref: "/plant" },
  CALDERA: { icon: <FlameIcon />, newHref: "/plant" },
  OTRO: { icon: <ToolboxIcon />, newHref: "/plant" },
};

const EQUIPMENT_STATUS_INFO: Record<
  Equipment["status"],
  { label: string; tone: "green" | "yellow" | "red" | "blue" | "slate" }
> = {
  DISPONIBLE: { label: "Disponible", tone: "green" },
  OPERANDO: { label: "Operando", tone: "blue" },
  ESPERANDO: { label: "Esperando", tone: "yellow" },
  LAVADO: { label: "En lavado", tone: "slate" },
  MANTENIMIENTO: { label: "Mantenimiento", tone: "red" },
};

function getEquipmentDisplay(equipment: Equipment) {
  const typeInfo =
    EQUIPMENT_TYPE_INFO[equipment.type] ??
    EQUIPMENT_TYPE_INFO.OTRO;

  const statusInfo =
    EQUIPMENT_STATUS_INFO[equipment.status] ??
    EQUIPMENT_STATUS_INFO.DISPONIBLE;

  return {
    icon: typeInfo.icon,
    newHref: typeInfo.newHref,
    statusLabel: statusInfo.label,
    tone: statusInfo.tone,
  };
}