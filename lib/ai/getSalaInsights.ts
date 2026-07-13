import Anthropic from "@anthropic-ai/sdk";
import { analyzeLotHistory } from "@/lib/brain/analyzeLotHistory";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type SalaInsights = {
  resumen: string;
  fortalezas: string[];
  riesgos: string[];
  recomendaciones: string[];
  prediccion: string;
};

export async function getSalaInsights(): Promise<SalaInsights | null> {
  const historial = await analyzeLotHistory();

  if (historial.lots.length === 0) {
    return null;
  }

  const datosParaIA = {
    totalLotes: historial.lots.length,
    extraccionPromedio: historial.averageExtraction,
    horasCoccionPromedio: historial.averageCookingHours,
    costoPorLitroPromedio: historial.averageCostPerLiter,
    tendenciaExtraccion: historial.trend.extraction,
    tendenciaCosto: historial.trend.costPerLiter,
    mejorLote: historial.bestLot,
    peorLote: historial.worstLot,
    lotes: historial.lots.map((l) => ({
      codigo: l.code,
      extraccion: l.extraction,
      alcohol: l.alcohol,
      horasCoccion: l.cookingHours,
      litrosProducidos: l.litersProduced,
      costoPorLitro: l.costPerLiter,
    })),
  };

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system:
      "Eres MAESTRO, el asistente de inteligencia de una destiladora de tequila artesanal llamada Destiladora del Norte. Analizas datos reales de producción y das observaciones prácticas, directas y útiles para el dueño. Hablas en español de México, tono profesional pero cercano, sin tecnicismos innecesarios.",
    messages: [
      {
        role: "user",
        content: `Aquí están los datos históricos de producción de la destiladora:\n\n${JSON.stringify(datosParaIA, null, 2)}\n\nResponde ÚNICAMENTE con un JSON válido (sin texto antes ni después, sin markdown) con esta forma exacta:\n{\n  "resumen": "un párrafo breve resumiendo el estado general de la producción",\n  "fortalezas": ["punto 1", "punto 2"],\n  "riesgos": ["punto 1", "punto 2"],\n  "recomendaciones": ["punto 1", "punto 2", "punto 3"],\n  "prediccion": "una frase sobre hacia dónde va la tendencia si todo sigue igual"\n}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    return JSON.parse(textBlock.text);
  } catch {
    return null;
  }
}
