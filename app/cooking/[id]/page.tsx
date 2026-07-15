import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  CookingEventType,
  CookingStatus,
} from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import CookingCharts from "@/components/CookingCharts";
import FinishCookingModal from "@/components/FinishCookingModal";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CookingDetailPage({
  params,
}: Props) {
  const { id } = await params;

  const cooking = await prisma.cooking.findUnique({
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

  if (!cooking) notFound();

  const hasStartedVapor = cooking.events.some(
    (event) =>
      event.type === CookingEventType.INICIO_VAPOR
  );

  const hasFinished =
    cooking.status === CookingStatus.TERMINADA;

  const temperatureEvents = cooking.events.filter(
    (event) =>
      event.type === CookingEventType.TEMPERATURA
  );

  const lastTemperature =
    temperatureEvents.at(-1) ?? null;

  const bitterHoneyEvents = cooking.events.filter(
    (event) =>
      event.type === CookingEventType.MIELES_AMARGAS
  );

  const sweetHoneyEvents = cooking.events.filter(
    (event) =>
      event.type === CookingEventType.MIELES_DULCES
  );

  const bitterHoneyLiters = bitterHoneyEvents.reduce(
    (total, event) =>
      total + Number(event.liters ?? 0),
    0
  );

  const sweetHoneyLiters = sweetHoneyEvents.reduce(
    (total, event) =>
      total + Number(event.liters ?? 0),
    0
  );

  const lastSweetHoneyBrix =
    [...sweetHoneyEvents]
      .reverse()
      .find((event) => event.brix !== null)?.brix ??
    null;

  const lastSweetHoneyPh =
    [...sweetHoneyEvents]
      .reverse()
      .find((event) => event.ph !== null)?.ph ??
    null;

  const lastSweetHoneyTemperature =
    [...sweetHoneyEvents]
      .reverse()
      .find((event) => event.temperature !== null)
      ?.temperature ?? null;

  const cookingProgress = calculateCookingProgress({
    startedAt: cooking.startedAt,
    finishedAt: cooking.finishedAt,
    hasFinished,
  });

  const cookingHealth = getCookingHealth({
    hasFinished,
    hasStartedVapor,
    lastTemperature,
  });

  async function addSimpleEvent(
    formData: FormData
  ) {
    "use server";

    const currentCooking =
      await prisma.cooking.findUnique({
        where: { id },
        select: {
          status: true,
          closureCode: true,
        },
      });

    if (
      !currentCooking ||
      currentCooking.status ===
        CookingStatus.TERMINADA ||
      currentCooking.closureCode
    ) {
      redirect(`/cooking/${id}`);
    }

    const typeValue = formData.get("type");

    if (
      typeof typeValue !== "string" ||
      !isCookingEventType(typeValue)
    ) {
      redirect(`/cooking/${id}`);
    }

    const type = typeValue as CookingEventType;

    /*
     * FIN_COCCION ya no puede registrarse desde
     * un evento normal. El cierre debe realizarse
     * mediante el Acta de Cierre.
     */
    if (type === CookingEventType.FIN_COCCION) {
      redirect(`/cooking/${id}`);
    }

    const liters = parseOptionalNumber(
      formData.get("liters")
    );

    const ph = parseOptionalNumber(
      formData.get("ph")
    );

    const brix = parseOptionalNumber(
      formData.get("brix")
    );

    const temperature = parseOptionalNumber(
      formData.get("temperature")
    );

    const notesValue = formData.get("notes");

    const notes =
      typeof notesValue === "string" &&
      notesValue.trim()
        ? notesValue.trim()
        : null;

    const needsAdditionalInformation =
      type === CookingEventType.MIELES_AMARGAS ||
      type === CookingEventType.MIELES_DULCES ||
      type === CookingEventType.OBSERVACION;

    const hasAdditionalInformation =
      liters !== null ||
      ph !== null ||
      brix !== null ||
      temperature !== null ||
      notes !== null;

    if (
      needsAdditionalInformation &&
      !hasAdditionalInformation
    ) {
      redirect(`/cooking/${id}`);
    }

    await prisma.cookingEvent.create({
      data: {
        cookingId: id,
        type,
        liters,
        ph,
        brix,
        temperature,
        notes,
      },
    });

    redirect(`/cooking/${id}`);
  }

  async function addTemperatureEvent(
    formData: FormData
  ) {
    "use server";

    const currentCooking =
      await prisma.cooking.findUnique({
        where: { id },
        select: {
          status: true,
          closureCode: true,
        },
      });

    if (
      !currentCooking ||
      currentCooking.status ===
        CookingStatus.TERMINADA ||
      currentCooking.closureCode
    ) {
      redirect(`/cooking/${id}`);
    }

    const temperatureTop = parseRequiredNumber(
      formData.get("temperatureTop")
    );

    const temperatureMiddle =
      parseRequiredNumber(
        formData.get("temperatureMiddle")
      );

    const temperatureBottom =
      parseRequiredNumber(
        formData.get("temperatureBottom")
      );

    if (
      temperatureTop === null ||
      temperatureMiddle === null ||
      temperatureBottom === null
    ) {
      redirect(`/cooking/${id}`);
    }

    if (
      temperatureTop < 0 ||
      temperatureMiddle < 0 ||
      temperatureBottom < 0
    ) {
      redirect(`/cooking/${id}`);
    }

    const notesValue = formData.get("notes");

    const notes =
      typeof notesValue === "string" &&
      notesValue.trim()
        ? notesValue.trim()
        : null;

    await prisma.cookingEvent.create({
      data: {
        cookingId: id,
        type: CookingEventType.TEMPERATURA,
        temperatureTop,
        temperatureMiddle,
        temperatureBottom,
        notes,
      },
    });

    redirect(`/cooking/${id}`);
  }

  async function finishCooking(
    formData: FormData
  ) {
    "use server";

    const user = await getCurrentUser();

    if (!user) {
      redirect("/login");
    }

    const finalAgaveKg = parseRequiredNumber(
      formData.get("finalAgaveKg")
    );

    const finalSweetHoneyLiters =
      parseRequiredNumber(
        formData.get("finalSweetHoneyLiters")
      );

    const finalSweetHoneyBrix =
      parseRequiredNumber(
        formData.get("finalSweetHoneyBrix")
      );

    const finalNotesValue =
      formData.get("finalNotes");

    const finalNotes =
      typeof finalNotesValue === "string" &&
      finalNotesValue.trim()
        ? finalNotesValue.trim()
        : null;

    if (
      finalAgaveKg === null ||
      finalSweetHoneyLiters === null ||
      finalSweetHoneyBrix === null
    ) {
      redirect(`/cooking/${id}`);
    }

    if (
      finalAgaveKg < 0 ||
      finalSweetHoneyLiters < 0 ||
      finalSweetHoneyBrix < 0
    ) {
      redirect(`/cooking/${id}`);
    }

    const existingCooking =
      await prisma.cooking.findUnique({
        where: { id },
        select: {
          status: true,
          closureCode: true,
        },
      });

    if (!existingCooking) {
      notFound();
    }

    if (
      existingCooking.status ===
        CookingStatus.TERMINADA ||
      existingCooking.closureCode
    ) {
      redirect(`/cooking/${id}`);
    }

    const finishedAt = new Date();

    const closureCode =
      await createCookingClosureCode(finishedAt);

    const result = await prisma.$transaction(
      async (transaction) => {
        const updatedCooking =
          await transaction.cooking.updateMany({
            where: {
              id,
              status: {
                not: CookingStatus.TERMINADA,
              },
              closureCode: null,
            },
            data: {
              status: CookingStatus.TERMINADA,
              finishedAt,
              finalAgaveKg,
              finalSweetHoneyLiters,
              finalSweetHoneyBrix,
              finalNotes,
              closureCode,
              finishedById: user.id,
            },
          });

        if (updatedCooking.count === 0) {
          return updatedCooking;
        }

        await transaction.cookingEvent.create({
          data: {
            cookingId: id,
            type: CookingEventType.FIN_COCCION,
            liters: finalSweetHoneyLiters,
            brix: finalSweetHoneyBrix,
            notes:
              finalNotes ??
              `Cocción cerrada mediante ${closureCode}.`,
          },
        });

        return updatedCooking;
      }
    );

    if (result.count === 0) {
      redirect(`/cooking/${id}`);
    }

    redirect(`/cooking/${id}`);
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
                Cocción {cooking.lot.code}
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Horno {cooking.equipment.name} · Inicio{" "}
                {formatDateTime(cooking.startedAt)}
              </p>
            </div>

            <CookingStatusBadge
              status={cookingHealth}
            />
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            title="Horno"
            value={cooking.equipment.name}
            detail="Equipo asignado"
          />

          <Kpi
            title="Kg cargados"
            value={`${formatNumber(
              cooking.agaveKg,
              0
            )} kg`}
            detail="Carga inicial"
          />

          <Kpi
            title="Estado"
            value={formatStatus(cooking.status)}
            detail={
              hasFinished
                ? "Proceso cerrado"
                : "Proceso activo"
            }
            highlight={!hasFinished}
          />

          <Kpi
            title="Vapor"
            value={
              hasStartedVapor
                ? "Iniciado"
                : "Pendiente"
            }
            detail={
              hasStartedVapor
                ? "Existe registro de inicio"
                : "Aún no ha comenzado"
            }
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Avance estimado de cocción
                </p>

                <div className="mt-1 flex items-end gap-3">
                  <h2 className="text-4xl font-bold">
                    {cookingProgress.percentage}%
                  </h2>

                  <p className="pb-1 text-sm text-slate-400">
                    Meta operativa: 32 horas
                  </p>
                </div>
              </div>

              <div className="text-sm text-slate-400 sm:text-right">
                <p>
                  Tiempo transcurrido:{" "}
                  {cookingProgress.duration}
                </p>

                <p>
                  {cooking.events.length} eventos
                  registrados
                </p>
              </div>
            </div>

            <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{
                  width: `${cookingProgress.percentage}%`,
                }}
              />
            </div>
          </div>

          <div className="grid border-t border-slate-800 sm:grid-cols-3">
            <ProcessIndicator
              title="Temperatura"
              value={getTemperatureStatus(
                lastTemperature
              )}
              warning={isTemperatureWarning(
                lastTemperature
              )}
            />

            <ProcessIndicator
              title="Vapor"
              value={
                hasStartedVapor
                  ? "INICIADO"
                  : "PENDIENTE"
              }
              warning={!hasStartedVapor}
            />

            <ProcessIndicator
              title="Proceso"
              value={formatStatus(cooking.status)}
              warning={false}
            />
          </div>
        </section>

        <section
          className={`mt-6 rounded-2xl border p-6 ${
            cookingHealth === "ATENCION"
              ? "border-red-500/30 bg-red-500/10"
              : cookingHealth === "TERMINADA"
                ? "border-blue-500/30 bg-blue-500/10"
                : cookingHealth === "LISTA"
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-amber-400/30 bg-amber-400/10"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">
            Análisis de MAESTRO
          </p>

          <h2
            className={`mt-3 text-2xl font-bold sm:text-3xl ${
              cookingHealth === "ATENCION"
                ? "text-red-400"
                : cookingHealth === "TERMINADA"
                  ? "text-blue-400"
                  : cookingHealth === "LISTA"
                    ? "text-green-400"
                    : "text-amber-300"
            }`}
          >
            {getCookingHealthTitle(cookingHealth)}
          </h2>

          <div className="mt-5 space-y-3">
            {buildCookingMessages({
              hasFinished,
              hasStartedVapor,
              lastTemperature,
              sweetHoneyLiters,
              lastSweetHoneyBrix,
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

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Última temperatura
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Lectura más reciente del horno.
              </p>
            </div>

            {lastTemperature && (
              <p className="text-sm text-slate-500">
                {formatDateTime(
                  lastTemperature.createdAt
                )}
              </p>
            )}
          </div>

          {lastTemperature ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <TemperatureCard
                title="Superior"
                value={
                  lastTemperature.temperatureTop
                }
              />

              <TemperatureCard
                title="Media"
                value={
                  lastTemperature.temperatureMiddle
                }
              />

              <TemperatureCard
                title="Inferior"
                value={
                  lastTemperature.temperatureBottom
                }
              />
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                Todavía no hay temperaturas
                registradas.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Resumen del cocimiento
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Extracciones y valores acumulados del
              proceso.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              title="Mieles amargas"
              value={`${formatNumber(
                bitterHoneyLiters
              )} L`}
              detail={`${bitterHoneyEvents.length} registros`}
            />

            <Kpi
              title="Mieles dulces"
              value={`${formatNumber(
                sweetHoneyLiters
              )} L`}
              detail={`${sweetHoneyEvents.length} registros`}
            />

            <Kpi
              title="Último °Brix dulce"
              value={formatNumber(
                lastSweetHoneyBrix
              )}
              detail={
                lastSweetHoneyBrix !== null
                  ? "Última extracción registrada"
                  : "Sin registro"
              }
            />

            <Kpi
              title="Eventos"
              value={cooking.events.length}
              detail={`${temperatureEvents.length} lecturas de temperatura`}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Kpi
              title="Último pH de miel dulce"
              value={formatNumber(
                lastSweetHoneyPh
              )}
              detail="Último valor válido"
            />

            <Kpi
              title="Temperatura de miel dulce"
              value={
                lastSweetHoneyTemperature !== null
                  ? `${formatNumber(
                      lastSweetHoneyTemperature
                    )} °C`
                  : "-"
              }
              detail="Último valor válido"
            />
          </div>
        </section>

        {hasFinished && (
          <CookingClosureAct
            closureCode={cooking.closureCode}
            lotCode={cooking.lot.code}
            equipmentName={
              cooking.equipment.name
            }
            initialAgaveKg={cooking.agaveKg}
            finalAgaveKg={
              cooking.finalAgaveKg
            }
            finalSweetHoneyLiters={
              cooking.finalSweetHoneyLiters
            }
            finalSweetHoneyBrix={
              cooking.finalSweetHoneyBrix
            }
            finalNotes={cooking.finalNotes}
            bitterHoneyLiters={
              bitterHoneyLiters
            }
            startedAt={cooking.startedAt}
            finishedAt={cooking.finishedAt}
            finishedByName={
              cooking.finishedBy?.name
            }
            eventsCount={cooking.events.length}
          />
        )}

        {!hasFinished && (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                Acciones de cocción
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Registra únicamente lo que ocurra en
                el horno.
              </p>
            </div>

            {!hasStartedVapor ? (
              <form action={addSimpleEvent}>
                <input
                  type="hidden"
                  name="type"
                  value={
                    CookingEventType.INICIO_VAPOR
                  }
                />

                <button className="w-full rounded-xl bg-amber-400 px-6 py-4 text-lg font-bold text-black transition hover:bg-amber-300">
                  🔥 Iniciar vapor
                </button>
              </form>
            ) : (
              <div className="space-y-8">
                <form
                  action={addTemperatureEvent}
                  className="rounded-2xl border border-slate-700 bg-slate-800 p-5 sm:p-6"
                >
                  <h3 className="mb-4 text-xl font-bold">
                    Registrar temperaturas
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <NumberField
                      name="temperatureTop"
                      placeholder="Superior"
                      suffix="°C"
                      step="0.1"
                      min="0"
                      required
                    />

                    <NumberField
                      name="temperatureMiddle"
                      placeholder="Media"
                      suffix="°C"
                      step="0.1"
                      min="0"
                      required
                    />

                    <NumberField
                      name="temperatureBottom"
                      placeholder="Inferior"
                      suffix="°C"
                      step="0.1"
                      min="0"
                      required
                    />
                  </div>

                  <input
                    name="notes"
                    placeholder="Observaciones opcionales"
                    className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400"
                  />

                  <button className="mt-4 w-full rounded-xl bg-amber-400 px-6 py-3 font-bold text-black transition hover:bg-amber-300">
                    Guardar temperaturas
                  </button>
                </form>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <SimpleActionForm
                    action={addSimpleEvent}
                    type={
                      CookingEventType.AUMENTAR_VAPOR
                    }
                    label="⬆️ Aumentar vapor"
                  />

                  <SimpleActionForm
                    action={addSimpleEvent}
                    type={
                      CookingEventType.BAJAR_VAPOR
                    }
                    label="⬇️ Disminuir vapor"
                  />

                  <SimpleActionForm
                    action={addSimpleEvent}
                    type={
                      CookingEventType.SUSPENDER_VAPOR
                    }
                    label="⏸ Suspender vapor"
                  />

                  <HoneyActionForm
                    action={addSimpleEvent}
                    type={
                      CookingEventType.MIELES_AMARGAS
                    }
                    label="🟠 Extraer mieles amargas"
                  />

                  <HoneyActionForm
                    action={addSimpleEvent}
                    type={
                      CookingEventType.MIELES_DULCES
                    }
                    label="🟡 Extraer mieles dulces"
                  />

                  <SimpleActionForm
                    action={addSimpleEvent}
                    type={
                      CookingEventType.OBSERVACION
                    }
                    label="📝 Guardar observación"
                    notesRequired
                  />
                </div>

                <div className="border-t border-slate-700 pt-6">
                  <p className="mb-3 text-sm text-slate-400">
                    Finaliza únicamente después de
                    confirmar los resultados oficiales.
                  </p>

                  <FinishCookingModal
                    lotCode={cooking.lot.code}
                    equipmentName={
                      cooking.equipment.name
                    }
                    initialAgaveKg={
                      cooking.agaveKg
                    }
                    currentAgaveKg={
                      cooking.agaveKg
                    }
                    sweetHoneyLiters={
                      sweetHoneyLiters
                    }
                    sweetHoneyBrix={
                      lastSweetHoneyBrix
                    }
                    bitterHoneyLiters={
                      bitterHoneyLiters
                    }
                    eventsCount={
                      cooking.events.length
                    }
                    action={finishCooking}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        <CookingCharts events={cooking.events} />

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Bitácora de cocción
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Historial completo del proceso, del
              registro más reciente al más antiguo.
            </p>
          </div>

          {cooking.events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                Aún no hay eventos registrados.
              </p>
            </div>
          ) : (
            <div className="relative space-y-5 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-slate-700">
              {[...cooking.events]
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
                          {getCookingEventLabel(
                            event.type
                          )}
                        </p>

                        <p className="text-sm text-slate-400">
                          {formatDateTime(
                            event.createdAt
                          )}
                        </p>
                      </div>

                      {event.type ===
                        CookingEventType.TEMPERATURA && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <Mini
                            title="Superior"
                            value={`${formatNumber(
                              event.temperatureTop
                            )} °C`}
                          />

                          <Mini
                            title="Media"
                            value={`${formatNumber(
                              event.temperatureMiddle
                            )} °C`}
                          />

                          <Mini
                            title="Inferior"
                            value={`${formatNumber(
                              event.temperatureBottom
                            )} °C`}
                          />
                        </div>
                      )}

                      {(event.liters !== null ||
                        event.temperature !== null ||
                        event.ph !== null ||
                        event.brix !== null) && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {event.liters !== null && (
                            <Mini
                              title="Litros"
                              value={`${formatNumber(
                                event.liters
                              )} L`}
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

                          {event.ph !== null && (
                            <Mini
                              title="pH"
                              value={formatNumber(
                                event.ph
                              )}
                            />
                          )}

                          {event.brix !== null && (
                            <Mini
                              title="°Brix"
                              value={formatNumber(
                                event.brix
                              )}
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

function CookingClosureAct({
  closureCode,
  lotCode,
  equipmentName,
  initialAgaveKg,
  finalAgaveKg,
  finalSweetHoneyLiters,
  finalSweetHoneyBrix,
  finalNotes,
  bitterHoneyLiters,
  startedAt,
  finishedAt,
  finishedByName,
  eventsCount,
}: {
  closureCode: string | null;
  lotCode: string;
  equipmentName: string;
  initialAgaveKg: number;
  finalAgaveKg: number | null;
  finalSweetHoneyLiters: number | null;
  finalSweetHoneyBrix: number | null;
  finalNotes: string | null;
  bitterHoneyLiters: number;
  startedAt: Date;
  finishedAt: Date | null;
  finishedByName: string | undefined;
  eventsCount: number;
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
              Cocción terminada
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              El horno quedó cerrado y bloqueado para
              nuevos registros.
            </p>
          </div>

          <div className="w-fit rounded-full border border-green-500/40 bg-green-500/10 px-4 py-2 font-mono text-sm font-bold text-green-300">
            {closureCode ?? "Acta sin folio"}
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
            title="Horno"
            value={equipmentName}
          />

          <ActValue
            title="Eventos"
            value={eventsCount}
          />

          <ActValue
            title="Mieles amargas"
            value={`${formatNumber(
              bitterHoneyLiters
            )} L`}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActValue
            title="Carga inicial"
            value={`${formatNumber(
              initialAgaveKg,
              0
            )} kg`}
          />

          <ActValue
            title="Agave cocido final"
            value={
              finalAgaveKg !== null
                ? `${formatNumber(
                    finalAgaveKg,
                    0
                  )} kg`
                : "-"
            }
            highlight
          />

          <ActValue
            title="Mieles dulces"
            value={
              finalSweetHoneyLiters !== null
                ? `${formatNumber(
                    finalSweetHoneyLiters
                  )} L`
                : "-"
            }
            highlight
          />

          <ActValue
            title="°Brix final"
            value={formatNumber(
              finalSweetHoneyBrix
            )}
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
            Siguiente etapa: Molienda
          </p>

          <p className="mt-1 text-sm text-amber-100/70">
            La cocción quedó documentada y disponible
            para continuar con la descarga y molienda
            del agave.
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

function TemperatureCard({
  title,
  value,
}: {
  title: string;
  value: number | null;
}) {
  const numericValue =
    value !== null ? Number(value) : null;

  const status =
    numericValue === null
      ? "Sin lectura"
      : numericValue >= 90
        ? "En rango"
        : "Calentando";

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
      <p className="text-sm text-slate-400">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {numericValue !== null
          ? `${formatNumber(numericValue)} °C`
          : "-"}
      </p>

      <p
        className={`mt-2 text-xs font-semibold ${
          numericValue !== null &&
          numericValue >= 90
            ? "text-green-400"
            : "text-amber-400"
        }`}
      >
        {status}
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

function CookingStatusBadge({
  status,
}: {
  status:
    | "ATENCION"
    | "CALENTANDO"
    | "LISTA"
    | "TERMINADA";
}) {
  const styles = {
    ATENCION:
      "border-red-500/40 bg-red-500/10 text-red-400",
    CALENTANDO:
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

      {status === "CALENTANDO" &&
        "🟡 Cocción en proceso"}

      {status === "LISTA" &&
        "🟢 Temperatura alcanzada"}

      {status === "TERMINADA" &&
        "🔵 Cocción terminada"}
    </div>
  );
}

function SimpleActionForm({
  action,
  type,
  label,
  notesRequired = false,
}: {
  action: (formData: FormData) => Promise<void>;
  type: CookingEventType;
  label: string;
  notesRequired?: boolean;
}) {
  return (
    <form
      action={action}
      className="rounded-2xl border border-slate-700 bg-slate-800 p-4"
    >
      <input
        type="hidden"
        name="type"
        value={type}
      />

      <input
        name="notes"
        required={notesRequired}
        placeholder={
          notesRequired
            ? "Escribe la observación"
            : "Observación opcional"
        }
        className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
      />

      <button className="w-full rounded-xl bg-slate-700 px-5 py-4 font-bold transition hover:bg-slate-600">
        {label}
      </button>
    </form>
  );
}

function HoneyActionForm({
  action,
  type,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  type:
    | typeof CookingEventType.MIELES_AMARGAS
    | typeof CookingEventType.MIELES_DULCES;
  label: string;
}) {
  return (
    <form
      action={action}
      className="rounded-2xl border border-slate-700 bg-slate-800 p-4"
    >
      <input
        type="hidden"
        name="type"
        value={type}
      />

      <div className="space-y-3">
        <NumberField
          name="liters"
          placeholder="Litros extraídos"
          suffix="L"
          step="0.01"
          min="0"
        />

        <NumberField
          name="temperature"
          placeholder="Temperatura"
          suffix="°C"
          step="0.01"
          min="0"
        />

        <NumberField
          name="ph"
          placeholder="pH"
          step="0.01"
          min="0"
          max="14"
        />

        <NumberField
          name="brix"
          placeholder="°Brix"
          step="0.01"
          min="0"
        />

        <input
          name="notes"
          placeholder="Observación opcional"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
        />
      </div>

      <button className="mt-3 w-full rounded-xl bg-slate-700 px-5 py-4 font-bold transition hover:bg-slate-600">
        {label}
      </button>
    </form>
  );
}

function NumberField({
  name,
  placeholder,
  suffix,
  step,
  min,
  max,
  required = false,
}: {
  name: string;
  placeholder: string;
  suffix?: string;
  step: string;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  return (
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
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400 ${
          suffix ? "pr-14" : ""
        }`}
      />

      {suffix && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
          {suffix}
        </span>
      )}
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

function getCookingHealth({
  hasFinished,
  hasStartedVapor,
  lastTemperature,
}: {
  hasFinished: boolean;
  hasStartedVapor: boolean;
  lastTemperature: {
    temperatureTop: number | null;
    temperatureMiddle: number | null;
    temperatureBottom: number | null;
  } | null;
}):
  | "ATENCION"
  | "CALENTANDO"
  | "LISTA"
  | "TERMINADA" {
  if (hasFinished) {
    return "TERMINADA";
  }

  if (!hasStartedVapor) {
    return "CALENTANDO";
  }

  if (!lastTemperature) {
    return "CALENTANDO";
  }

  const values = [
    lastTemperature.temperatureTop,
    lastTemperature.temperatureMiddle,
    lastTemperature.temperatureBottom,
  ];

  const validValues = values.filter(
    (value): value is number => value !== null
  );

  if (validValues.length < 3) {
    return "ATENCION";
  }

  if (
    validValues.some(
      (temperature) =>
        temperature > 100 || temperature < 0
    )
  ) {
    return "ATENCION";
  }

  if (
    validValues.every(
      (temperature) => temperature >= 90
    )
  ) {
    return "LISTA";
  }

  return "CALENTANDO";
}

function getCookingHealthTitle(
  health:
    | "ATENCION"
    | "CALENTANDO"
    | "LISTA"
    | "TERMINADA"
) {
  if (health === "ATENCION") {
    return "Revisar las lecturas del horno";
  }

  if (health === "LISTA") {
    return "El horno alcanzó la temperatura objetivo";
  }

  if (health === "TERMINADA") {
    return "Proceso de cocción terminado";
  }

  return "La cocción continúa en calentamiento";
}

function buildCookingMessages({
  hasFinished,
  hasStartedVapor,
  lastTemperature,
  sweetHoneyLiters,
  lastSweetHoneyBrix,
}: {
  hasFinished: boolean;
  hasStartedVapor: boolean;
  lastTemperature: {
    temperatureTop: number | null;
    temperatureMiddle: number | null;
    temperatureBottom: number | null;
  } | null;
  sweetHoneyLiters: number;
  lastSweetHoneyBrix: number | null;
}) {
  const messages: string[] = [];

  if (hasFinished) {
    messages.push(
      "La cocción está cerrada y su expediente permanece disponible para consulta."
    );

    return messages;
  }

  if (!hasStartedVapor) {
    messages.push(
      "El vapor aún no ha sido iniciado. El proceso permanece pendiente de calentamiento."
    );
  } else {
    messages.push(
      "El inicio de vapor quedó registrado correctamente."
    );
  }

  if (!lastTemperature) {
    messages.push(
      "Se necesita una lectura de temperatura superior, media e inferior para evaluar el horno."
    );
  } else {
    const top = lastTemperature.temperatureTop;
    const middle =
      lastTemperature.temperatureMiddle;
    const bottom =
      lastTemperature.temperatureBottom;

    if (
      top !== null &&
      middle !== null &&
      bottom !== null
    ) {
      const difference =
        Math.max(top, middle, bottom) -
        Math.min(top, middle, bottom);

      if (
        top >= 90 &&
        middle >= 90 &&
        bottom >= 90
      ) {
        messages.push(
          `Las tres zonas alcanzaron al menos 90 °C. La diferencia máxima entre zonas es de ${formatNumber(
            difference
          )} °C.`
        );
      } else {
        messages.push(
          `La última lectura es superior ${formatNumber(
            top
          )} °C, media ${formatNumber(
            middle
          )} °C e inferior ${formatNumber(
            bottom
          )} °C.`
        );
      }

      if (difference > 8) {
        messages.push(
          "Existe una diferencia importante entre las zonas del horno. Revisa la distribución de vapor y el calentamiento."
        );
      } else {
        messages.push(
          "La distribución de temperatura entre las zonas se mantiene relativamente uniforme."
        );
      }
    }
  }

  if (sweetHoneyLiters > 0) {
    messages.push(
      `Se han registrado ${formatNumber(
        sweetHoneyLiters
      )} litros de mieles dulces.`
    );
  }

  if (lastSweetHoneyBrix !== null) {
    messages.push(
      `El último registro de mieles dulces fue de ${formatNumber(
        lastSweetHoneyBrix
      )} °Brix.`
    );
  }

  return messages;
}

function calculateCookingProgress({
  startedAt,
  finishedAt,
  hasFinished,
}: {
  startedAt: Date;
  finishedAt: Date | null;
  hasFinished: boolean;
}) {
  const referenceDate =
    finishedAt ?? new Date();

  const elapsedMilliseconds = Math.max(
    0,
    referenceDate.getTime() -
      startedAt.getTime()
  );

  const targetMilliseconds =
    32 * 60 * 60 * 1000;

  const percentage = hasFinished
    ? 100
    : Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (elapsedMilliseconds /
              targetMilliseconds) *
              100
          )
        )
      );

  return {
    percentage,
    duration: formatDuration(
      startedAt,
      referenceDate
    ),
  };
}

