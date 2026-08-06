"use client";

import { useState } from "react";
import ProductForm from "./ProductForm";

type EventPackage = { id: string; name: string };

export default function NewProductModal({
  packages,
}: {
  packages: EventPackage[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
      >
        + Nuevo producto
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-dim/80 p-3 sm:p-6">
          <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface-container shadow-2xl">
            <header className="flex shrink-0 items-center justify-between border-b border-outline-variant px-6 py-5 sm:px-8">
              <h2 className="text-xl font-bold text-on-surface">Nuevo producto</h2>

              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-lg px-2 py-1 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              >
                ✕
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <ProductForm packages={packages} onSuccess={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
