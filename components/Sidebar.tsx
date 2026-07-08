"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  icon: string;
  label: string;
  href: string;
};

const menuItems: MenuItem[] = [
  { icon: "🏠", label: "Centro de Control", href: "/" },
  { icon: "📦", label: "Lotes", href: "/lots" },
  { icon: "🔥", label: "Cocción", href: "/cooking" },
  { icon: "⚙️", label: "Molienda", href: "/milling" },
  { icon: "🧪", label: "Fermentación", href: "/fermentation" },
  { icon: "🥃", label: "Destilación", href: "/distillation" },
  { icon: "🧫", label: "Laboratorio", href: "/laboratory" },
  { icon: "💰", label: "Costos", href: "/costs" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-72 flex-col border-r border-slate-800 bg-slate-950 p-6 text-white">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-400">
          DESTILADORA
        </p>

        <h1 className="mt-2 text-2xl font-bold">MAESTRO</h1>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                active
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="w-6 text-center text-xl">{item.icon}</span>

              <span className="flex-1">{item.label}</span>

              {active && (
                <span className="h-2 w-2 rounded-full bg-amber-400"></span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8">
        <div className="rounded-xl bg-slate-900 p-4">
          <p className="text-sm font-semibold">Sistema MAESTRO</p>

          <p className="mt-1 text-xs text-slate-400">
            Control integral de producción
          </p>

          <p className="mt-4 text-xs text-slate-500">
            Destiladora del Norte
          </p>

          <p className="text-xs text-slate-500">
            Versión 1.0.0
          </p>
        </div>
      </div>
    </aside>
  );
}