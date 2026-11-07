import { redirect } from "next/navigation";

/** Compatibility destination for payroll notifications issued before the route rename. */
export default function LegacyMyPayrollPage() {
  redirect("/timeclock/payroll");
}
