"use client";

export default function PrintLabelsButton() {
  function printLabels() {
    window.print();
  }

  return (
    <button
      type="button"
      onClick={printLabels}
      className="no-print flex-1 rounded-2xl bg-green-600 px-6 py-4 font-black text-white transition hover:bg-green-500"
    >
      🖨️ Imprimir etiquetas
    </button>
  );
}