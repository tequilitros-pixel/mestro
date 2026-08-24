import type { ReactNode } from "react";
import AppHeader from "@/components/layout/AppHeader";
import MainNavigation from "@/components/layout/MainNavigation";
import ModuleNavigation from "@/components/layout/ModuleNavigation";
import { OfflineProvider } from "@/components/offline/OfflineProvider";
import SyncStatus from "@/components/offline/SyncStatus";

type AppShellUser = {
  name: string;
  role: string;
};

type AppShellProps = {
  user: AppShellUser;
  moduleKeys: string[];
  children: ReactNode;
};

export default function AppShell({
  user,
  moduleKeys,
  children,
}: AppShellProps) {
  return (
    <OfflineProvider>
      <div className="flex min-h-screen flex-col bg-background text-on-surface">
        <MainNavigation role={user.role} moduleKeys={moduleKeys} />
        <header className="no-print sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-outline-variant bg-surface-container-low/95 pl-14 pr-3 backdrop-blur sm:pl-16 sm:pr-4">
          <AppHeader user={user} />
          <SyncStatus />
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ModuleNavigation role={user.role} moduleKeys={moduleKeys} />
          <div className="app-content min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </OfflineProvider>
  );
}
