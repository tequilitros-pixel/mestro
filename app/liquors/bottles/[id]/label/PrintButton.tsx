"use client";

import { PrinterIcon } from "@/components/ui/icons";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] print:hidden"
    >
      <PrinterIcon className="h-5 w-5 shrink-0" />
      Imprimir etiqueta
    </button>
  );
}