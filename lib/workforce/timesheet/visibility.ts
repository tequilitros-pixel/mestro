export const employmentStatusFilters = [
  "ACTIVE",
  "INACTIVE",
  "TERMINATED",
  "ALL",
] as const;

export type EmploymentStatusFilter = (typeof employmentStatusFilters)[number];

const syntheticWorkforceToken =
  /\b(QA|TEST|CERT|DEMO|SYNTHETIC|PRUEBA|FIXTURE|EJEMPLO)\b/i;

export function normalizeEmploymentStatusFilter(
  value: string | undefined,
): EmploymentStatusFilter {
  return employmentStatusFilters.includes(value as EmploymentStatusFilter)
    ? (value as EmploymentStatusFilter)
    : "ACTIVE";
}

export function isSyntheticWorkforceRecord(displayName: string | null | undefined): boolean {
  return syntheticWorkforceToken.test(displayName?.trim() ?? "");
}

export function shouldShowEmployment(
  input: {
    status: Exclude<EmploymentStatusFilter, "ALL">;
    displayName: string;
    employeeActive?: boolean;
  },
  filter: EmploymentStatusFilter,
): boolean {
  if (filter !== "ALL" && input.status !== filter) return false;
  if (filter === "ACTIVE" && input.employeeActive === false) return false;
  return filter !== "ACTIVE" || !isSyntheticWorkforceRecord(input.displayName);
}
