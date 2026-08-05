"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeftIcon } from "@/components/ui/icons";

/**
 * Botón universal de "regresar", presente en el header de toda la
 * app. Usa el historial del navegador (router.back()) para volver
 * exactamente a donde estaba el usuario antes. No se muestra en el
 * inicio, ya que ahí no hay a dónde regresar dentro de la app.
 */
export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <button
      onClick={() => router.back()}
      aria-label="Regresar"
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:bg-surface-container hover:text-on-surface"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      Regresar
    </button>
  );
}
