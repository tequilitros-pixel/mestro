/* eslint-disable react-hooks/purity -- temporary server-side timing instrumentation */
import { headers } from "next/headers";
import { getCurrentUser, requireModuleAccess } from "@/lib/auth";
import { getModuleKeyForPath, isInventoryManagerReadPath } from "@/lib/permission-modules";

export default async function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const traceStart = Date.now();
  console.info(`[INVENTORY_TRACE] layout start ${traceStart}`);
  const headersStart = Date.now();
  const headersList = await headers();
  console.info(`[INVENTORY_TRACE] layout headers end duration=${Date.now() - headersStart}ms`);
  const pathname = headersList.get("x-pathname") ?? "";

  const moduleKey =
    getModuleKeyForPath(pathname) ?? "/administration/inventory/products";

  const authStart = Date.now();
  const user = await getCurrentUser();
  console.info(
    `[INVENTORY_TRACE] layout auth end duration=${Date.now() - authStart}ms resolved=${Boolean(user)}`,
  );
  const managerRead = user?.role === "GERENTE" && isInventoryManagerReadPath(pathname);
  if (!managerRead) {
    const permissionStart = Date.now();
    await requireModuleAccess(moduleKey);
    console.info(
      `[INVENTORY_TRACE] layout permission end duration=${Date.now() - permissionStart}ms`,
    );
  }

  console.info(`[INVENTORY_TRACE] layout end duration=${Date.now() - traceStart}ms`);
  return <>{children}</>;
}
