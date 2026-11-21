import "server-only";
import { resolveWorkforcePolicy } from "./settings/service";
import { localBusinessDate } from "./timesheet/rules";

export async function workforceToday() {
  const now = new Date();
  const policy = await resolveWorkforcePolicy(now);
  return localBusinessDate(now, policy.companyTimezone);
}
