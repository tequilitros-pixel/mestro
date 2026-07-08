import Link from "next/link";

const links = [
  { href: "/", label: "🏠 Inicio" },
  { href: "/plant", label: "🏭 Planta" },
  { href: "/lots", label: "Lotes" },
  { href: "/cooking", label: "Cocción" },
  { href: "/milling", label: "Molienda" },
  { href: "/fermentation", label: "Fermentación" },
  { href: "/distillation", label: "Destilación" },

];

export default function MainNav() {
  return (
    <nav className="mb-8 overflow-x-auto rounded-2xl bg-slate-900/90 p-3">
      <div className="flex min-w-max gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}