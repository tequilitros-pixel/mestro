"use client";

import Link from "next/link";
import { AlertCircleIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-error/20 blur-xl rounded-full" />
            <AlertCircleIcon className="relative h-16 w-16 text-error" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-primary mb-2">404</h1>

        <h2 className="text-2xl font-bold text-on-surface mb-3">
          Página no encontrada
        </h2>

        <p className="text-on-surface-variant mb-6">
          La página que buscas no existe o ha sido movida a otro lugar.
        </p>

        <div className="space-y-3">
          <Link
            href="/"
            className="inline-block w-full rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary hover:opacity-90 transition"
          >
            Ir al Home
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-block w-full rounded-lg border border-outline-variant bg-surface-container px-6 py-3 font-semibold text-on-surface hover:bg-surface-container-high transition"
          >
            Volver Atrás
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-outline-variant">
          <p className="text-xs text-on-surface-variant mb-3">
            ¿Necesitas ayuda?
          </p>
          <Link
            href="/support"
            className="text-sm text-primary hover:underline font-medium"
          >
            Contactar soporte
          </Link>
        </div>
      </div>
    </main>
  );
}
