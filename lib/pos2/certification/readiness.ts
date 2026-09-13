export type ReadinessInput = {
  migrationDrift: boolean;
  staleInProgressReceipts: number;
  failedOutboxEvents: number;
  processingOutboxEvents: number;
  inventoryMismatches: number;
  paymentMismatches: number;
  orphanSales: number;
  openPilotRegisters: number;
};

export type ReadinessCheck = { key: keyof ReadinessInput; value: number | boolean; pass: boolean; severity: "BLOCKER" | "WARNING" };

export function evaluatePilotReadiness(input: ReadinessInput) {
  const checks: ReadinessCheck[] = [
    { key: "migrationDrift", value: input.migrationDrift, pass: !input.migrationDrift, severity: "BLOCKER" },
    { key: "staleInProgressReceipts", value: input.staleInProgressReceipts, pass: input.staleInProgressReceipts === 0, severity: "BLOCKER" },
    { key: "failedOutboxEvents", value: input.failedOutboxEvents, pass: input.failedOutboxEvents === 0, severity: "WARNING" },
    { key: "processingOutboxEvents", value: input.processingOutboxEvents, pass: input.processingOutboxEvents === 0, severity: "WARNING" },
    { key: "inventoryMismatches", value: input.inventoryMismatches, pass: input.inventoryMismatches === 0, severity: "BLOCKER" },
    { key: "paymentMismatches", value: input.paymentMismatches, pass: input.paymentMismatches === 0, severity: "BLOCKER" },
    { key: "orphanSales", value: input.orphanSales, pass: input.orphanSales === 0, severity: "BLOCKER" },
    { key: "openPilotRegisters", value: input.openPilotRegisters, pass: input.openPilotRegisters <= 1, severity: "WARNING" },
  ];
  return { status: checks.some((check) => !check.pass && check.severity === "BLOCKER") ? "FAIL" as const : checks.some((check) => !check.pass) ? "WARN" as const : "PASS" as const, checks };
}
