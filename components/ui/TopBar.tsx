"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "🏠 Dashboard" },
  { href: "/plant", label: "🏭 Planta" },
  { href: "/lots", label: "📦 Lotes" },
  { href: "/cooking", label: "🔥 Cocción" },
  { href: "/milling", label: "⚙️ Molienda" },
  { href: "/fermentation", label: "🧪 Fermentación" },
  { href: "/distillation", label: "🥃 Destilación" },
  { href: "/costs", label: "💰 Costos" },
  { href: "/control-room", label: "🧠 Sala" },
];

export default function TopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-400">
              🏭 MAESTRO
            </h1>

            <p className="text-sm text-slate-400">
              Destiladora del Norte
            </p>
          </div>

          <div className="flex items-center gap-6">
            <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-semibold text-green-400">
              🟢 Planta saludable
            </span>

            <button className="text-xl">🔔</button>

            <div className="text-right">
              <p className="font-semibold text-white">José Sánchez</p>
              <p className="text-xs text-slate-400">Director</p>
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto border-t border-slate-800 px-4 py-3">
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-amber-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}