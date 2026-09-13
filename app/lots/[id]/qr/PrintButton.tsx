"use client";

import { PrinterIcon } from "@/components/ui/icons";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 font-bold text-white transition duration-150 ease-out hover:scale-[1.04] hover:bg-neutral-800 active:scale-[0.97] print:hidden"
    >
      <PrinterIcon className="h-5 w-5" />
      Imprimir QR
    </button>
  );
}
