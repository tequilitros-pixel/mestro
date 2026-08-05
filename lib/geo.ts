/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Utilidades de geolocalización (geocerca del checador).
 * ==========================================================
 */

/**
 * Distancia entre dos coordenadas (fórmula de Haversine), en metros.
 */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // radio de la Tierra en metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export type GeofenceInfo = {
  latitude: number;
  longitude: number;
  radius: number;
} | null;

export type BranchLocation = {
  geofence: GeofenceInfo;
};

/**
 * Indica si una sucursal tiene geozona asignada.
 */
export function hasGeofence(
  branch: BranchLocation
): branch is { geofence: { latitude: number; longitude: number; radius: number } } {
  return branch.geofence !== null;
}
