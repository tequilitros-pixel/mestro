type BranchOption = { id: string };
type AssignedEmployment = { assignments: { branchId: string; type: string }[] };

/** The aggregate filter is never a branch submitted to Scheduling. */
export function shiftBranchOptions<T extends BranchOption>(branches: T[]) {
  return branches;
}

export function initialShiftBranch(branches: BranchOption[], selectedBranchId: string | null, employment?: AssignedEmployment) {
  const eligible = shiftBranchOptions(branches);
  if (selectedBranchId && selectedBranchId !== "all" && eligible.some(branch => branch.id === selectedBranchId)) return selectedBranchId;
  if (!employment) return "";
  const home = employment.assignments.find(assignment => assignment.type === "HOME" && eligible.some(branch => branch.id === assignment.branchId));
  return home?.branchId ?? eligible[0]?.id ?? "";
}
