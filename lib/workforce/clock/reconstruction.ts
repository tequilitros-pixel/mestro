import type { ClockType, EffectiveClockEvent } from "./effectiveStream";

export type ClockState = "NO_SESSION" | "CLOCKED_IN" | "ON_BREAK";
export function nextClockType(state: ClockState): ClockType {
  return state === "NO_SESSION"
    ? "CLOCK_IN"
    : state === "CLOCKED_IN"
      ? "BREAK_START"
      : "BREAK_END";
}
export function allowedClockTypes(state: ClockState): ClockType[] {
  return state === "NO_SESSION"
    ? ["CLOCK_IN"]
    : state === "CLOCKED_IN"
      ? ["BREAK_START", "CLOCK_OUT"]
      : ["BREAK_END"];
}
export function assertTransition(state: ClockState, type: ClockType) {
  if (!allowedClockTypes(state).includes(type))
    throw new Error(`INVALID_TRANSITION: ${state} → ${type}`);
}
export function clockState(events: EffectiveClockEvent[]): ClockState {
  let state: ClockState = "NO_SESSION";
  for (const event of events) {
    assertTransition(state, event.type);
    state =
      event.type === "CLOCK_IN" || event.type === "BREAK_END"
        ? "CLOCKED_IN"
        : event.type === "BREAK_START"
          ? "ON_BREAK"
          : "NO_SESSION";
  }
  return state;
}
export type ReconstructedSession = {
  key: string;
  employmentId: string;
  branchId: string;
  startedAt: Date | null;
  endedAt: Date | null;
  workedMinutes: number;
  breakMinutes: number;
  status: "OPEN" | "COMPLETE" | "INCOMPLETE";
  events: EffectiveClockEvent[];
};
export function reconstructWorkSessions(
  events: EffectiveClockEvent[],
): ReconstructedSession[] {
  const sessions: ReconstructedSession[] = [];
  let current: EffectiveClockEvent[] = [];
  let invalid = false;
  const finish = (forceIncomplete = false) => {
    if (!current.length) return;
    const first = current.find((e) => e.type === "CLOCK_IN") ?? current[0];
    const last = current.at(-1)!;
    let breakMs = 0,
      breakStart: Date | null = null;
    for (const event of current) {
      if (event.type === "BREAK_START") breakStart = event.occurredAt;
      else if (event.type === "BREAK_END" && breakStart) {
        breakMs += event.occurredAt.getTime() - breakStart.getTime();
        breakStart = null;
      }
    }
    const ended = last.type === "CLOCK_OUT" ? last.occurredAt : null;
    const incomplete =
      forceIncomplete ||
      invalid ||
      !current.some((e) => e.type === "CLOCK_IN") ||
      Boolean(breakStart);
    const total =
      ended && first.type === "CLOCK_IN"
        ? Math.max(0, ended.getTime() - first.occurredAt.getTime())
        : 0;
    sessions.push({
      key: first.sourceId,
      employmentId: first.employmentId,
      branchId: first.branchId,
      startedAt: first.type === "CLOCK_IN" ? first.occurredAt : null,
      endedAt: ended,
      workedMinutes: Math.max(0, Math.round((total - breakMs) / 60000)),
      breakMinutes: Math.max(0, Math.round(breakMs / 60000)),
      status: ended
        ? incomplete
          ? "INCOMPLETE"
          : "COMPLETE"
        : incomplete
          ? "INCOMPLETE"
          : "OPEN",
      events: current,
    });
    current = [];
    invalid = false;
  };
  let state: ClockState = "NO_SESSION";
  for (const event of events) {
    if (event.type === "CLOCK_IN" && current.length) {
      finish(true);
      state = "NO_SESSION";
    }
    try {
      assertTransition(state, event.type);
    } catch {
      invalid = true;
    }
    current.push(event);
    state =
      event.type === "CLOCK_IN" || event.type === "BREAK_END"
        ? "CLOCKED_IN"
        : event.type === "BREAK_START"
          ? "ON_BREAK"
          : "NO_SESSION";
    if (event.type === "CLOCK_OUT") finish();
  }
  finish(state !== "CLOCKED_IN");
  return sessions;
}
