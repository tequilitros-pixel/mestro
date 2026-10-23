export type StockBranchOption = {
  id: string;
  name: string;
};

export type StockBranchSelection =
  | {
      requestedBranchId: string | null;
      branch: StockBranchOption | null;
      rejected: false;
    }
  | {
      requestedBranchId: string;
      branch: null;
      rejected: true;
    };

/**
 * `branches` must already be constrained by the server-side access query.
 * An explicit branch that is absent from that list is rejected instead of
 * silently falling back to a global matrix.
 */
export function resolveStockBranchSelection(
  branches: readonly StockBranchOption[],
  requestedBranchId?: string,
): StockBranchSelection {
  const requested = requestedBranchId?.trim() || null;

  if (!requested) {
    return {
      requestedBranchId: null,
      branch: branches[0] ?? null,
      rejected: false,
    };
  }

  const branch = branches.find((candidate) => candidate.id === requested);
  if (!branch) {
    return { requestedBranchId: requested, branch: null, rejected: true };
  }

  return { requestedBranchId: requested, branch, rejected: false };
}

export type StockAlert = "NEGATIVE" | "LOW" | "OK";

export function classifyStock(quantity: number, minimum: number): StockAlert {
  if (quantity < 0) return "NEGATIVE";
  if (minimum > 0 && quantity < minimum) return "LOW";
  return "OK";
}

/**
 * Cantidad que se necesita reponer para alcanzar el mínimo operativo de una
 * sucursal. No redondea ni altera el saldo: solo prepara la lista de surtido.
 */
export function getStockShortfall(quantity: number, minimum: number): number {
  const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
  const safeMinimum = Number.isFinite(minimum) && minimum > 0 ? minimum : 0;
  return Math.max(0, safeMinimum - safeQuantity);
}