function getTemperatureStatus(
  lastTemperature: {
    temperatureTop: number | null;
    temperatureMiddle: number | null;
    temperatureBottom: number | null;
  } | null
) {
  if (!lastTemperature) {
    return "SIN LECTURA";
  }

  const top =
    lastTemperature.temperatureTop;
  const middle =
    lastTemperature.temperatureMiddle;
  const bottom =
    lastTemperature.temperatureBottom;

  if (
    top === null ||
    middle === null ||
    bottom === null
  ) {
    return "INCOMPLETA";
  }

  if (
    top >= 90 &&
    middle >= 90 &&
    bottom >= 90
  ) {
    return "EN RANGO";
  }

  return "CALENTANDO";
}

function isTemperatureWarning(
  lastTemperature: {
    temperatureTop: number | null;
    temperatureMiddle: number | null;
    temperatureBottom: number | null;
  } | null
) {
  if (!lastTemperature) {
    return true;
  }

  const values = [
    lastTemperature.temperatureTop,
    lastTemperature.temperatureMiddle,
    lastTemperature.temperatureBottom,
  ];

  if (values.some((value) => value === null)) {
    return true;
  }

  return values.some(
    (value) =>
      value !== null &&
      (value < 0 || value > 100)
  );
}

async function createCookingClosureCode(
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
    await prisma.cooking.count({
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

  return `ACTA-COC-${year}-${consecutive}`;
}

function isCookingEventType(
  value: string
): value is CookingEventType {
  return Object.values(
    CookingEventType
  ).includes(value as CookingEventType);
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

function getCookingEventLabel(
  type: CookingEventType
) {
  const labels: Record<
    CookingEventType,
    string
  > = {
    INICIO_COCCION: "▶️ Inicio de cocción",
    INICIO_VAPOR: "🔥 Inicio de vapor",
    TEMPERATURA: "🌡️ Temperatura",
    MIELES_AMARGAS: "🟠 Mieles amargas",
    MIELES_DULCES: "🟡 Mieles dulces",
    BAJAR_VAPOR: "⬇️ Disminuir vapor",
    AUMENTAR_VAPOR: "⬆️ Aumentar vapor",
    SUSPENDER_VAPOR: "⏸️ Suspender vapor",
    FIN_COCCION: "🏁 Cierre de cocción",
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