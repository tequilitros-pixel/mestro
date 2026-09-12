import { headers } from "next/headers";
import { getCurrentUser, requireModuleAccess } from "@/lib/auth";
import { getModuleKeyForPath, isInventoryManagerReadPath } from "@/lib/permission-modules";

export default async function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  const moduleKey =
    getModuleKeyForPath(pathname) ?? "/administration/inventory/products";

  const user = await getCurrentUser();
  const managerRead = user?.role === "GERENTE" && isInventoryManagerReadPath(pathname);
  if (!managerRead) await requireModuleAccess(moduleKey);

  return <>{children}</>;
}
