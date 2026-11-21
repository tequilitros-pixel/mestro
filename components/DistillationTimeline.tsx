import { DistillationEvent } from "@prisma/client";
import {
  FlameIcon,
  ThermometerIcon,
  GlassWaterIcon,
  BucketIcon,
  ClipboardIcon,
  ScissorsIcon,
  HeartIcon,
  CheckIcon,
  type IconProps,
} from "@/components/ui/icons";
import { ComponentType } from "react";

const EVENT_META: Record<
  string,
  { label: string; icon: ComponentType<IconProps> }
> = {
  INICIO_CALENTAMIENTO: {
    label: "Inicio de calentamiento",
    icon: FlameIcon,
  },
  TEMPERATURA: {
    label: "Temperatura registrada",
    icon: ThermometerIcon,
  },
  ALCOHOL: { label: "Lectura de alcohol", icon: GlassWaterIcon },
  LITROS: { label: "Registro de litros", icon: BucketIcon },
  OBSERVACION: { label: "Observación", icon: ClipboardIcon },
  CORTE_CABEZAS: { label: "Corte de cabezas", icon: ScissorsIcon },
  INICIO_CORAZON: { label: "Inicio de corazón", icon: HeartIcon },
  FIN_CORAZON: { label: "Fin de corazón", icon: HeartIcon },
  INICIO_COLAS: { label: "Inicio de colas", icon: BucketIcon },
  FIN_DESTILACION: {
    label: "Destilación finalizada",
    icon: CheckIcon,
  },
};

export default function DistillationTimeline({
  events,
}: {
  events: DistillationEvent[];
}) {
  return (
    <section className="mt-8 rounded-2xl bg-surface-container p-8">
      <h2 className="mb-8 text-2xl font-bold">Línea de tiempo</h2>

      {events.length === 0 ? (
        <p className="text-on-surface-variant">Aún no hay eventos registrados.</p>
      ) : (
        <div className="space-y-6">
          {events.map((event) => {
            const meta = EVENT_META[event.type];
            const EventIcon = meta?.icon ?? ClipboardIcon;

            return (
              <div key={event.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-4 w-4 rounded-full bg-primary" />
                  <div className="mt-1 h-full w-[2px] bg-surface-container-highest" />
                </div>

                <div className="flex-1 rounded-xl bg-surface-container-high p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 font-bold text-on-surface">
                      <EventIcon className="h-4 w-4 text-on-surface-variant" />
                      {meta?.label ?? event.type}
                    </h3>

                    <p className="text-sm text-on-surface-variant">
                      {event.createdAt.toLocaleString()}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-sm text-on-surface-variant md:grid-cols-4">
                    {event.temperature !== null && (
                      <span className="inline-flex items-center gap-1.5">
                        <ThermometerIcon className="h-3.5 w-3.5 shrink-0" />
                        Alambique: {event.temperature} °C
                      </span>
                    )}

                    {event.outputTemperature !== null && (
                      <span className="inline-flex items-center gap-1.5">
                        <ThermometerIcon className="h-3.5 w-3.5 shrink-0" />
                        Salida: {event.outputTemperature} °C
                      </span>
                    )}

                    {event.alcohol !== null && (
                      <span className="inline-flex items-center gap-1.5">
                        <GlassWaterIcon className="h-3.5 w-3.5 shrink-0" />
                        Alcohol leído: {event.alcohol} %
                      </span>
                    )}

                    {event.alcoholCorrected !== null && (
                      <span className="inline-flex items-center gap-1.5">
                        <CheckIcon className="h-3.5 w-3.5 shrink-0" />
                        Alcohol corregido: {event.alcoholCorrected} %
                      </span>
                    )}

                    {event.liters !== null && (
                      <span className="inline-flex items-center gap-1.5">
                        <BucketIcon className="h-3.5 w-3.5 shrink-0" />
                        Litros: {event.liters} L
                      </span>
                    )}

                    {event.notes && (
                      <span className="col-span-2 inline-flex items-center gap-1.5 md:col-span-4">
                        <ClipboardIcon className="h-3.5 w-3.5 shrink-0" />
                        {event.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
