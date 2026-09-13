export const MaestroKnowledge = {
  cooking: {
    idealTemperatureC: 92,
    minTemperatureC: 90,
    maxTemperatureC: 95,
    idealHours: {
      min: 32,
      max: 36,
    },
    advice: [
      "Mantener la cocción cercana a 92°C.",
      "Evitar cambios bruscos en la inyección de vapor.",
      "Registrar mieles amargas y mieles dulces.",
      "Cuidar que la temperatura sea uniforme en la parte superior, media e inferior.",
    ],
  },

  milling: {
    targetExtractionPercent: 88,
    advice: [
      "Registrar litros de mosto obtenidos.",
      "Medir Brix durante la molienda.",
      "Controlar el agua agregada.",
      "Observar el bagazo para evaluar extracción.",
    ],
  },

  fermentation: {
    idealPh: {
      min: 4.2,
      max: 4.8,
    },
    idealTemperatureC: {
      min: 28,
      max: 32,
    },
    targetAlcoholPercent: {
      min: 6.5,
      max: 7.2,
    },
    advice: [
      "Registrar Brix, pH, temperatura y alcohol.",
      "Verificar que el Brix baje de forma constante.",
      "Observar espuma, olor y actividad.",
      "Preparar destilación cuando el alcohol llegue al objetivo.",
    ],
  },

  distillation: {
    advice: [
      "Registrar litros y grados alcohólicos.",
      "Controlar cortes de cabezas, corazón y colas.",
      "Comparar litros obtenidos contra el rendimiento esperado.",
      "Calcular alcohol absoluto para evaluar eficiencia.",
    ],
  },

  costs: {
    advice: [
      "Registrar agave, gas, mano de obra, levadura y otros insumos.",
      "Calcular costo por litro.",
      "Comparar contra lotes anteriores.",
    ],
  },
};