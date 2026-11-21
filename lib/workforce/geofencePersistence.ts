import type { Prisma } from "@prisma/client";
import { BRANCH_GEOFENCE_MODES, type BranchGeofenceMode } from "@/lib/workforce/geofence";
import { validGeofenceConfig } from "@/lib/workforce/branch";

export type BranchGeofenceSaveInput = {
  enabled: boolean;
  mode?: BranchGeofenceMode | null;
  latitude: number | null;
  longitude: number | null;
  radius: number;
};

export type BranchGeofenceSaveState = {
  error: string | null;
  storedMode: BranchGeofenceMode | null;
  shouldEnable: boolean;
  hasValidConfiguration: boolean;
};

type BranchWithGeofence = {
  id: string;
  name: string;
  geofenceId: string | null;
  geofence: { id: string; branches: { id: string }[] } | null;
};

export function getBranchGeofenceSaveState(input: BranchGeofenceSaveInput): BranchGeofenceSaveState {
  if (input.mode !== undefined && input.mode !== null && !BRANCH_GEOFENCE_MODES.includes(input.mode)) {
    return { error: "Modo de geozona inválido.", storedMode: null, shouldEnable: false, hasValidConfiguration: false };
  }
  if ((input.mode === "WARN" || input.mode === "BLOCK") && !input.enabled) {
    return { error: "Activa la geozona antes de seleccionar WARN o BLOCK.", storedMode: null, shouldEnable: false, hasValidConfiguration: false };
  }

  const storedMode = input.mode === undefined ? (input.enabled ? null : "OFF") : input.mode;
  const shouldEnable = input.enabled && storedMode !== "OFF";
  const hasValidConfiguration = input.latitude !== null
    && input.longitude !== null
    && validGeofenceConfig(input.latitude, input.longitude, input.radius);

  return {
    error: shouldEnable && !hasValidConfiguration ? "Coordenadas o radio de geozona inválidos." : null,
    storedMode,
    shouldEnable,
    hasValidConfiguration,
  };
}

export async function persistBranchGeofence(
  tx: Prisma.TransactionClient,
  branch: BranchWithGeofence,
  input: BranchGeofenceSaveInput,
  state = getBranchGeofenceSaveState(input),
) {
  if (state.error) throw new Error(state.error);

  if (!state.shouldEnable && !state.hasValidConfiguration) {
    await tx.branch.update({
      where: { id: branch.id },
      data: { geofenceEnabled: false, geofenceMode: state.storedMode },
    });
    return;
  }

  let geofenceId = branch.geofenceId;
  if (!branch.geofence || branch.geofence.branches.length > 1) {
    geofenceId = (await tx.geofence.create({
      data: {
        name: `${branch.name} · geozona`,
        latitude: input.latitude!,
        longitude: input.longitude!,
        radius: input.radius,
      },
    })).id;
  } else {
    await tx.geofence.update({
      where: { id: branch.geofence.id },
      data: { latitude: input.latitude!, longitude: input.longitude!, radius: input.radius },
    });
  }

  await tx.branch.update({
    where: { id: branch.id },
    data: { geofenceId, geofenceEnabled: state.shouldEnable, geofenceMode: state.storedMode },
  });
}
