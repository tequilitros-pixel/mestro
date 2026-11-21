export function scheduleEligibleEmploymentWhere(
  branchId: string,
  start: Date,
  end: Date,
) {
  return {
    status: "ACTIVE" as const,
    branchAssignments: {
      some: {
        branchId,
        effectiveFrom: { lte: end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
    },
  };
}
