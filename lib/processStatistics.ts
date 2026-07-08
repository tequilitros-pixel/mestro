export function calculateAverage(values: (number | null | undefined)[]) {
  const validValues = values.filter(
    (value): value is number => typeof value === "number"
  );

  if (validValues.length === 0) {
    return 0;
  }

  const total = validValues.reduce<number>((sum, value) => {
    return sum + value;
  }, 0);

  return Number((total / validValues.length).toFixed(2));
}

export function calculateTotal(values: (number | null | undefined)[]) {
  const total = values.reduce<number>((sum, value) => {
    return sum + (value ?? 0);
  }, 0);

  return Number(total.toFixed(2));
}

export function calculatePercentage(
  value: number,
  total: number
) {
  if (total === 0) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(2));
}