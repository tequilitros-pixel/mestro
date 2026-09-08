/** Branch assignments are administrative information, not scheduling eligibility. */
export function scheduleEligibleEmploymentWhere() {
  return { status: "ACTIVE" as const };
}
