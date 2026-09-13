export type ClockType = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";
export type ObservedClockEvent = {
  id: string;
  employmentId: string;
  branchId: string;
  type: ClockType;
  occurredAt: Date;
};
export type EffectiveClockCorrection = {
  id: string;
  employmentId: string;
  requestedAt: Date;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  type: "MODIFY_OCCURRED_TIME" | "ADD_MISSING_EVENT" | "VOID_EVENT";
  targetClockEventId?: string | null;
  targetCorrectionId?: string | null;
  branchId?: string | null;
  proposedEventType?: ClockType | null;
  proposedOccurredAt?: Date | null;
};
export type EffectiveClockEvent = {
  source: "OBSERVED" | "CORRECTION";
  sourceId: string;
  originalClockEventId: string | null;
  employmentId: string;
  branchId: string;
  type: ClockType;
  occurredAt: Date;
};

const typeOrder: Record<ClockType, number> = {
  CLOCK_IN: 0,
  BREAK_START: 1,
  BREAK_END: 2,
  CLOCK_OUT: 3,
};
export function buildEffectiveClockStream(
  observed: ObservedClockEvent[],
  corrections: EffectiveClockCorrection[],
): EffectiveClockEvent[] {
  const stream = new Map<string, EffectiveClockEvent>();
  for (const event of observed)
    stream.set(event.id, {
      ...event,
      source: "OBSERVED",
      sourceId: event.id,
      originalClockEventId: event.id,
    });
  for (const correction of [...corrections].sort(
    (a, b) =>
      a.requestedAt.getTime() - b.requestedAt.getTime() ||
      a.id.localeCompare(b.id),
  )) {
    if (correction.status !== "APPROVED") continue;
    if (correction.type === "VOID_EVENT") {
      const key =
        correction.targetClockEventId ??
        (correction.targetCorrectionId
          ? `correction:${correction.targetCorrectionId}`
          : null);
      if (!key) throw new Error("VOID_EVENT requires a target");
      stream.delete(key);
      continue;
    }
    if (correction.type === "MODIFY_OCCURRED_TIME") {
      const key =
        correction.targetClockEventId ??
        (correction.targetCorrectionId
          ? `correction:${correction.targetCorrectionId}`
          : null);
      if (!key || !correction.proposedOccurredAt)
        throw new Error("MODIFY_OCCURRED_TIME requires target and time");
      const target = stream.get(key);
      if (!target) throw new Error("Correction target not found");
      stream.set(key, {
        ...target,
        source: "CORRECTION",
        sourceId: correction.id,
        occurredAt: correction.proposedOccurredAt,
      });
      continue;
    }
    if (
      !correction.proposedEventType ||
      !correction.proposedOccurredAt ||
      !correction.branchId
    )
      throw new Error("ADD_MISSING_EVENT requires type, time and branch");
    stream.set(`correction:${correction.id}`, {
      source: "CORRECTION",
      sourceId: correction.id,
      originalClockEventId: null,
      employmentId: correction.employmentId,
      branchId: correction.branchId,
      type: correction.proposedEventType,
      occurredAt: correction.proposedOccurredAt,
    });
  }
  return [...stream.values()].sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      typeOrder[a.type] - typeOrder[b.type] ||
      a.source.localeCompare(b.source) ||
      a.sourceId.localeCompare(b.sourceId),
  );
}
