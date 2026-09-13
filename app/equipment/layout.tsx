import { requireModuleAccess } from "@/lib/auth";

export default async function EquipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleAccess("/plant");
  return <>{children}</>;
}
