import type { ReactNode } from "react";
import AppHeader from "@/components/layout/AppHeader";
import BackButton from "@/components/layout/BackButton";
import MainNavigation from "@/components/layout/MainNavigation";
import ModuleNavigation from "@/components/layout/ModuleNavigation";
import AppFooter from "@/components/layout/AppFooter";

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
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <header className="no-print sticky top-0 z-50 border-b border-outline-variant bg-surface/95 shadow-xl backdrop-blur">
        <div className="mx-auto w-full max-w-7xl">
          <div className="px-4 pt-2 sm:px-6">
            <BackButton />
          </div>

          <AppHeader user={user} />

          <MainNavigation role={user.role} moduleKeys={moduleKeys} />

          <ModuleNavigation role={user.role} moduleKeys={moduleKeys} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <div className="no-print mx-auto w-full max-w-7xl">
        <AppFooter />
      </div>
    </div>
  );
}