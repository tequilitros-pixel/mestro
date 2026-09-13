"use client";

import { PrinterIcon } from "@/components/ui/icons";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:bg-surface-container-high active:scale-[0.97] print:hidden"
    >
      <PrinterIcon className="h-4 w-4" />
      Imprimir / Compartir PDF
    </button>
  );
}
