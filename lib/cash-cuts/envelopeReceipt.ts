export type AutomaticEnvelopeReceiptInput = {
  amount: number;
  userId: string;
  cashCutId: string;
  receivedAt?: Date;
  notes?: string;
};

/**
 * Convierte el monto capturado al cerrar el corte en una recepción completa.
 * No altera el saldo: confirma que el mismo dinero declarado para el sobre ya
 * forma parte de la caja fuerte y deja un movimiento inmutable de auditoría.
 */
export function buildAutomaticEnvelopeReceipt({
  amount,
  userId,
  cashCutId,
  receivedAt = new Date(),
  notes = "Recepción automática al cerrar el corte",
}: AutomaticEnvelopeReceiptInput) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El monto del sobre debe ser mayor que cero");
  }

  return {
    envelope: {
      status: "EN_CAJA_FUERTE" as const,
      receivedAmount: amount,
      receivedById: userId,
      receivedAt,
    },
    movement: {
      type: "RECEPCION" as const,
      amount,
      previousBalance: amount,
      newBalance: amount,
      cashCutId,
      userId,
      notes,
      createdAt: receivedAt,
    },
  };
}
