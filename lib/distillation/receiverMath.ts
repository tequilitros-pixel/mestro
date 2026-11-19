/**
 * Physical stock of one reception cycle. Only non-cancelled charges have
 * left the tank; the original incoming transfers remain immutable.
 */
export function receiverTotals(receiver: {
  transfers: { liters: number; alcohol: number | null }[];
  rectifications: { loadedLiters: number; status: string }[];
}) {
  const receivedLiters = receiver.transfers.reduce((sum, item) => sum + item.liters, 0);
  const allocatedLiters = receiver.rectifications
    .filter((run) => run.status !== "CANCELADA")
    .reduce((sum, item) => sum + item.loadedLiters, 0);
  const allMeasured = receiver.transfers.every((item) => item.alcohol !== null);
  const initialAlcohol = receivedLiters > 0 && allMeasured
    ? receiver.transfers.reduce((sum, item) => sum + item.liters * (item.alcohol ?? 0), 0) / receivedLiters
    : null;
  return {
    receivedLiters,
    allocatedLiters,
    availableLiters: Math.max(0, receivedLiters - allocatedLiters),
    initialAlcohol,
  };
}
