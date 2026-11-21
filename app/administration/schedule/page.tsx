import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ScheduleTabs from "./ScheduleTabs";

export default async function SchedulePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/timeclock");
  }

  return (
    <main className="min-h-screen bg-background px-2 py-3 text-on-surface sm:px-4 lg:px-6">
      <div className="w-full space-y-3">
        <ScheduleTabs />
      </div>
    </main>
  );
}
