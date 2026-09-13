"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, RefreshCwIcon } from "@/components/ui/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error para debugging
    console.error("Error capturado:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-error/20 blur-xl rounded-full" />
            <AlertTriangleIcon className="relative h-16 w-16 text-error" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-on-surface mb-2">
          Algo salió mal
        </h1>

        <p className="text-on-surface-variant mb-4">
          Experimentamos un error inesperado. Intenta nuevamente o contacta a soporte si el problema persiste.
        </p>

        {process.env.NODE_ENV === "development" && error.message && (
          <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error/20 text-left">
            <p className="text-xs font-mono text-error/80 break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-error/60 mt-2">
                ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary hover:opacity-90 transition"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Reintentar
          </button>

          <Link
            href="/"
            className="inline-block w-full rounded-lg border border-outline-variant bg-surface-container px-6 py-3 font-semibold text-on-surface hover:bg-surface-container-high transition"
          >
            Ir al Home
          </Link>
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
