"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { PrinterIcon } from "@/components/ui/icons";

export default function PrintLabelsButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function openPrintPage() {
    const printPath = pathname.replace(/\/preview$/, "/print");
    const query = searchParams.toString();

    window.open(
      `${printPath}${query ? `?${query}` : ""}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <button
      type="button"
      onClick={openPrintPage}
      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-tertiary-fixed-dim px-6 py-4 font-black text-on-surface transition duration-150 ease-out hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]"
    >
      <PrinterIcon className="h-5 w-5" />
      Imprimir etiquetas
    </button>
  );
}