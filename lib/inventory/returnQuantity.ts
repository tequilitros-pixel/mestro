// Keep the draft as text while the operator enters a decimal separator.
export function parseReturnQuantity(input: string): number | null {
  const value = input.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(value)) return null;
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : null;
}
