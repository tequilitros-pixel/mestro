export function normalizeBranchCode(value: string) {
  return value.trim().toUpperCase();
}

export function validBranchCode(value: string) {
  return /^[A-Z0-9_-]{2,20}$/.test(value);
}

export function validTimezone(value: string) {
  try {
    Intl.DateTimeFormat("es-MX", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function validGeofenceConfig(latitude: number, longitude: number, radius: number) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && Number.isInteger(radius) && radius >= 10 && radius <= 10_000;
}
