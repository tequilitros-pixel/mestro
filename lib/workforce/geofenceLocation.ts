export type GeofenceLocationDraft = {
  label: string;
  latitude: number | null;
  longitude: number | null;
  radius: number;
};

export type GeocoderSelection = {
  displayName: string;
  latitude: number;
  longitude: number;
};

function finiteCoordinate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeGeofenceRadius(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 100;
  return Math.min(10000, Math.max(10, numeric));
}

export function initialGeofenceLocation(input: {
  label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
}): GeofenceLocationDraft {
  return {
    label: input.label?.trim() ?? "",
    latitude: finiteCoordinate(input.latitude),
    longitude: finiteCoordinate(input.longitude),
    radius: normalizeGeofenceRadius(input.radius),
  };
}

export function selectGeocoderResult(draft: GeofenceLocationDraft, result: GeocoderSelection) {
  return {
    ...draft,
    label: result.displayName,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

export function moveGeofencePin(draft: GeofenceLocationDraft, latitude: number, longitude: number) {
  return {
    ...draft,
    latitude: finiteCoordinate(latitude),
    longitude: finiteCoordinate(longitude),
  };
}

export function applyCurrentLocation(draft: GeofenceLocationDraft, latitude: number, longitude: number) {
  return moveGeofencePin(draft, latitude, longitude);
}

export function setGeofenceRadius(draft: GeofenceLocationDraft, radius: number | string) {
  return { ...draft, radius: normalizeGeofenceRadius(radius) };
}
