export type EffectiveClockEventType =
  | "CLOCK_IN"
  | "BREAK_START"
  | "BREAK_END"
  | "CLOCK_OUT";

export type ObservedClockEvent = {
  id: string;
  type: EffectiveClockEventType;
  occurredAt: Date;
};

export type EffectiveClockCorrection = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  type: "MODIFY_OCCURRED_TIME" | "ADD_MISSING_EVENT" | "VOID_EVENT";
  targetClockEventId?: string | null;
  proposedEventType?: EffectiveClockEventType | null;
  proposedOccurredAt?: Date | null;
};

export type EffectiveClockEvent = {
  source: "OBSERVED" | "CORRECTION";
  sourceId: string;
  originalClockEventId: string | null;
  type: EffectiveClockEventType;
  occurredAt: Date;
};

export function buildEffectiveClockStream(
  observed: ObservedClockEvent[],
  corrections: EffectiveClockCorrection[],
): EffectiveClockEvent[] {
  const stream = new Map<string, EffectiveClockEvent>();

  for (const event of observed) {
    stream.set(event.id, {
      source: "OBSERVED",
      sourceId: event.id,
      originalClockEventId: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
    });
  }

  for (const correction of corrections) {
    if (correction.status !== "APPROVED") continue;

    if (correction.type === "VOID_EVENT") {
      if (!correction.targetClockEventId) {
        throw new Error("VOID_EVENT requires targetClockEventId");
      }
      stream.delete(correction.targetClockEventId);
      continue;
    }

    if (correction.type === "MODIFY_OCCURRED_TIME") {
      if (!correction.targetClockEventId || !correction.proposedOccurredAt) {
        throw new Error(
          "MODIFY_OCCURRED_TIME requires a target and proposed time",
        );
      }
      const target = stream.get(correction.targetClockEventId);
      if (!target) throw new Error("Correction target is not in observed stream");
      stream.set(correction.targetClockEventId, {
        ...target,
        source: "CORRECTION",
        sourceId: correction.id,
        occurredAt: correction.proposedOccurredAt,
      });
      continue;
    }

    if (!correction.proposedEventType || !correction.proposedOccurredAt) {
      throw new Error("ADD_MISSING_EVENT requires an event type and time");
    }
    stream.set(`correction:${correction.id}`, {
      source: "CORRECTION",
      sourceId: correction.id,
      originalClockEventId: null,
      type: correction.proposedEventType,
      occurredAt: correction.proposedOccurredAt,
    });
  }

  return [...stream.values()].sort(
    (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
  );
}
