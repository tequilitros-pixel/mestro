"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/login";
import { getCurrentModule, MAIN_MODULES } from "@/components/layout/navigation";
import { LogoutIcon } from "@/components/ui/icons";
import AppIcon from "@/components/ui/AppIcon";
import BackButton from "@/components/layout/BackButton";

export default function AppHeader({ user }: { user: { name: string; role: string } }) {
  const pathname = usePathname();
  const currentModule = MAIN_MODULES.find((item) => item.module === getCurrentModule(pathname)) ?? MAIN_MODULES[0];

  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <BackButton />
        <AppIcon icon={currentModule.icon} variant={currentModule.iconVariant} size="sm" />
        <p className="truncate text-sm font-semibold text-on-surface sm:text-[15px]">{currentModule.label}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Link href="/profile" className="hidden max-w-44 truncate rounded-lg px-2.5 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface sm:block">{user.name}</Link>
        <form action={logoutAction}>
          <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión" className="shell-icon-button text-on-surface-variant hover:text-on-surface"><LogoutIcon className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}
