"use client";

import { PrinterIcon } from "@/components/ui/icons";

export default function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] print:hidden"
    >
      <PrinterIcon className="h-4 w-4 shrink-0" />
      Imprimir recibo
    </button>
  );
}
