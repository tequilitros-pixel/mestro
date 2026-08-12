import type { ComponentType } from "react";
import type { IconProps } from "@/components/ui/icons";

export type AppIconVariant =
  | "blue"
  | "blueDeep"
  | "cyan"
  | "purple"
  | "green"
  | "orange"
  | "amber"
  | "slate";

type AppIconSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<AppIconVariant, string> = {
  blue: "from-blue-500 to-blue-600 shadow-blue-950/30",
  blueDeep: "from-blue-700 to-indigo-800 shadow-blue-950/40",
  cyan: "from-sky-500 to-cyan-600 shadow-cyan-950/30",
  purple: "from-violet-500 to-purple-700 shadow-purple-950/30",
  green: "from-emerald-500 to-green-700 shadow-emerald-950/30",
  orange: "from-orange-500 to-orange-700 shadow-orange-950/30",
  amber: "from-amber-500 to-orange-600 shadow-amber-950/30",
  slate: "from-slate-500 to-slate-700 shadow-black/30",
};

const SIZE_CLASSES: Record<AppIconSize, { container: string; icon: string }> = {
  sm: { container: "h-7 w-7 rounded-lg", icon: "h-4 w-4" },
  md: { container: "h-8 w-8 rounded-[10px]", icon: "h-[18px] w-[18px]" },
  lg: { container: "h-10 w-10 rounded-xl", icon: "h-5 w-5" },
};

export default function AppIcon({
  icon: Icon,
  variant,
  size = "md",
  className = "",
}: {
  icon: ComponentType<IconProps>;
  variant: AppIconVariant;
  size?: AppIconSize;
  className?: string;
}) {
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-sm ring-1 ring-white/10 ${VARIANT_CLASSES[variant]} ${sizeClasses.container} ${className}`}
    >
      <Icon className={sizeClasses.icon} />
    </span>
  );
}
