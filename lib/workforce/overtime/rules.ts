export type JornadaType = "DAY" | "NIGHT" | "MIXED";

export type OvertimeLegalPolicy = {
  version: string;
  ordinaryDailyLimitMinutes: Record<JornadaType, number>;
  weeklyDoubleLimitMinutes: number;
};

export type OvertimeInputLine = {
  timesheetLineId: string;
  businessDate: Date;
  approvedMinutes: number;
};

export type JornadaPolicyRange = {
  id: string;
  jornadaType: JornadaType;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export function resolveJornadaForDate(date: Date, policies: JornadaPolicyRange[]) {
  const key = dateKey(date);
  const matches = policies.filter(
    (policy) =>
      dateKey(policy.effectiveFrom) <= key &&
      (!policy.effectiveTo || dateKey(policy.effectiveTo) >= key),
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `JORNADA_POLICY_MISSING:${key}`
        : `JORNADA_POLICY_OVERLAP:${key}`,
    );
  }
  return matches[0];
}

export function classifyOvertimeWeek(input: {
  lines: OvertimeInputLine[];
  jornadaPolicies: JornadaPolicyRange[];
  legalPolicy: OvertimeLegalPolicy;
}) {
  const ordered = [...input.lines].sort(
    (a, b) => a.businessDate.getTime() - b.businessDate.getTime(),
  );
  let weeklyOvertime = 0;
  const lines = ordered.map((line) => {
    if (!Number.isInteger(line.approvedMinutes) || line.approvedMinutes < 0)
      throw new Error("APPROVED_MINUTES_INVALID");
    const jornada = resolveJornadaForDate(line.businessDate, input.jornadaPolicies);
    const ordinaryLimitMinutes =
      input.legalPolicy.ordinaryDailyLimitMinutes[jornada.jornadaType];
    const ordinaryMinutes = Math.min(line.approvedMinutes, ordinaryLimitMinutes);
    const overtimeCandidateMinutes = line.approvedMinutes - ordinaryMinutes;
    const weeklyOvertimeBeforeMinutes = weeklyOvertime;
    const remainingDoubleBeforeMinutes = Math.max(
      0,
      input.legalPolicy.weeklyDoubleLimitMinutes - weeklyOvertime,
    );
    const doubleMinutes = Math.min(
      overtimeCandidateMinutes,
      remainingDoubleBeforeMinutes,
    );
    const tripleMinutes = overtimeCandidateMinutes - doubleMinutes;
    weeklyOvertime += overtimeCandidateMinutes;
    return {
      ...line,
      jornadaType: jornada.jornadaType,
      jornadaPolicyId: jornada.id,
      ordinaryLimitMinutes,
      ordinaryMinutes,
      overtimeCandidateMinutes,
      doubleMinutes,
      tripleMinutes,
      weeklyOvertimeBeforeMinutes,
      remainingDoubleBeforeMinutes,
      explanation: `${dateKey(line.businessDate)}: ${line.approvedMinutes} min aprobados; límite ${jornada.jornadaType} ${ordinaryLimitMinutes} min; extra previo semanal ${weeklyOvertimeBeforeMinutes} min; saldo doble ${remainingDoubleBeforeMinutes} min; resultado ${ordinaryMinutes} ordinarios, ${doubleMinutes} dobles y ${tripleMinutes} triples.`,
    };
  });
  const totals = lines.reduce(
    (sum, line) => ({
      approvedMinutes: sum.approvedMinutes + line.approvedMinutes,
      ordinaryMinutes: sum.ordinaryMinutes + line.ordinaryMinutes,
      doubleMinutes: sum.doubleMinutes + line.doubleMinutes,
      tripleMinutes: sum.tripleMinutes + line.tripleMinutes,
    }),
    { approvedMinutes: 0, ordinaryMinutes: 0, doubleMinutes: 0, tripleMinutes: 0 },
  );
  if (
    totals.ordinaryMinutes + totals.doubleMinutes + totals.tripleMinutes !==
    totals.approvedMinutes
  )
    throw new Error("OVERTIME_RECONCILIATION_FAILED");
  return {
    policyVersion: input.legalPolicy.version,
    weeklyDoubleLimitMinutes: input.legalPolicy.weeklyDoubleLimitMinutes,
    lines,
    ...totals,
  };
}
