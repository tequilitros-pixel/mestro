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

export function matchesEmployeeStatusFilter(
  input: { active: boolean; status: string },
  filter: EmployeeStatusFilter,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "TERMINATED") return input.status === "TERMINATED";
  if (filter === "ACTIVE") return input.active && input.status === "ACTIVE";
  return input.status === "INACTIVE" ||
    (input.status !== "TERMINATED" && !input.active);
}
