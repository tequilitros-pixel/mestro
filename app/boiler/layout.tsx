import { requireModuleAccess } from "@/lib/auth";

export default async function BoilerLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("/boiler");
  return children;
}
