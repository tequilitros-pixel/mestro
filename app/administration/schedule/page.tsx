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
    <main className="min-h-screen bg-background px-3 py-4 text-on-surface sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <ScheduleTabs />
      </div>
    </main>
  );
}
