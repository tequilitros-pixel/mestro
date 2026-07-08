type AlertLevel = "OK" | "INFO" | "WARNING" | "DANGER";

type ProcessAlert = {
  level: AlertLevel;
  title: string;
  message: string;
};

export function getFermentationAlerts({
  brix,
  ph,
  temperature,
}: {
  brix: number | null;
  ph: number | null;
  temperature: number | null;
}): ProcessAlert[] {
  const alerts: ProcessAlert[] = [];

  if (brix !== null && brix <= 2) {
    alerts.push({
      level: "OK",
      title: "Lista para destilar",
      message: "El °Brix ya está en rango final.",
    });
  }

  if (ph !== null && ph > 5) {
    alerts.push({
      level: "WARNING",
      title: "pH alto",
      message: "Revisar acidez antes de continuar.",
    });
  }

  if (temperature !== null && temperature > 35) {
    alerts.push({
      level: "DANGER",
      title: "Temperatura alta",
      message: "Riesgo de afectar la fermentación.",
    });
  }

  return alerts;
}

export function getDistillationAlerts({
  alcoholCorrected,
  outputTemperature,
}: {
  alcoholCorrected: number | null;
  outputTemperature: number | null;
}): ProcessAlert[] {
  const alerts: ProcessAlert[] = [];

  if (alcoholCorrected !== null && alcoholCorrected < 40) {
    alerts.push({
      level: "WARNING",
      title: "Preparar corte a colas",
      message: "El alcohol corregido ya bajó de 40%.",
    });
  }

  if (outputTemperature !== null && outputTemperature > 30) {
    alerts.push({
      level: "WARNING",
      title: "Temperatura de salida alta",
      message: "Revisar condensador o enfriamiento.",
    });
  }

  return alerts;
}