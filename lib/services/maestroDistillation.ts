import { DistillationEvent } from "@prisma/client";

export function getMasterAdvice(
  temperature: number | null,
  alcohol: number | null,
  corrected: number | null,
  events: DistillationEvent[]
) {if (temperature === null) {
  return {
    title: "Esperando datos",
    color: "text-slate-400",
    message: "Registra la primera temperatura.",
  };
}
  if (temperature === null) {
    return {
      title: "Esperando datos",
      color: "text-slate-400",
      message: "Registra la primera temperatura.",
    };
  }

  if (temperature < 78) {
    return {
      title: "🔥 Calentando",
      color: "text-amber-400",
      message: "Continúa calentando el alambique.",
    };
  }

  if (temperature >= 78 && alcohol === null) {
    return {
      title: "🥃 Punto de salida",
      color: "text-yellow-300",
      message:
        "El alcohol comenzará a salir. Vigila el condensador.",
    };
  }

  if (corrected !== null && corrected > 60) {
    return {
      title: "✂️ Cortando cabezas",
      color: "text-red-400",
      message:
        "Continúa descartando cabezas hasta estabilizar el alcohol.",
    };
  }

  if (corrected !== null && corrected >= 45) {
    return {
      title: "❤️ Corazón",
      color: "text-green-400",
      message:
        "Mantén el corte de corazón. Esta es la mejor fracción.",
    };
  }

  if (corrected !== null && corrected >= 20) {
    return {
      title: "🟤 Colas",
      color: "text-orange-400",
      message:
        "El alcohol comienza a caer. Prepárate para finalizar.",
    };
  }

  return {
    title: "🏁 Finalizar",
    color: "text-red-500",
    message:
      "El alcohol es muy bajo. Se recomienda terminar la destilación.",
  };
}