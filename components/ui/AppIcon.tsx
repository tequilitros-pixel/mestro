import type { ComponentType, ReactNode } from "react";
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
  blue: "from-blue-600 to-blue-800 shadow-blue-950/35",
  blueDeep: "from-blue-600 to-blue-800 shadow-blue-950/35",
  cyan: "from-blue-600 to-blue-800 shadow-blue-950/35",
  purple: "from-blue-600 to-blue-800 shadow-blue-950/35",
  green: "from-blue-600 to-blue-800 shadow-blue-950/35",
  orange: "from-blue-600 to-blue-800 shadow-blue-950/35",
  amber: "from-blue-600 to-blue-800 shadow-blue-950/35",
  slate: "from-blue-600 to-blue-800 shadow-blue-950/35",
};

const SIZE_CLASSES: Record<AppIconSize, { container: string; icon: string }> = {
  sm: { container: "h-7 w-7 rounded-lg", icon: "h-4 w-4" },
  md: { container: "h-8 w-8 rounded-[10px]", icon: "h-[18px] w-[18px]" },
  lg: { container: "h-10 w-10 rounded-xl", icon: "h-5 w-5" },
};

export function AppIconBadge({
  children,
  size = "sm",
  className = "",
}: {
  children: ReactNode;
  size?: AppIconSize;
  className?: string;
}) {
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm shadow-blue-950/35 ring-1 ring-white/10 ${sizeClasses.container} ${className}`}
    >
      <span className={sizeClasses.icon}>{children}</span>
    </span>
  );
}

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
  return (
    <AppIconBadge size={size} className={`${VARIANT_CLASSES[variant]} ${className}`}>
      <Icon className="h-full w-full" />
    </AppIconBadge>
  );
}
