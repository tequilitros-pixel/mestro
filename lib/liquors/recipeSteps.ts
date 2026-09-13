export type LiquorRecipeStepDefinition = {
  position: number;
  title: string;
  instruction: string;
  procedure: string[];
  checks: string[];

  type?:
    | "PREPARATION"
    | "INGREDIENT"
    | "HEATING"
    | "COOLING"
    | "MIXING"
    | "WAIT"
    | "MEASUREMENT"
    | "QUALITY_CHECK"
    | "FINISH";

  ingredient?: string;
  minutes?: number;
  hours?: number;

  measurementLabel?: string;
  measurementUnit?: string;
  minimumValue?: number;
  maximumValue?: number;
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

  sangria: [
    {
      position: 1,
      title: "Preparar el tanque",
      instruction:
        "Preparar el tanque y el equipo antes de iniciar la elaboración de Sangría.",
      procedure: [
        "Verificar que el tanque esté limpio y sin residuos del lote anterior.",
        "Cerrar la válvula inferior del tanque.",
        "Comprobar que el agitador funcione correctamente.",
        "Preparar recipientes y utensilios de medición limpios.",
        "Colocar la identificación correspondiente al lote.",
      ],
      checks: [
        "Tanque limpio.",
        "Válvula inferior cerrada.",
        "Agitador funcionando.",
        "Utensilios limpios.",
        "Lote identificado.",
      ],
    },
    {
      position: 2,
      title: "Agregar Jugo Tampico",
      ingredient: "Jugo Tampico",
      instruction:
        "Agregar al tanque toda la cantidad de Jugo Tampico calculada por MAESTRO.",
      procedure: [
        "Confirmar que la válvula inferior del tanque esté cerrada.",
        "Medir la cantidad indicada por MAESTRO.",
        "Agregar todo el Jugo Tampico al tanque.",
        "Evitar derrames durante el vaciado.",
      ],
      checks: [
        "Se agregó toda la cantidad indicada.",
        "No existen derrames importantes.",
        "La válvula permanece cerrada.",
      ],
    },
    {
      position: 3,
      title: "Agregar el agua natural",
      ingredient: "Agua natural",
      instruction:
        "Agregar al tanque toda el agua natural calculada para el lote.",
      procedure: [
        "Medir la cantidad de agua indicada por MAESTRO.",
        "Agregar toda el agua al tanque.",
        "Encender el agitador a velocidad baja.",
        "Comprobar que no existan fugas.",
      ],
      checks: [
        "Se agregó toda el agua indicada.",
        "El agitador está funcionando.",
        "No existen fugas.",
      ],
    },
    {
      position: 4,
      title: "Disolver el azúcar",
      ingredient: "Azúcar",
      instruction:
        "Agregar lentamente el azúcar hasta conseguir su disolución completa.",
      procedure: [
        "Mantener el agitador funcionando.",
        "Agregar el azúcar poco a poco.",
        "Evitar vaciar toda la cantidad de una sola vez.",
        "Esperar a que cada porción comience a disolverse antes de agregar la siguiente.",
        "Continuar mezclando hasta que no existan cristales visibles.",
        "Revisar que no quede azúcar acumulada en el fondo.",
      ],
      checks: [
        "Se agregó toda el azúcar indicada.",
        "No existen cristales visibles.",
        "No hay azúcar acumulada en el fondo.",
        "La mezcla es uniforme.",
      ],
    },
    {
      position: 5,
      title: "Agregar el ácido cítrico",
      ingredient: "Ácido cítrico",
      instruction:
        "Agregar lentamente el ácido cítrico para evitar grumos y concentraciones localizadas.",
      procedure: [
        "Mantener el agitador funcionando.",
        "Agregar el ácido cítrico lentamente y de manera distribuida.",
        "Evitar vaciar toda la cantidad en un solo punto.",
        "Continuar mezclando hasta que no existan grumos visibles.",
      ],
      checks: [
        "Se agregó toda la cantidad indicada.",
        "No existen grumos visibles.",
        "El ácido cítrico quedó completamente incorporado.",
      ],
    },
    {
      position: 6,
      title: "Agregar el chamoy",
      ingredient: "Chamoy",
      instruction:
        "Incorporar completamente el chamoy a la preparación.",
      procedure: [
        "Medir la cantidad de chamoy indicada por MAESTRO.",
        "Agregar el chamoy lentamente al tanque.",
        "Enjuagar el recipiente de medición con una pequeña cantidad de la mezcla si quedan residuos.",
        "Mantener el agitador funcionando.",
      ],
      checks: [
        "Se agregó todo el chamoy indicado.",
        "No quedan residuos importantes en el recipiente.",
        "El chamoy quedó incorporado.",
      ],
    },
    {
      position: 7,
      title: "Agregar la Salsa Inigualable",
      ingredient: "Salsa Inigualable",
      instruction:
        "Agregar exactamente la cantidad calculada de Salsa Inigualable.",
      procedure: [
        "Confirmar la cantidad indicada por MAESTRO.",
        "Contar cuidadosamente las gotas.",
        "Agregar las gotas directamente a la mezcla.",
        "Mantener el agitador funcionando.",
      ],
      checks: [
        "Se agregó la cantidad exacta de gotas.",
        "No se agregó salsa adicional.",
        "La salsa quedó incorporada.",
      ],
    },
    {
      position: 8,
      title: "Agregar el sorbato de potasio",
      ingredient: "Sorbato de potasio",
      instruction:
        "Disolver e incorporar completamente el sorbato de potasio.",
      procedure: [
        "Medir la cantidad indicada de sorbato de potasio.",
        "Tomar una pequeña cantidad de líquido de la preparación en un recipiente limpio.",
        "Disolver el sorbato en ese líquido.",
        "Reincorporar la solución al tanque.",
        "Mantener la agitación hasta su completa distribución.",
      ],
      checks: [
        "Se agregó toda la cantidad indicada.",
        "El sorbato fue previamente disuelto.",
        "No existen partículas visibles.",
        "El sorbato quedó completamente distribuido.",
      ],
    },
    {
      position: 9,
      title: "Homogeneizar la Sangría",
      instruction:
        "Mezclar la preparación hasta obtener un producto completamente uniforme.",
      procedure: [
        "Mantener el agitador funcionando.",
        "Revisar visualmente la mezcla en distintos puntos del tanque.",
        "Confirmar que el color sea uniforme.",
        "Comprobar que no existan cristales, grumos ni sedimentos.",
        "Continuar mezclando durante el tiempo indicado.",
      ],
      checks: [
        "El color es uniforme.",
        "No existen cristales visibles.",
        "No existen grumos.",
        "No existen sedimentos.",
        "La preparación está completamente homogénea.",
      ],
      minutes: 15,
    },
    {
      position: 10,
      title: "Iniciar el reposo",
      instruction:
        "Cerrar e identificar el tanque para comenzar el periodo de reposo.",
      procedure: [
        "Apagar el agitador.",
        "Cerrar correctamente el tanque.",
        "Confirmar que la válvula inferior esté cerrada.",
        "Verificar que el tanque conserve la identificación del lote.",
        "Mantener el producto en un lugar fresco y sin exposición directa al sol.",
        "Registrar la hora de inicio del reposo.",
      ],
      checks: [
        "Agitador apagado.",
        "Tanque correctamente cerrado.",
        "Válvula inferior cerrada.",
        "Lote identificado.",
        "Hora de inicio registrada.",
        "Producto protegido de la luz directa.",
      ],
      hours: 12,
    },
    {
      position: 11,
      title: "Liberar la Sangría",
      instruction:
        "Revisar el producto después del reposo y liberarlo para embotellado.",
      procedure: [
        "Confirmar que hayan transcurrido al menos 12 horas de reposo.",
        "Abrir el tanque y revisar visualmente la preparación.",
        "Verificar que el color sea uniforme.",
        "Confirmar que no existan cristales, grumos o sedimentos visibles.",
        "Revisar aroma y apariencia general.",
        "Registrar cualquier observación antes de liberar el lote.",
      ],
      checks: [
        "Reposo mínimo completado.",
        "Color uniforme.",
        "Producto sin cristales visibles.",
        "Producto sin grumos.",
        "Producto sin sedimentos visibles.",
        "Lote listo para embotellado.",
      ],
    },
  ],
};