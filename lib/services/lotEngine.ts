import {
  Cooking,
  Milling,
  Fermentation,
  Distillation,
  Lot,
} from "@prisma/client";

type Priority = "BAJA" | "NORMAL" | "ALTA";

type LotWithProcess = Lot & {
  cookings: Cooking[];
  millings: Milling[];
  fermentations: Fermentation[];
  distillations: Distillation[];
};

export function getLotEngine(lot: LotWithProcess) {
  const hasCooking = lot.cookings.length > 0;
  const hasMilling = lot.millings.length > 0;
  const hasFermentation = lot.fermentations.length > 0;
  const hasDistillation = lot.distillations.length > 0;

  const lastCooking = lot.cookings.at(-1);
  const lastMilling = lot.millings.at(-1);
  const lastFermentation = lot.fermentations.at(-1);
  const lastDistillation = lot.distillations.at(-1);

  if (!hasCooking) {
    return {
      status: "🌱 Recepción",
      progress: 10,
      priority: "NORMAL" as Priority,
      nextAction: "Iniciar cocción",
      nextHref: "/cooking",
      message: "El agave está recibido. El siguiente paso es iniciar cocción.",
      advice: [
        "Verifica el peso del agave.",
        "Confirma ART, madurez y estado del agave.",
        "Prepara el horno antes de iniciar cocción.",
      ],
    };
  }

  if (lastCooking?.status !== "TERMINADA") {
    return {
      status: "🔥 En cocción",
      progress: 25,
      priority: "NORMAL" as Priority,
      nextAction: "Continuar cocción",
      nextHref: `/cooking/${lastCooking?.id}`,
      message: "El lote está en cocción. Vigila temperatura, mieles y tiempo.",
      advice: [
        "La cocción evoluciona normalmente.",
        "Verifica que los termómetros se mantengan cerca del objetivo.",
        "Revisa el nivel de gas y vapor.",
        "La siguiente operación será controlar mieles y tiempo de cocción.",
      ],
    };
  }

  if (!hasMilling) {
    return {
      status: "⚙️ Listo para molienda",
      progress: 40,
      priority: "ALTA" as Priority,
      nextAction: "Iniciar molienda",
      nextHref: "/milling",
      message: "La cocción terminó. El siguiente paso es molienda.",
      advice: [
        "Prepara desgarradora y prensa.",
        "Verifica agua disponible para extracción.",
        "Registra Brix inicial del mosto.",
        "Controla litros obtenidos desde el primer lavado.",
      ],
    };
  }

  if (lastMilling?.status !== "TERMINADA") {
    return {
      status: "⚙️ En molienda",
      progress: 50,
      priority: "NORMAL" as Priority,
      nextAction: "Continuar molienda",
      nextHref: `/milling/${lastMilling?.id}`,
      message: "El lote está en molienda. Registra Brix, pH, agua y bagazo.",
      advice: [
        "Registra Brix en cada etapa importante.",
        "Controla litros de agua agregados.",
        "Mide litros recuperados del lavado.",
        "Observa el bagazo para evaluar extracción.",
      ],
    };
  }

  if (!hasFermentation) {
    return {
      status: "🧪 Listo para fermentación",
      progress: 60,
      priority: "ALTA" as Priority,
      nextAction: "Iniciar fermentación",
      nextHref: "/fermentation",
      message: "La molienda terminó. El siguiente paso es fermentar el mosto.",
      advice: [
        "Verifica temperatura del mosto antes de inocular.",
        "Ajusta pH si está fuera de rango.",
        "Registra Brix inicial y litros de mosto.",
        "Prepara levadura y nutrientes según el volumen.",
      ],
    };
  }

  if (lastFermentation?.status !== "TERMINADA") {
    return {
      status: "🧪 Fermentando",
      progress: 75,
      priority: "NORMAL" as Priority,
      nextAction: "Registrar lectura",
      nextHref: `/fermentation/${lastFermentation?.id}`,
      message:
        "El lote está fermentando. Vigila Brix, pH, temperatura y alcohol.",
      advice: [
        "Registra una nueva lectura de Brix, pH y temperatura.",
        "Verifica que el Brix siga bajando.",
        "Observa espuma, olor y actividad de fermentación.",
        "Prepara destilación cuando el alcohol llegue al objetivo.",
      ],
    };
  }

  if (!hasDistillation) {
    return {
      status: "🥃 Listo para destilar",
      progress: 85,
      priority: "ALTA" as Priority,
      nextAction: "Iniciar destilación",
      nextHref: "/distillation",
      message: "La fermentación terminó. El siguiente paso es destilación.",
      advice: [
        "Prepara el alambique antes de cargar.",
        "Verifica que no haya fugas.",
        "Confirma volumen y alcohol del mosto fermentado.",
        "Define objetivo de destrozado o rectificación.",
      ],
    };
  }

  if (lastDistillation?.status !== "TERMINADA") {
    return {
      status: "🥃 Destilando",
      progress: 92,
      priority: "NORMAL" as Priority,
      nextAction: "Continuar destilación",
      nextHref: `/distillation/${lastDistillation?.id}`,
      message:
        "El lote está en destilación. Vigila alcohol, temperatura y cortes.",
      advice: [
        "Controla temperatura del alambique y salida.",
        "Registra grados alcohólicos con frecuencia.",
        "Cuida los cortes de cabezas, corazón y colas.",
        "Compara litros obtenidos contra el rendimiento esperado.",
      ],
    };
  }

  return {
    status: "🍾 Terminado",
    progress: 100,
    priority: "BAJA" as Priority,
    nextAction: "Ver resultados",
    nextHref: `/lots/${lot.id}/costs`,
    message: "El lote terminó. Revisa rendimiento, costos y aprendizaje.",
    advice: [
      "Revisa litros finales y alcohol obtenido.",
      "Calcula costo por litro y rendimiento.",
      "Documenta qué salió bien y qué se puede mejorar.",
      "Usa este lote como aprendizaje para el siguiente proceso.",
    ],
  };
}