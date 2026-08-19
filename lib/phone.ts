export function normalizeMexicanPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return `+${digits}`;
  return null;
}

export function displayPhone(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").replace(/^52/, "");
  return digits.length === 10
    ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    : value;
}
