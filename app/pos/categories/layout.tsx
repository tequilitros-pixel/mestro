import { requireAdmin } from "@/lib/auth";

export default async function PosCategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <>{children}</>;
}
