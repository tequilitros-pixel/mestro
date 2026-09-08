export type EmployeeListStatus = "ACTIVE" | "INACTIVE" | "TERMINATED" | "NONE";
export type EmployeeStatusFilter = "ACTIVE" | "INACTIVE" | "TERMINATED" | "ALL";

const statusFilters: readonly EmployeeStatusFilter[] = ["ACTIVE", "INACTIVE", "TERMINATED", "ALL"];

export function normalizeEmployeeStatusFilter(value: string | undefined): EmployeeStatusFilter {
  return value && statusFilters.includes(value as EmployeeStatusFilter) ? value as EmployeeStatusFilter : "ACTIVE";
}

type EmploymentLike = { status: Exclude<EmployeeListStatus, "NONE"> };

export function selectEmploymentForStatus<T extends EmploymentLike>(
  employments: readonly T[],
  filter: EmployeeStatusFilter,
): T | null {
  const open = employments.find((employment) => employment.status !== "TERMINATED");
  if (filter === "ALL") return open ?? employments[0] ?? null;
  if (filter === "TERMINATED") return open ? null : employments[0] ?? null;
  return open?.status === filter ? open : null;
}
