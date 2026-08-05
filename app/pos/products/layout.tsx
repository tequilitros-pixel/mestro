import { requireAdmin } from "@/lib/auth";

export default async function PosProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <>{children}</>;
}
