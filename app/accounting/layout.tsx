import { requireAdmin } from "@/lib/auth";

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
