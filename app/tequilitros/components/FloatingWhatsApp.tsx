"use client";

const WHATSAPP_URL =
  "https://wa.me/525662989202?text=" +
  encodeURIComponent("Hola, quiero cotizar Tequilitros para mi evento.");

export default function FloatingWhatsApp() {
  return (
    <aside
      aria-label="Atención directa por WhatsApp"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 animate-in fade-in"
    >
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Cotizar evento por WhatsApp con Tequilitros (56 6298 9202)"
        className="group relative flex items-center gap-3 rounded-full border border-[#25D366]/40 bg-[#080B0E]/95 p-3 sm:px-5 sm:py-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-[#25D366] hover:bg-[#12181F]"
      >
        {/* Indicador de estado en línea */}
        <span className="relative flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-75" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#25D366]" />
        </span>

        {/* Ícono de WhatsApp SVG */}
        <svg
          className="h-6 w-6 text-[#25D366] transition-transform group-hover:rotate-12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.476-.15-.676.15-.2.3-.777.98-.952 1.18-.175.2-.351.225-.652.075-.301-.15-1.27-.468-2.42-1.493-.895-.798-1.5-1.784-1.675-2.085-.175-.3-.019-.462.132-.612.136-.135.301-.35.451-.525.15-.176.201-.3.301-.5.1-.2.05-.375-.025-.525-.075-.15-.677-1.633-.928-2.238-.244-.59-.493-.51-.677-.52-.175-.01-.376-.01-.577-.01-.2 0-.527.075-.802.375-.276.3-1.053 1.03-1.053 2.511 0 1.48 1.078 2.91 1.228 3.11.15.2 2.122 3.24 5.141 4.545.718.31 1.278.496 1.716.635.722.23 1.38.197 1.899.12.578-.087 1.78-.727 2.031-1.428.25-.701.25-1.302.175-1.428-.075-.125-.276-.2-.577-.35z" />
          <path d="M12.004 2C6.48 2 2 6.48 2 12c0 1.84.5 3.56 1.37 5.04L2 22l5.09-1.34A9.957 9.957 0 0012.004 22c5.523 0 10.004-4.48 10.004-10S17.527 2 12.004 2zm0 18.2c-1.61 0-3.12-.47-4.4-1.28l-.32-.2-3.02.79.81-2.94-.21-.34A8.164 8.164 0 013.8 12c0-4.52 3.68-8.2 8.204-8.2 4.523 0 8.204 3.68 8.204 8.2 0 4.52-3.681 8.2-8.204 8.2z" />
        </svg>

        <div className="hidden flex-col sm:flex text-left">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#25D366]">
            Cotizar por WhatsApp
          </span>
          <span className="text-xs font-semibold text-[#F5F2EB]">
            56 6298 9202
          </span>
        </div>
      </a>
    </aside>
  );
}
