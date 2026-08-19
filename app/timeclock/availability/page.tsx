import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AvailabilityView from "./AvailabilityView";

export default async function AvailabilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AvailabilityView />;
}
