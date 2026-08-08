import { headers } from "next/headers";
import { requireModuleAccess } from "@/lib/auth";
import { getModuleKeyForPath } from "@/lib/permission-modules";

export default async function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  const moduleKey =
    getModuleKeyForPath(pathname) ?? "/administration/inventory/products";

  await requireModuleAccess(moduleKey);

  return <>{children}</>;
}
