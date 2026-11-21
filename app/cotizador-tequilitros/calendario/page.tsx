import { getCalendarMonthAction } from "../actions";
import CalendarClient from "./CalendarClient";

export const metadata = {
  title: "Calendario de Disponibilidad | Cotizador Tequilitros",
  description: "Disponibilidad de fechas, cotizaciones pendientes y eventos confirmados de Tequilitros.",
};

export default async function CalendarioPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const daysData = await getCalendarMonthAction(year, month);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <CalendarClient
        initialYear={year}
        initialMonth={month}
        daysData={daysData}
      />
    </div>
  );
}
