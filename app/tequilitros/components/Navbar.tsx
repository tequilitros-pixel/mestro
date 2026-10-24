"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const WHATSAPP_URL =
  "https://wa.me/525662989202?text=" +
  encodeURIComponent("Hola, quiero cotizar la barra de Tequilitros para mi evento.");

const NAV_LINKS = [
  { href: "#modalidades", label: "Precios" },
  { href: "#simulador", label: "Calculadora" },
  { href: "#menu", label: "Menú" },
  { href: "#vaso3d", label: "Vaso 3D" },
  { href: "#pasos", label: "Cómo Contratar" },
  { href: "#cobertura", label: "Cobertura" },
  { href: "#faq", label: "Dudas" },
  { href: "#cotizar", label: "Cotizar Evento" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Topbar editorial */}
      <div className="flex items-center justify-between border-b border-[#242E37] bg-[#0A0E12] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9AA5AC] sm:px-8">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#30D158]" />
          Colotlán · Norte de Jalisco · Zacatecas
        </span>
        <span className="hidden sm:inline">
          Tequilitros Eventos · Barra Móvil desde $90/persona · Mínimo 40 personas
        </span>
        <a
          href="https://wa.me/525662989202"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-[#E28735] hover:underline"
        >
          WhatsApp: 56 6298 9202
        </a>
      </div>

      {/* Header flotante de cristal */}
      <header
        className={`sticky top-0 z-50 flex h-20 items-center justify-between px-4 transition-all duration-300 sm:px-8 ${
          scrolled
            ? "border-b border-[#242E37] bg-[#080B0E]/95 shadow-2xl backdrop-blur-md"
            : "border-b border-[#242E37]/50 bg-[#080B0E]/70 backdrop-blur-sm"
        }`}
      >
        {/* Logo */}
        <Link
          href="#inicio"
          className="group flex items-center gap-2.5 text-xl font-bold tracking-tight text-[#F5F2EB] sm:text-2xl"
          aria-label="Tequilitros Eventos, inicio"
        >
          <span className="text-[#E28735] text-2xl transition-transform duration-300 group-hover:rotate-45">
            ✳
          </span>
          <span className="font-serif tracking-wider">TEQUILITROS</span>
        </Link>

        {/* Navegación Desktop */}
        <nav
          className="hidden items-center gap-5 text-xs font-semibold uppercase tracking-[0.1em] text-[#9AA5AC] lg:flex"
          aria-label="Navegación principal"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors duration-200 hover:text-[#E28735]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Botones de acción */}
        <div className="flex items-center gap-3">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-full border border-[#E28735]/40 bg-[#E28735]/15 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#E28735] transition-all duration-200 hover:border-[#E28735] hover:bg-[#E28735] hover:text-[#080B0E] sm:inline-flex shadow-sm"
          >
            <span>Cotizar WhatsApp</span>
            <span>↗</span>
          </a>

          {/* Botón Menú Móvil */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#242E37] bg-[#12181F] text-[#F5F2EB] lg:hidden"
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <span className="text-xl">✕</span>
            ) : (
              <span className="text-xl">☰</span>
            )}
          </button>
        </div>
      </header>

      {/* Drawer Móvil */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#080B0E]/95 pt-28 px-6 backdrop-blur-xl lg:hidden flex flex-col justify-between pb-8 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <nav className="flex flex-col gap-3 text-base font-serif font-bold text-[#F5F2EB]">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between border-b border-[#242E37] py-2.5 text-base hover:text-[#E28735]"
              >
                <span>{link.label}</span>
                <span className="text-xs text-[#E28735]">↗</span>
              </Link>
            ))}
          </nav>

          <div className="space-y-4 pt-6">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E28735] py-3.5 text-center font-mono text-xs font-bold uppercase tracking-wider text-[#080B0E]"
            >
              <span>Cotizar Directo por WhatsApp</span>
              <span>↗</span>
            </a>

            <div className="text-center font-mono text-[11px] text-[#9AA5AC]">
              <p>Atención directa: 56 6298 9202</p>
              <p className="mt-1">Destiladora del Norte · Colotlán, Jalisco</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
