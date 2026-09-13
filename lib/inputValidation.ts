export function plainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.getPrototypeOf(value) === Object.prototype
    ? value as Record<string, unknown>
    : null;
}

export function cleanText(value: unknown, options: { min?: number; max: number; pattern?: RegExp }) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length < (options.min ?? 0) || text.length > options.max) return null;
  if (options.pattern && !options.pattern.test(text)) return null;
  return text;
}

export function optionalCleanText(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  return cleanText(value, { max });
}

export function httpUrl(value: unknown, max = 2048) {
  const text = cleanText(value, { min: 1, max });
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}
