import { redirect } from "next/navigation";

// "Cortes" (esta pantalla) se fusionó con el Inicio del módulo para
// eliminar la duplicación: ambas mostraban la misma lista de cortes
// abiertos. Se conserva esta ruta como redirección por si queda
// algún enlace o marcador apuntando aquí.
export default function DailyCashCutsRedirect() {
  redirect("/cash-cuts");
}
