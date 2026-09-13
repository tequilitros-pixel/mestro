import { formatBusinessDateTime } from "@/lib/dateTime";

export type CookingTemperatureReading = {
  temperatureTop: number | null;
  temperatureMiddle: number | null;
  temperatureBottom: number | null;
};

export type CookingHealth =
  | "ATENCION"
  | "CALENTANDO"
  | "LISTA"
  | "TERMINADA";

export function getCookingHealth({
  hasFinished,
  hasStartedVapor,
  lastTemperature,
}: {
  hasFinished: boolean;
  hasStartedVapor: boolean;
  lastTemperature: CookingTemperatureReading | null;
}): CookingHealth {
  if (hasFinished) return "TERMINADA";
  if (!hasStartedVapor || !lastTemperature) return "CALENTANDO";

  const values = [
    lastTemperature.temperatureTop,
    lastTemperature.temperatureMiddle,
    lastTemperature.temperatureBottom,
  ];
  const validValues = values.filter(
    (value): value is number => value !== null
  );

  if (validValues.length < 3) return "ATENCION";
  if (validValues.some((temperature) => temperature > 100 || temperature < 0)) {
    return "ATENCION";
  }
  if (validValues.every((temperature) => temperature >= 90)) return "LISTA";

  return "CALENTANDO";
}

export function getCookingHealthTitle(health: CookingHealth) {
  if (health === "ATENCION") return "Revisar las lecturas del horno";
  if (health === "LISTA") return "El horno alcanzó la temperatura objetivo";
  if (health === "TERMINADA") return "Proceso de cocción terminado";
  return "La cocción continúa en calentamiento";
}

export function buildCookingMessages({
  hasFinished,
  hasStartedVapor,
  lastTemperature,
  sweetHoneyLiters,
  lastSweetHoneyBrix,
}: {
  hasFinished: boolean;
  hasStartedVapor: boolean;
  lastTemperature: CookingTemperatureReading | null;
  sweetHoneyLiters: number;
  lastSweetHoneyBrix: number | null;
}) {
  if (hasFinished) {
    return [
      "La cocción está cerrada y su expediente permanece disponible para consulta.",
    ];
  }

  const messages = [
    hasStartedVapor
      ? "El inicio de vapor quedó registrado correctamente."
      : "El vapor aún no ha sido iniciado. El proceso permanece pendiente de calentamiento.",
  ];

  if (!lastTemperature) {
    messages.push(
      "Se necesita una lectura de temperatura superior, media e inferior para evaluar el horno."
    );
  } else {
    const top = lastTemperature.temperatureTop;
    const middle = lastTemperature.temperatureMiddle;
    const bottom = lastTemperature.temperatureBottom;

    if (top !== null && middle !== null && bottom !== null) {
      const difference =
        Math.max(top, middle, bottom) - Math.min(top, middle, bottom);

      messages.push(
        top >= 90 && middle >= 90 && bottom >= 90
          ? `Las tres zonas alcanzaron al menos 90 °C. La diferencia máxima entre zonas es de ${formatNumber(difference)} °C.`
          : `La última lectura es superior ${formatNumber(top)} °C, media ${formatNumber(middle)} °C e inferior ${formatNumber(bottom)} °C.`
      );
      messages.push(
        difference > 8
          ? "Existe una diferencia importante entre las zonas del horno. Revisa la distribución de vapor y el calentamiento."
          : "La distribución de temperatura entre las zonas se mantiene relativamente uniforme."
      );
    }
  }

  if (sweetHoneyLiters > 0) {
    messages.push(`Se han registrado ${formatNumber(sweetHoneyLiters)} litros de mieles dulces.`);
  }
  if (lastSweetHoneyBrix !== null) {
    messages.push(`El último registro de mieles dulces fue de ${formatNumber(lastSweetHoneyBrix)} °Brix.`);
  }

  return messages;
}

export function calculateCookingProgress({
  startedAt,
  finishedAt,
  hasFinished,
  referenceAt = new Date(),
}: {
  startedAt: Date;
  finishedAt: Date | null;
  hasFinished: boolean;
  referenceAt?: Date;
}) {
  const referenceDate = finishedAt ?? referenceAt;
  const elapsedMilliseconds = Math.max(
    0,
    referenceDate.getTime() - startedAt.getTime()
  );
  const targetMilliseconds = 32 * 60 * 60 * 1000;
  const percentage = hasFinished
    ? 100
    : Math.min(100, Math.max(0, Math.round((elapsedMilliseconds / targetMilliseconds) * 100)));

  return {
    percentage,
    duration: formatDuration(startedAt, referenceDate),
  };
}

export function getTemperatureStatus(
  lastTemperature: CookingTemperatureReading | null
) {
  if (!lastTemperature) return "SIN LECTURA";
  const { temperatureTop: top, temperatureMiddle: middle, temperatureBottom: bottom } =
    lastTemperature;
  if (top === null || middle === null || bottom === null) return "INCOMPLETA";
  return top >= 90 && middle >= 90 && bottom >= 90 ? "EN RANGO" : "CALENTANDO";
}

export function isTemperatureWarning(
  lastTemperature: CookingTemperatureReading | null
) {
  if (!lastTemperature) return true;
  const values = [
    lastTemperature.temperatureTop,
    lastTemperature.temperatureMiddle,
    lastTemperature.temperatureBottom,
  ];
  return values.some((value) => value === null || value < 0 || value > 100);
}

export function formatNumber(
  value: number | string | null | undefined,
  maximumFractionDigits = 2
) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits }).format(number);
}

export function formatDateTime(date: Date) {
  return formatBusinessDateTime(date);
}

export function formatDuration(start: Date, end: Date) {
  const totalMinutes = Math.floor(
    Math.max(0, end.getTime() - start.getTime()) / 1000 / 60
  );
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} d`);
  if (hours > 0) parts.push(`${hours} h`);
  parts.push(`${minutes} min`);
  return parts.join(" ");
}

export function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
