import { DistillationEvent } from "@prisma/client";

export function getSmartStatus(events: DistillationEvent[]) {
  if (events.length === 0) {
    return {
      color: "text-slate-400",
      title: "Esperando inicio",
      message: "Inicia el calentamiento del alambique.",
    };
  }

  const last = events[events.length - 1];

  switch (last.type) {
    case "INICIO_CALENTAMIENTO":
      return {
        color: "text-orange-400",
        title: "🔥 Calentando",
        message: "El alambique está elevando temperatura.",
      };

    case "TEMPERATURA":
      return {
        color: "text-yellow-400",
        title: "🌡 Controlando temperatura",
        message: "Continúa monitoreando el calentamiento.",
      };

    case "CORTE_CABEZAS":
      return {
        color: "text-red-400",
        title: "✂️ Cabezas",
        message: "Separando compuestos volátiles.",
      };

    case "INICIO_CORAZON":
      return {
        color: "text-green-400",
        title: "❤️ Corazón",
        message: "Recolectando la mejor fracción del destilado.",
      };

    case "FIN_CORAZON":
      return {
        color: "text-amber-400",
        title: "🟤 Fin del corazón",
        message: "Prepárate para iniciar colas.",
      };

    case "INICIO_COLAS":
      return {
        color: "text-purple-400",
        title: "🟣 Colas",
        message: "La riqueza alcohólica comenzará a disminuir.",
      };

    case "FIN_DESTILACION":
      return {
        color: "text-cyan-400",
        title: "🏁 Destilación terminada",
        message: "Proceso finalizado correctamente.",
      };

    default:
      return {
        color: "text-slate-400",
        title: "En proceso",
        message: "Registrando datos...",
      };
  }
}