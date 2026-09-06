function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("NON_FINITE_NUMBER"); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") { const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`; }
  throw new Error("UNSUPPORTED_PAYLOAD_VALUE");
}
export const canonicalOfflinePayload = (value: unknown) => canonicalize(value);
export async function hashOfflinePayload(value: unknown) { const bytes = new TextEncoder().encode(canonicalOfflinePayload(value)); const digest = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
export function normalizeMoney(value: string | number) { const number = Number(value); if (!Number.isFinite(number)) throw new Error("INVALID_MONEY"); return number.toFixed(2); }
export function normalizeQuantity(value: string | number, unit: "UNIT" | "ML") { const number = Number(value); if (!Number.isFinite(number) || number <= 0 || (unit === "UNIT" && !Number.isInteger(number))) throw new Error("INVALID_QUANTITY"); return unit === "UNIT" ? String(number) : number.toFixed(6).replace(/0+$/, "").replace(/\.$/, ""); }
export function generateClientOperationId(now = Date.now()) { const bytes = crypto.getRandomValues(new Uint8Array(16)); let timestamp = BigInt(now); for (let index = 5; index >= 0; index -= 1) { bytes[index] = Number(timestamp & BigInt(255)); timestamp >>= BigInt(8); } bytes[6] = (bytes[6] & 15) | 112; bytes[8] = (bytes[8] & 63) | 128; const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`; }
