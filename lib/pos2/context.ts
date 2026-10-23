import type { PosContextDto } from "./ui/types";
import { isPos2ContextEnabled, type Pos2RolloutConfig } from "./certification/rollout";

export type Pos2ContextBranch = {
  id: string;
  name: string;
  registers: Array<{ id: string; name: string }>;
  terminals: Array<{ id: string; name: string; status: "ACTIVE" | "DISABLED" | "REVOKED" }>;
  cashSessionsV2: Array<{ id: string; registerId: string; openingTerminalId: string; status: "OPEN" | "CLOSING" | "CLOSED" | "CANCELLED" }>;
  cashCuts: Array<{ id: string }>;
};

export function buildPos2Contexts(
  branches: readonly Pos2ContextBranch[],
  rollout: Pos2RolloutConfig,
): PosContextDto[] {
  return branches.flatMap((branch) => {
    const legacyOpenCashCutId = branch.cashCuts[0]?.id ?? null;

    return branch.registers
      .filter((register) => isPos2ContextEnabled(rollout, branch.id, register.id))
      .flatMap((register): PosContextDto[] => {
        const session = branch.cashSessionsV2.find((item) => item.registerId === register.id);

        if (session && (session.status === "OPEN" || session.status === "CLOSING")) {
          const terminal = branch.terminals.find((item) => item.id === session.openingTerminalId);
          if (!terminal) return [];
          return [{
            branchId: branch.id,
            branchName: branch.name,
            registerId: register.id,
            registerName: register.name,
            terminalId: terminal.id,
            terminalName: terminal.name,
            terminalStatus: terminal.status,
            cashSessionId: session.id,
            cashSessionStatus: session.status,
            legacyOpenCashCutId,
          }];
        }

        return branch.terminals
          .filter((terminal) => terminal.status === "ACTIVE")
          .map((terminal): PosContextDto => ({
            branchId: branch.id,
            branchName: branch.name,
            registerId: register.id,
            registerName: register.name,
            terminalId: terminal.id,
            terminalName: terminal.name,
            terminalStatus: terminal.status,
            cashSessionId: null,
            cashSessionStatus: null,
            legacyOpenCashCutId,
          }));
      });
  });
}

export function canOperatePos2Context(context: PosContextDto | null | undefined) {
  return Boolean(
    context &&
    context.terminalStatus === "ACTIVE" &&
    context.cashSessionId &&
    context.cashSessionStatus === "OPEN" &&
    !context.legacyOpenCashCutId,
  );
}

export function initialPos2ContextIndex(contexts: readonly PosContextDto[]) {
  const index = contexts.findIndex((context) => canOperatePos2Context(context));
  if (index >= 0) return index;
  return contexts.length === 1 ? 0 : null;
}

export function pos2ContextStatus(context: PosContextDto) {
  if (context.legacyOpenCashCutId) {
    return "Corte abierto en Corte de Caja";
  }
  if (context.terminalStatus === "DISABLED") return "Terminal deshabilitada";
  if (context.terminalStatus === "REVOKED") return "Terminal revocada";
  if (context.cashSessionStatus === "OPEN") return "Caja abierta";
  if (context.cashSessionStatus === "CLOSING") return "Caja en cierre";
  return "Caja cerrada";
}
