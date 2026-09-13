"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

/**
 * Muestra un toast de éxito cuando la URL trae un query param de
 * confirmación (ej. `?saved=1`) después de que una server action con
 * `redirect()` trae de vuelta a esta página. Pensado para las
 * páginas de operador (cocción, molienda, fermentación, destilación)
 * donde los formularios son Server Actions puras: no hay forma de
 * mostrar un toast client-side en el momento del submit, así que la
 * confirmación viaja en la URL del redirect.
 *
 * Después de mostrar el mensaje, limpia el query param (router.replace
 * sin agregar entrada al historial) para que no se repita si el
 * operador recarga la página o navega con "atrás".
 *
 * Uso: <SuccessToast params={{ created: "Registro creado exitosamente", saved: "Datos guardados exitosamente" }} />
 */
export default function SuccessToast({ params }: { params: Record<string, string> }) {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();

  useEffect(() => {
    const current = new URLSearchParams(paramsKey);
    const matchedKey = Object.keys(params).find((key) => current.get(key));
    if (!matchedKey) return;

    showToast(params[matchedKey], "success");

    current.delete(matchedKey);
    const query = current.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  return null;
}
