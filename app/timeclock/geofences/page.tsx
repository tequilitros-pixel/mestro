import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getGeofencesPageData } from "@/app/actions/geofences";
import GeofencesManager from "./GeofencesManager";

type GeofencesSuccess = Extract<
  Awaited<ReturnType<typeof getGeofencesPageData>>,
  { success: true }
>;

export default async function GeofencesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/timeclock");
  }

  const data = await getGeofencesPageData();

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-on-surface-variant">
            Horario
          </p>
          <h1 className="mt-1 text-4xl font-bold">Geozona</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Direcciones de sucursales y geozonas del checador: crea o elimina
            geozonas y asígnalas al área de trabajo correspondiente.
          </p>
        </div>

        {"error" in data ? (
          <p className="text-error">{data.error}</p>
        ) : (
          <GeofencesManager
            initialBranches={data.branches}
            initialGeofences={data.geofences.map((g: GeofencesSuccess["geofences"][number]) => ({
              ...g,
              createdAt: g.createdAt.toISOString(),
              updatedAt: g.updatedAt.toISOString(),
            }))}
          />
        )}
      </div>
    </main>
  );
}
