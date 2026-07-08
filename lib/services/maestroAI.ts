import { Lot } from "@prisma/client";

type MaestroInput = {
  lots: Lot[];
};

export function getMaestroAdvice({ lots }: MaestroInput) {
  const activeLots = lots.filter((lot) => lot.stage !== "TERMINADO");

  if (activeLots.length === 0) {
    return {
      status: "🟢 Planta tranquila",
      message: "No hay lotes activos en proceso.",
      actions: [
        "Crear un nuevo lote cuando recibas agave.",
        "Revisar costos históricos.",
        "Verificar limpieza y disponibilidad de equipos.",
      ],
    };
  }

  const cookingLots = activeLots.filter((lot) => lot.stage === "COCCION");
  const fermentationLots = activeLots.filter(
    (lot) => lot.stage === "FERMENTACION"
  );
  const distillationLots = activeLots.filter(
    (lot) => lot.stage === "DESTILACION"
  );

  const actions: string[] = [];

  if (cookingLots.length > 0) {
    actions.push(`Vigilar ${cookingLots.length} lote(s) en cocción.`);
  }

  if (fermentationLots.length > 0) {
    actions.push(`Registrar lectura de ${fermentationLots.length} fermentación(es).`);
  }

  if (distillationLots.length > 0) {
    actions.push(`Monitorear ${distillationLots.length} destilación(es).`);
  }

  if (actions.length === 0) {
    actions.push("Revisar el avance de los lotes activos.");
  }

  return {
    status: "🧠 MAESTRO activo",
    message: `Hay ${activeLots.length} lote(s) activos en la planta.`,
    actions,
  };
}