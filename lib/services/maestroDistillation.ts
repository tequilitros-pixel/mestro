export function getMasterAdvice(
  temperature: number | null,
  alcohol: number | null,
  corrected: number | null
) {
  if (temperature === null) {
    return {
      title: "Esperando datos",
      color: "text-on-surface-variant",
      message: "Registra la primera temperatura.",
    };
  }

  if (temperature < 78) {
    return {
      title: "Calentando",
      color: "text-on-surface-variant",
      message: "Continúa calentando el alambique.",
    };
  }

  if (temperature >= 78 && alcohol === null) {
    return {
      title: "Punto de salida",
      color: "text-secondary",
      message:
        "El alcohol comenzará a salir. Vigila el condensador.",
    };
  }

  if (corrected !== null && corrected > 60) {
    return {
      title: "Cortando cabezas",
      color: "text-secondary",
      message:
        "Continúa descartando cabezas hasta estabilizar el alcohol.",
    };
  }

  if (corrected !== null && corrected >= 45) {
    return {
      title: "Corazón",
      color: "text-tertiary-fixed-dim",
      message:
        "Mantén el corte de corazón. Esta es la mejor fracción.",
    };
  }

  if (corrected !== null && corrected >= 20) {
    return {
      title: "Colas",
      color: "text-secondary",
      message:
        "El alcohol comienza a caer. Prepárate para finalizar.",
    };
  }

  return {
    title: "Finalizar",
    color: "text-error",
    message:
      "El alcohol es muy bajo. Se recomienda terminar la destilación.",
  };
}