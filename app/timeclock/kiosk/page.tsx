import { requireModuleAccess } from "@/lib/auth";
import KioskClient from "./KioskClient";

export default async function KioskPage() {
  await requireModuleAccess("/timeclock/kiosk");

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <KioskClient />
    </main>
  );
}
