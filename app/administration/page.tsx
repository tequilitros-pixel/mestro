import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserModuleKeys } from "@/app/actions/permissions";
import { PERMISSION_GROUPS } from "@/lib/permission-modules";

export default async function AdministrationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN") {
    if (user.role === "GERENTE") {
      redirect("/administration/inventory/products");
    }

    const moduleKeys = await getUserModuleKeys(user.id);
    const administrationKeys =
      PERMISSION_GROUPS.find((group) => group.group === "Administración")?.modules ?? [];
    const destination = administrationKeys.find((module) =>
      moduleKeys.includes(module.key),
    )?.key;
    redirect(destination ?? "/profile");
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${alert ? "text-error" : "text-on-surface"}`}>{value}</p>
      <p className="mt-1 text-xs text-on-surface-variant">{detail}</p>
    </div>
  );
}
