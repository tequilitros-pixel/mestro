import { headers } from "next/headers";
import { requireModuleAccess } from "@/lib/auth";
import { getModuleKeyForPath } from "@/lib/permission-modules";

export default async function PersonnelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/administration/personnel";

  if (!pathname.includes("/permissions")) {
    const moduleKey = getModuleKeyForPath(pathname) ?? "/administration/personnel";
    await requireModuleAccess(moduleKey);
  }

  return <>{children}</>;
}
