export type LiquorRecipeStepDefinition = {
  position: number;
  title: string;
  instruction: string;
  procedure: string[];
  checks: string[];
  ingredient?: string;
  minutes?: number;
  hours?: number;
};

export const recipeSteps: Record<
  string,
  LiquorRecipeStepDefinition[]
> = {
  zarzamora: [
    {
      position: 1,
      title: "Preparar el tanque",
      instruction:
        "Preparar el tanque antes de comenzar la elaboración.",
      procedure: [
        "Verificar que el tanque esté completamente limpio.",
        "Confirmar que no existan residuos del lote anterior.",
        "Cerrar la válvula inferior del tanque.",
        "Verificar que el agitador funcione correctamente.",
        "Colocar la identificación del lote en el tanque.",
      ],
      checks: [
        "Tanque limpio.",
        "Válvula cerrada.",
        "Agitador funcionando.",
        "Lote correctamente identificado.",
      ],
    },

    {
      position: 2,
      title: "Agregar el agua",
      ingredient: "Agua",
      instruction:
        "Agregar al tanque toda el agua calculada para el lote.",
      procedure: [
        "Encender el agitador a velocidad baja.",
        "Medir la cantidad de agua indicada por MAESTRO.",
        "Agregar toda el agua al tanque.",
        "Mantener el agitador funcionando mientras se prepara el siguiente ingrediente.",
      ],
      checks: [
        "Se agregó toda el agua indicada.",
        "El agitador permanece encendido.",
        "No existen fugas en el tanque.",
      ],
    },

    {
      position: 3,
      title: "Disolver el azúcar",
      ingredient: "Azúcar",
      instruction:
        "Agregar y disolver completamente el azúcar.",
      procedure: [
        "Mantener el agitador encendido.",
        "Agregar el azúcar poco a poco, sin vaciar toda la cantidad de una sola vez.",
        "Esperar a que cada porción comience a disolverse antes de agregar la siguiente.",
        "Continuar hasta incorporar toda la cantidad indicada.",
        "Mantener la agitación hasta que no existan cristales ni azúcar acumulada en el fondo.",
      ],
      checks: [
        "Se agregó toda el azúcar indicada.",
        "No existen cristales visibles.",
        "No hay azúcar acumulada en el fondo.",
        "La mezcla es uniforme.",
      ],
    },

    {
      position: 4,
      title: "Agregar el ácido cítrico",
      ingredient: "Ácido cítrico",
      instruction:
        "Incorporar completamente el ácido cítrico.",
      procedure: [
        "Mantener el agitador funcionando.",
        "Agregar el ácido cítrico lentamente.",
        "Evitar vaciar toda la cantidad en un solo punto.",
        "Continuar mezclando hasta que no existan grumos visibles.",
      ],
      checks: [
        "Se agregó toda la cantidad indicada.",
        "No existen grumos.",
        "El ácido cítrico quedó completamente incorporado.",
      ],
    },

    {
      position: 5,
      title: "Agregar el concentrado de zarzamora",
      ingredient: "Concentrado de zarzamora",
      instruction:
        "Incorporar completamente el concentrado de zarzamora.",
      procedure: [
        "Medir la cantidad indicada de concentrado.",
        "Agregar el concentrado lentamente al tanque.",
        "Mantener el agitador encendido.",
        "Continuar mezclando hasta obtener un color uniforme.",
      ],
      checks: [
        "Se agregó todo el concentrado indicado.",
        "El color de la mezcla es uniforme.",
        "No quedan residuos de concentrado en el recipiente de medición.",
      ],
    },

    {
      position: 6,
      title: "Agregar el tequila",
      ingredient: "Tequila 36° Alc.",
      instruction:
        "Agregar el tequila y mezclar hasta homogeneizar.",
      procedure: [
        "Mantener el agitador funcionando a velocidad baja.",
        "Medir la cantidad de tequila indicada.",
        "Agregar el tequila lentamente para evitar salpicaduras.",
        "Mantener el tanque cubierto tanto como sea posible.",
        "Continuar revolviendo hasta que el producto quede completamente uniforme.",
      ],
      checks: [
        "Se agregó todo el tequila indicado.",
        "No existen diferencias visibles de color.",
        "La mezcla está completamente homogénea.",
      ],
    },

    {
      position: 7,
      title: "Homogeneizar la mezcla",
      instruction:
        "Mezclar completamente el producto antes del reposo.",
      procedure: [
        "Mantener el agitador funcionando.",
        "Revisar visualmente la mezcla en diferentes puntos del tanque.",
        "Continuar revolviendo hasta que el color sea uniforme.",
        "Confirmar que no existan sedimentos ni ingredientes sin incorporar.",
      ],
      checks: [
        "El color es uniforme.",
        "No existen sedimentos visibles.",
        "La mezcla está completamente homogénea.",
      ],
      minutes: 15,
    },

    {
      position: 8,
      title: "Iniciar el reposo",
      instruction:
        "Cerrar e identificar el tanque para comenzar el reposo.",
      procedure: [
        "Apagar el agitador.",
        "Cerrar correctamente el tanque.",
        "Confirmar que la válvula inferior permanezca cerrada.",
        "Verificar que el tanque esté identificado con el código del lote.",
        "Dejar el producto en un lugar fresco y sin exposición directa al sol.",
      ],
      checks: [
        "Agitador apagado.",
        "Tanque correctamente cerrado.",
        "Válvula cerrada.",
        "Lote identificado.",
        "Producto protegido de la luz directa.",
      ],
      hours: 48,
    },

    {
      position: 9,
      title: "Liberar el lote",
      instruction:
        "Verificar el producto y liberarlo para embotellado.",
      procedure: [
        "Confirmar que el periodo de reposo haya terminado.",
        "Abrir el tanque y revisar visualmente el producto.",
        "Verificar que el color sea uniforme.",
        "Confirmar que no existan sedimentos visibles.",
        "Registrar cualquier observación antes de liberar el lote.",
      ],
      checks: [
        "Reposo completado.",
        "Color correcto.",
        "Producto sin sedimentos visibles.",
        "Lote listo para embotellado.",
      ],
    },
  ],
};