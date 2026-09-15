import { headers } from "next/headers";
import { requireModuleAccess } from "@/lib/auth";
import { getModuleKeyForPath } from "@/lib/permission-modules";

export default async function PosPressLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/pospress";
  await requireModuleAccess(getModuleKeyForPath(pathname) ?? "/pos");

  return <>{children}</>;
}
