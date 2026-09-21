export type LotFinalizationRun = {
  type: string;
  status: string;
  finalLiters: number | null;
};

export type LotFinalization =
  | { ready: true; totalLiters: number }
  | {
      ready: false;
      reason:
        | "ALREADY_FINISHED"
        | "LOT_STAGE_INCOMPLETE"
        | "ACTIVE_RUNS"
        | "NO_RECTIFICATION"
        | "MISSING_FINAL_LITERS";
    };

export function getLotFinalization(input: {
  stage: string;
  finishedAt: Date | null;
  totalLitersObtained: number | null;
  runs: LotFinalizationRun[];
}): LotFinalization {
  if (input.finishedAt && input.totalLitersObtained !== null) {
    return { ready: false, reason: "ALREADY_FINISHED" };
  }

  if (input.stage !== "TERMINADO") {
    return { ready: false, reason: "LOT_STAGE_INCOMPLETE" };
  }

  if (input.runs.some((run) => run.status === "ACTIVA")) {
    return { ready: false, reason: "ACTIVE_RUNS" };
  }

  const rectifications = input.runs.filter(
    (run) => run.type === "RECTIFICACION" && run.status === "TERMINADA",
  );
  if (rectifications.length === 0) {
    return { ready: false, reason: "NO_RECTIFICATION" };
  }

  const totalLiters = rectifications.reduce(
    (sum, run) => sum + (run.finalLiters ?? 0),
    0,
  );
  if (totalLiters <= 0) {
    return { ready: false, reason: "MISSING_FINAL_LITERS" };
  }

  return { ready: true, totalLiters };
}
