export const CookingKnowledge = {
  idealTemperatureC: 92,

  temperatureRange: {
    min: 90,
    ideal: 92,
    max: 95,
  },

  idealCookingHours: {
    min: 32,
    max: 36,
  },

  risks: {
    lowTemperature:
      "Una temperatura menor a 90°C puede retrasar la cocción y dejar azúcares sin convertir correctamente.",

    highTemperature:
      "Una temperatura mayor a 95°C puede aumentar el riesgo de caramelización y afectar el rendimiento.",

    overCooking:
      "Una cocción demasiado larga puede oscurecer mieles, aumentar notas cocidas fuertes y afectar eficiencia.",

    unevenCooking:
      "Diferencias grandes entre termómetros superior, medio e inferior pueden indicar cocción dispareja.",
  },

  recommendations: {
    maintainSteam:
      "Mantener vapor estable y evitar cambios bruscos durante la cocción.",

    checkThreePoints:
      "Revisar temperatura superior, media e inferior para confirmar uniformidad.",

    bitterHoney:
      "Registrar salida de mieles amargas al inicio del proceso.",

    sweetHoney:
      "Registrar salida de mieles dulces cuando el agave libere azúcares aprovechables.",

    finishCooking:
      "Finalizar cocción cuando el agave esté suave, dulce y dentro del tiempo objetivo.",
  },
};
