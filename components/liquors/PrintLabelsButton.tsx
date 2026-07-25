"use client";

import { usePathname, useSearchParams } from "next/navigation";

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
      className="flex-1 rounded-2xl bg-green-600 px-6 py-4 font-black text-white transition hover:bg-green-500"
    >
      🖨️ Imprimir etiquetas
    </button>
  );
}