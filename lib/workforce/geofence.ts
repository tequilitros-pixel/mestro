import { distanceMeters } from "@/lib/geo";

export type LocationFailure = "PERMISSION_DENIED" | "UNAVAILABLE";

export type LocationSample = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  checkedAt?: string;
};

export type LocationInput =
  | { sample: LocationSample; failure?: never }
  | { sample?: never; failure: LocationFailure }
  | null
  | undefined;

export type GeofenceBranch = {
  geofenceEnabled: boolean;
  geofence: { latitude: number; longitude: number; radius: number } | null;
};

export type GeofenceResult = {
  result:
    | "INSIDE"
    | "OUTSIDE"
    | "UNAVAILABLE"
    | "PERMISSION_DENIED"
    | "LOW_ACCURACY"
    | "NOT_REQUIRED";
  distanceMeters?: number;
  accuracyMeters?: number;
  checkedAt: Date;
};

export function requiresLocation(branch: GeofenceBranch, policyEnabled: boolean) {
  return policyEnabled && branch.geofenceEnabled;
}

export function evaluateGeofence(
  branch: GeofenceBranch,
  location: LocationInput,
  policyEnabled: boolean,
  maximumAccuracyMeters: number,
): GeofenceResult {
  // Evidence time is server-owned; the device timestamp is informational input only.
  const checkedAt = new Date();

  if (!requiresLocation(branch, policyEnabled)) {
    return { result: "NOT_REQUIRED", checkedAt };
  }
  if (!branch.geofence) return { result: "UNAVAILABLE", checkedAt };

  if (location?.failure) {
    // JSON from a Server Action is untrusted even when TypeScript narrows it.
    // Only failures may come from the device; success is calculated below.
    const result = location.failure === "PERMISSION_DENIED" || location.failure === "UNAVAILABLE"
      ? location.failure
      : "UNAVAILABLE";
    return { result, checkedAt };
  }

  if (!location?.sample) {
    return { result: "UNAVAILABLE", checkedAt };
  }

  const { latitude, longitude, accuracyMeters } = location.sample;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { result: "UNAVAILABLE", checkedAt };
  }

  if (typeof accuracyMeters !== "number" || !Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return { result: "UNAVAILABLE", checkedAt };
  }
  if (accuracyMeters > maximumAccuracyMeters) {
    return { result: "LOW_ACCURACY", accuracyMeters, checkedAt };
  }

  const geofence = branch.geofence!;
  const distance = distanceMeters(
    geofence.latitude,
    geofence.longitude,
    latitude,
    longitude,
  );

  return {
    result: distance <= geofence.radius ? "INSIDE" : "OUTSIDE",
    distanceMeters: Math.round(distance),
    accuracyMeters,
    checkedAt,
  };
}

export function geofenceDecision(
  result: GeofenceResult["result"],
  outsideBehavior: "BLOCK" | "ALLOW_WITH_EXCEPTION",
) {
  if (result === "INSIDE" || result === "NOT_REQUIRED") {
    return { allow: true, needsReview: false };
  }
  if (outsideBehavior === "ALLOW_WITH_EXCEPTION") {
    return { allow: true, needsReview: true };
  }
  return { allow: false, needsReview: false };
}

export function geofenceMessage(result: GeofenceResult) {
  switch (result.result) {
    case "OUTSIDE":
      return `Parece que estás fuera de la ubicación de trabajo${result.distanceMeters !== undefined ? ` (${result.distanceMeters} m)` : ""}.`;
    case "PERMISSION_DENIED":
      return "No pudimos verificar tu ubicación porque el permiso fue rechazado.";
    case "LOW_ACCURACY":
      return "La precisión del GPS no es suficiente para validar esta checada.";
    case "UNAVAILABLE":
      return "No pudimos verificar tu ubicación.";
    default:
      return null;
  }
}
