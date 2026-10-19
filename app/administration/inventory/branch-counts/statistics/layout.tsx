import { requireAdmin } from "@/lib/auth";

export default async function BranchCountStatisticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <>{children}</>;
}
