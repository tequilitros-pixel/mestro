import { headers } from "next/headers";
import { requireModuleAccess } from "@/lib/auth";
import { getModuleKeyForPath } from "@/lib/permission-modules";

export default async function ModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  const moduleKey = getModuleKeyForPath(pathname);

  if (moduleKey) {
    await requireModuleAccess(moduleKey);
  }

  return <>{children}</>;
}
