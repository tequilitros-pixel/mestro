/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * AlcoholField
 *
 * Propósito:
 * Campo para registrar grados Gay-Lussac.
 * ==========================================================
 */

import NumberField from "./NumberField";

type AlcoholFieldProps = Omit<
  React.ComponentProps<typeof NumberField>,
  "unit"
>;

export default function AlcoholField(props: AlcoholFieldProps) {
  return (
    <NumberField
      label="Alcohol"
      unit="°GL"
      min={0}
      max={100}
      step={0.1}
      placeholder="55.0"
      {...props}
    />
  );
}