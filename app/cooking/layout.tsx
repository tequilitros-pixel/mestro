import { headers } from "next/headers";
import { requireUserModuleAccess } from "@/lib/moduleAccess";
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
    await requireUserModuleAccess(moduleKey);
  }

  return <>{children}</>;
}
