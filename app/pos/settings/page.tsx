import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getPosSettings, getDiscountLimits } from "@/app/actions/posSettings";
import { GearIcon, ChevronLeftIcon } from "@/components/ui/icons";
import PosSettingsForm from "./PosSettingsForm";
import DiscountLimitsForm from "./DiscountLimitsForm";

export default async function PosSettingsPage() {
  await requireAdmin();

  const [settings, discountLimits] = await Promise.all([getPosSettings(), getDiscountLimits()]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link
            href="/pos"
            className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Punto de venta
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-bold sm:text-4xl">
            <GearIcon className="h-7 w-7 text-on-surface-variant" />
            Configuración del punto de venta
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Ajusta los valores por defecto de descuentos y beneficios de empleado.
          </p>
        </div>

        <PosSettingsForm initialValues={settings} />
        <DiscountLimitsForm initialLimits={discountLimits} />
      </div>
    </main>
  );
}
