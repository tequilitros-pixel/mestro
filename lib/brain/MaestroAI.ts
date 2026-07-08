type Input = {
  expectedLiters: number;
  confidence: number;
  recommendation: string;
  alerts: string[];
  recommendations: string[];
};

export class MaestroAI {
  static morningBrief(input: Input) {
    let text = "Buenos días, José.\n\n";

    if (input.alerts.length === 0) {
      text += "No encontré riesgos críticos en la planta.\n\n";
    } else {
      text +=
        `Detecté ${input.alerts.length} alerta(s) que requieren atención.\n\n`;
    }

    text +=
      `Mi recomendación principal es:\n${input.recommendation}\n\n`;

    if (input.recommendations.length > 0) {
      text += "Acciones sugeridas:\n";

      input.recommendations.forEach((r) => {
        text += `• ${r}\n`;
      });

      text += "\n";
    }

    text +=
      `Producción estimada: ${input.expectedLiters} litros.\n`;

    text +=
      `Confianza del modelo: ${input.confidence}%.\n`;

    return text;
  }
}