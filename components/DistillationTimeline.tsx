import { DistillationEvent } from "@prisma/client";

const EVENT_LABELS: Record<string, string> = {
  INICIO_CALENTAMIENTO: "🔥 Inicio de calentamiento",
  TEMPERATURA: "🌡️ Temperatura registrada",
  ALCOHOL: "🥃 Lectura de alcohol",
  LITROS: "🪣 Registro de litros",
  OBSERVACION: "📝 Observación",
  CORTE_CABEZAS: "✂️ Corte de cabezas",
  INICIO_CORAZON: "❤️ Inicio de corazón",
  FIN_CORAZON: "💛 Fin de corazón",
  INICIO_COLAS: "🪣 Inicio de colas",
  FIN_DESTILACION: "🏁 Destilación finalizada",
};

export default function DistillationTimeline({
  events,
}: {
  events: DistillationEvent[];
}) {
  return (
    <section className="mt-8 rounded-2xl bg-slate-900 p-8">
      <h2 className="mb-8 text-2xl font-bold">Línea de tiempo</h2>

      {events.length === 0 ? (
        <p className="text-slate-400">Aún no hay eventos registrados.</p>
      ) : (
        <div className="space-y-6">
          {events.map((event) => (
            <div key={event.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-4 w-4 rounded-full bg-amber-400" />
                <div className="mt-1 h-full w-[2px] bg-slate-700" />
              </div>

              <div className="flex-1 rounded-xl bg-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-amber-400">
                    {EVENT_LABELS[event.type] ?? event.type}
                  </h3>

                  <p className="text-sm text-slate-400">
                    {event.createdAt.toLocaleString()}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300 md:grid-cols-4">
                  {event.temperature !== null && (
                    <p>🌡️ Alambique: {event.temperature} °C</p>
                  )}

                  {event.outputTemperature !== null && (
                    <p>🌬️ Salida: {event.outputTemperature} °C</p>
                  )}

                  {event.alcohol !== null && (
                    <p>🥃 Alcohol leído: {event.alcohol} %</p>
                  )}

                  {event.alcoholCorrected !== null && (
                    <p>✅ Alcohol corregido: {event.alcoholCorrected} %</p>
                  )}

                  {event.liters !== null && (
                    <p>🪣 Litros: {event.liters} L</p>
                  )}

                  {event.notes && (
                    <p className="col-span-2 md:col-span-4">
                      📝 {event.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}