import { requireModuleAccess } from "@/lib/auth";
import ScheduleTabs from "./ScheduleTabs";

export default async function SchedulePage() {
  await requireModuleAccess("/administration/schedule");

  return (
    <main className="min-h-screen bg-background px-2 py-3 text-on-surface sm:px-4 lg:px-6">
      <div className="w-full space-y-3">
        <ScheduleTabs />
      </div>
    </main>
  );
}
