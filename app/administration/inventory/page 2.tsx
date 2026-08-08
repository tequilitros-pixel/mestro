import Link from "next/link";
import type { ComponentType } from "react";
import {
  type IconProps,
  PackageIcon,
  PartyIcon,
  StoreIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";

const sections: {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<IconProps>;
}[] = [
  {
    title: "Inventario de eventos",
    description:
      "Paquetes, kits de equipo y control de salida/regreso de cada evento.",
    href: "/administration/inventory/eventos",
    icon: PartyIcon,
  },
  {
    title: "Inventario de sucursales",
    description:
      "Stock por sucursal, entradas, traspasos y conteos semanales.",
    href: "/administration/inventory/sucursales",
    icon: StoreIcon,
  },
  {
    title: "Productos",
    description:
      "Catálogo compartido de bebidas, insumos, herramientas y equipo.",
    href: "/administration/inventory/products",
    icon: PackageIcon,
  },
];

export default function InventoryPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="mb-2 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
            Administración
          </p>

          <h1 className="text-3xl font-bold sm:text-4xl">Inventario</h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Controla productos, paquetes y movimientos de inventario para las
            sucursales y los eventos de Barra.
          </p>
        </div>

        <section className="grid gap-5 md:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group rounded-2xl border border-outline-variant bg-surface-container p-6 transition duration-200 ease-out hover:-translate-y-1 hover:border-primary/25 hover:bg-surface-container/80"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high">
                  <Icon className="h-6 w-6 text-on-surface-variant" />
                </div>

                <h2 className="text-xl font-semibold text-on-surface">
                  {section.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {section.description}
                </p>

                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                  Abrir
                  <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
