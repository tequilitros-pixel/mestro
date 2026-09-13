export type Decision = {
  priority: "BAJA" | "MEDIA" | "ALTA";

  title: string;

  summary: string;

  actions: string[];

  confidence: number;
};

export class DecisionEngine {
  static analyze() : Decision {

    return {

      priority: "MEDIA",

      title: "Sin información suficiente",

      summary:
        "MAESTRO aún no tiene datos suficientes para emitir una recomendación.",

      actions: [
        "Registrar más información del lote.",
        "Actualizar lecturas de producción.",
        "Continuar monitoreando el proceso.",
      ],

      confidence: 10,
    };
  }
}