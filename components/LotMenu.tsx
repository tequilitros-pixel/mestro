"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardIcon,
  FlameIcon,
  GearIcon,
  FlaskIcon,
  GlassWaterIcon,
  CoinsIcon,
  PrinterIcon,
  type IconProps,
} from "@/components/ui/icons";
import { ComponentType } from "react";
import AppIcon, { type AppIconVariant } from "@/components/ui/AppIcon";

export default function LotMenu({
  id,
  isFinished = false,
  processIds,
}: {
  id: string;
  isFinished?: boolean;
  processIds?: {
    cooking?: string;
    milling?: string;
    fermentation?: string;
    distillation?: string;
  };
}) {
  const pathname = usePathname();
  const overviewHref = `/lots/${id}`;

  const items: {
    href: string;
    label: string;
    icon: ComponentType<IconProps>;
    iconVariant: AppIconVariant;
  }[] = [
    {
      href: `/lots/${id}`,
      label: "Resumen",
      icon: ClipboardIcon,
      iconVariant: "blueDeep",
    },
    ...(processIds?.cooking
      ? [{
          href: `/cooking/${processIds.cooking}`,
          label: "Cocción",
          icon: FlameIcon,
          iconVariant: "orange" as const,
        }]
      : []),
    ...(processIds?.milling
      ? [{
          href: `/milling/${processIds.milling}`,
          label: "Molienda",
          icon: GearIcon,
          iconVariant: "blue" as const,
        }]
      : []),
    ...(processIds?.fermentation
      ? [{
          href: `/fermentation/${processIds.fermentation}`,
          label: "Fermentación",
          icon: FlaskIcon,
          iconVariant: "green" as const,
        }]
      : []),
    ...(processIds?.distillation
      ? [{
          href: `/distillation/${processIds.distillation}`,
          label: "Destilación",
          icon: GlassWaterIcon,
          iconVariant: "purple" as const,
        }]
      : []),
    {
      href: `/lots/${id}/costs`,
      label: "Costos",
      icon: CoinsIcon,
      iconVariant: "green",
    },
    ...(isFinished
      ? [
          {
            href: `/lots/${id}/qr`,
            label: "Imprimir QR",
            icon: PrinterIcon,
            iconVariant: "slate" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="mb-8 flex flex-wrap gap-3">
      {items.map((item) => {
        const isActive =
          item.href === overviewHref
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] ${
              isActive
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
            }`}
          >
            <AppIcon icon={item.icon} variant={item.iconVariant} size="sm" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
