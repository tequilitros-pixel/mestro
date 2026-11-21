import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "Cotizador Tequilitros | Maestro",
  description: "Cotizador oficial de barras móviles, calendario de disponibilidad y contratos Tequilitros.",
};

export default async function CotizadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {children}
    </div>
  );
}
