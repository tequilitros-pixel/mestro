import { getQuotesListAction, getEmployeeMetricsAction } from "../actions";
import HistorialClient from "./HistorialClient";

export const metadata = {
  title: "Historial de Cotizaciones y Productividad | Maestro",
  description: "Registro de cotizaciones elaboradas y ranking de empleados Tequilitros.",
};

export default async function HistorialPage() {
  const [quotes, leaderboard] = await Promise.all([
    getQuotesListAction(),
    getEmployeeMetricsAction(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <HistorialClient quotes={quotes} leaderboard={leaderboard} />
    </div>
  );
}
