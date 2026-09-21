import { redirect } from "next/navigation";

/** El historial comparte el tablero y sus filtros para evitar dos vistas divergentes. */
export default function CashCutsHistoryPage() {
  redirect("/cash-cuts");
}
