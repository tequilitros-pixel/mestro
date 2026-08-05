import Link from "next/link";
import {
  ClipboardIcon,
  FlameIcon,
  GearIcon,
  FlaskIcon,
  GlassWaterIcon,
  CoinsIcon,
  ChartBarIcon,
  BookIcon,
  PrinterIcon,
  type IconProps,
} from "@/components/ui/icons";
import { ComponentType } from "react";

export default function LotMenu({
  id,
  isFinished = false,
}: {
  id: string;
  isFinished?: boolean;
}) {
  const items: {
    href: string;
    label: string;
    icon: ComponentType<IconProps>;
  }[] = [
    {
      href: `/lots/${id}`,
      label: "Resumen",
      icon: ClipboardIcon,
    },
    {
      href: `/cooking/${id}`,
      label: "Cocción",
      icon: FlameIcon,
    },
    {
      href: `/milling/${id}`,
      label: "Molienda",
      icon: GearIcon,
    },
    {
      href: `/fermentation/${id}`,
      label: "Fermentación",
      icon: FlaskIcon,
    },
    {
      href: `/distillation`,
      label: "Destilación",
      icon: GlassWaterIcon,
    },
    {
      href: `/lots/${id}/costs`,
      label: "Costos",
      icon: CoinsIcon,
    },
    {
      href: `/lots/${id}/stats`,
      label: "Estadísticas",
      icon: ChartBarIcon,
    },
    {
      href: `/lots/${id}/report`,
      label: "Reporte",
      icon: BookIcon,
    },
    ...(isFinished
      ? [
          {
            href: `/lots/${id}/qr`,
            label: "Imprimir QR",
            icon: PrinterIcon,
          },
        ]
      : []),
  ];

  return (
    <div className="mb-8 flex flex-wrap gap-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex items-center gap-1.5 rounded-xl bg-surface-container-high px-4 py-2 text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:bg-primary hover:text-on-primary active:scale-[0.97]"
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </div>
  );
}
