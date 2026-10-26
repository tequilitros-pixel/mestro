import { requireModuleAccess } from "@/lib/auth";

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("/accounting");
  return <>{children}</>;
}
