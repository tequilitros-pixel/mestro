import { DomainError } from "@/lib/domain/errors";

export type Pos2RolloutMode = "DISABLED" | "PILOT" | "ALL";
export type Pos2RolloutConfig = { mode: Pos2RolloutMode; branchIds: ReadonlySet<string>; registerIds: ReadonlySet<string> };

const values = (raw?: string) => new Set((raw ?? "").split(",").map((value) => value.trim()).filter(Boolean));

export function readPos2RolloutConfig(env: NodeJS.ProcessEnv = process.env): Pos2RolloutConfig {
  const fallback = env.NODE_ENV === "production" ? "DISABLED" : "ALL";
  const candidate = (env.POS2_ROLLOUT_MODE ?? fallback).trim().toUpperCase();
  const mode: Pos2RolloutMode = candidate === "ALL" || candidate === "PILOT" ? candidate : "DISABLED";
  return { mode, branchIds: values(env.POS2_PILOT_BRANCH_IDS), registerIds: values(env.POS2_PILOT_REGISTER_IDS) };
}

export function isPos2ContextEnabled(config: Pos2RolloutConfig, branchId: string, registerId?: string) {
  if (config.mode === "ALL") return true;
  if (config.mode === "DISABLED" || !config.branchIds.has(branchId)) return false;
  return !registerId || config.registerIds.size === 0 || config.registerIds.has(registerId);
}

export function requirePos2ContextEnabled(branchId: string, registerId?: string, config = readPos2RolloutConfig()) {
  if (!isPos2ContextEnabled(config, branchId, registerId)) {
    throw new DomainError("PERMISSION_DENIED", {}, "POS2 no está habilitado para esta caja.");
  }
}
