import type { ReactNode } from "react";
import AppHeader from "@/components/layout/AppHeader";
import MainNavigation from "@/components/layout/MainNavigation";
import ModuleNavigation from "@/components/layout/ModuleNavigation";
import AppFooter from "@/components/layout/AppFooter";

type AppShellUser = {
  name: string;
  role: string;
};

type AppShellProps = {
  user: AppShellUser;
  children: ReactNode;
};

export default function AppShell({
  user,
  children,
}: AppShellProps) {
  const isOperator = user.role === "OPERATOR";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 shadow-xl backdrop-blur">
        <div className="mx-auto w-full max-w-7xl">
          <AppHeader user={user} />

          <MainNavigation isOperator={isOperator} />

          <ModuleNavigation isOperator={isOperator} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <div className="mx-auto w-full max-w-7xl">
        <AppFooter />
      </div>
    </div>
  );
}