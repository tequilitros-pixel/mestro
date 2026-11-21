import { requireAdmin } from "@/lib/auth";

export default async function PersonnelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <>{children}</>;
}
