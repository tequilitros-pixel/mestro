"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-black px-5 py-3 font-bold text-white transition hover:bg-neutral-800 print:hidden"
    >
      🖨️ Imprimir etiqueta
    </button>
  );
}