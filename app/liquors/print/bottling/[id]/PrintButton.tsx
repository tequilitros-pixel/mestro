"use client";

type PrintButtonProps = {
  labelCount: number;
};

export default function PrintButton({
  labelCount,
}: PrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-black px-5 py-3 font-bold text-white transition hover:bg-neutral-800 print:hidden"
    >
      🖨️ Imprimir {labelCount}{" "}
      {labelCount === 1 ? "etiqueta" : "etiquetas"}
    </button>
  );
}