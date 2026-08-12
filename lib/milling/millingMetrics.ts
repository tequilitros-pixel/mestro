export type MillingDischarge = {
  litersRecovered: number;
  brix: number;
  ph: number;
  temperature: number;
};

export type MillingHealth = "ATENCION" | "ACTIVA" | "LISTA" | "TERMINADA";

export function weightedAverage(
  items: MillingDischarge[],
  getValue: (item: MillingDischarge) => number
) {
  const totalLiters = items.reduce((sum, item) => sum + item.litersRecovered, 0);
  if (totalLiters <= 0) return null;
  return items.reduce(
    (sum, item) => sum + item.litersRecovered * getValue(item),
    0
  ) / totalLiters;
}

export function getMillingHealth({
  hasFinished,
  dischargesCount,
  totalLiters,
  averageBrix,
  averagePh,
  averageTemperature,
}: {
  hasFinished: boolean;
  dischargesCount: number;
  totalLiters: number;
  averageBrix: number | null;
  averagePh: number | null;
  averageTemperature: number | null;
}): MillingHealth {
  if (hasFinished) return "TERMINADA";
  if (averagePh !== null && (averagePh < 3 || averagePh > 6)) return "ATENCION";
  if (averageTemperature !== null && averageTemperature > 40) return "ATENCION";
  if (
    dischargesCount > 0 && totalLiters > 0 && averageBrix !== null &&
    averagePh !== null && averageTemperature !== null
  ) return "LISTA";
  return "ACTIVA";
}

export function getMillingHealthTitle(status: MillingHealth) {
  if (status === "ATENCION") return "Revisar las condiciones del mosto";
  if (status === "LISTA") return "La molienda tiene datos suficientes para cerrar";
  if (status === "TERMINADA") return "Proceso de molienda terminado";
  return "La molienda continúa activa";
}

export function buildMillingMessages({
  hasFinished, totalLiters, dischargesCount, averageBrix, averagePh,
  averageTemperature, tanksUsed, formatNumber,
}: {
  hasFinished: boolean;
  totalLiters: number;
  dischargesCount: number;
  averageBrix: number | null;
  averagePh: number | null;
  averageTemperature: number | null;
  tanksUsed: string[];
  formatNumber: (value: number) => string;
}) {
  if (hasFinished) return ["La molienda está cerrada y su expediente permanece disponible para consulta."];
  const messages: string[] = [
    dischargesCount === 0
      ? "Todavía no existen descargas registradas hacia fermentación."
      : `Se han registrado ${dischargesCount} descargas con un total de ${formatNumber(totalLiters)} litros de mosto.`,
  ];
  if (averageBrix !== null) messages.push(`El °Brix promedio ponderado es de ${formatNumber(averageBrix)}.`);
  if (averagePh !== null) messages.push(
    averagePh < 3 || averagePh > 6
      ? `El pH promedio es de ${formatNumber(averagePh)} y conviene verificar las mediciones antes de iniciar fermentación.`
      : `El pH promedio se encuentra en ${formatNumber(averagePh)}.`
  );
  if (averageTemperature !== null) messages.push(`La temperatura promedio del mosto es de ${formatNumber(averageTemperature)} °C.`);
  if (tanksUsed.length > 0) messages.push(`El mosto fue distribuido en: ${tanksUsed.join(", ")}.`);
  return messages;
}
