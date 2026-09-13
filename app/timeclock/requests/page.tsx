import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMyPublishedUpcomingShifts, getMyShiftRequests, getSwapCandidates } from "@/app/actions/shiftRequests";
import RequestsView from "./RequestsView";

export default async function RequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [shifts, requests, candidates] = await Promise.all([getMyPublishedUpcomingShifts(), getMyShiftRequests(), getSwapCandidates()]);
  return <RequestsView shifts={shifts.map((s) => ({ ...s, date: s.date.toISOString() }))} requests={requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), shift: { ...r.shift, date: r.shift.date.toISOString() } }))} candidates={candidates} />;
}
