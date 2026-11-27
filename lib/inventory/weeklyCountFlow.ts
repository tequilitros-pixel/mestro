// Read-only reconstruction of the period between physical counts, in ledger base units.
export type WeeklyFlowMovement = {
  inventoryProductId: string;
  unit: string;
  movementType: string;
  quantityDelta: number;
  balanceBefore: number;
  createdAt: Date;
  sourceType: string;
  sourceId: string;
};

export type WeeklyCountFlow = {
  initialQuantity: number;
  entriesQuantity: number;
  quantityConsumed: number;
  otherQuantity: number;
  reconciles: boolean;
};

export function calculateWeeklyCountFlow(input: {
  productId: string;
  unit: string;
  countId: string;
  initialQuantity: number | null;
  start: Date | null;
  end: Date;
  expectedQuantity: number;
  movements: WeeklyFlowMovement[];
}): WeeklyCountFlow | null {
  const rows = input.movements.filter((row) =>
    row.inventoryProductId === input.productId &&
    (!input.start || row.createdAt > input.start) && row.createdAt <= input.end &&
    !(row.sourceType === "COUNT" && row.sourceId === input.countId),
  ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let initial = input.initialQuantity;
  let relevant = rows;
  if (initial === null) {
    // No prior physical count: only a recorded opening balance establishes a baseline.
    const opening = rows.findIndex((row) => row.movementType === "OPENING_BALANCE");
    if (opening < 0) return null;
    initial = rows[opening].balanceBefore + rows[opening].quantityDelta;
    relevant = rows.slice(opening + 1);
  }
  if (!Number.isFinite(initial) || !Number.isFinite(input.expectedQuantity) ||
      relevant.some((row) => row.unit !== input.unit || !Number.isFinite(row.quantityDelta)) ||
      (input.initialQuantity === null && rows.find((row) => row.movementType === "OPENING_BALANCE")?.unit !== input.unit)) return null;

  let entries = 0;
  let consumed = 0;
  let other = 0;
  for (const row of relevant) {
    switch (row.movementType) {
      case "RECEIPT":
      case "TRANSFER_IN":
        entries += row.quantityDelta;
        break;
      case "SALE_CONSUMPTION":
      case "SALE_REVERSAL":
        // Keep net returns even if they refer to sales from an earlier week.
        consumed -= row.quantityDelta;
        break;
      default:
        // Transfers out, events, adjustments and other count corrections are not POS consumption.
        other += row.quantityDelta;
    }
  }
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    initialQuantity: round(initial),
    entriesQuantity: round(entries),
    quantityConsumed: round(consumed),
    otherQuantity: round(other),
    reconciles: Math.abs(initial + entries - consumed + other - input.expectedQuantity) <= 0.002,
  };
}
