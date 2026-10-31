/**
 * Convierte un número monetario a texto formal en pesos mexicanos.
 * Ejemplo: 1870.08 -> "UN MIL OCHOCIENTOS SETENTA PESOS 08/100 M.N."
 */

const UNIDADES = [
  "",
  "UN",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
];

const DECENAS = [
  "",
  "DIEZ",
  "VEINTE",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];

const ESPECIALES: Record<number, string> = {
  11: "ONCE",
  12: "DOCE",
  13: "TRECE",
  14: "CATORCE",
  15: "QUINCE",
  16: "DIECISÉIS",
  17: "DIECISIETE",
  18: "DIECIOCHO",
  19: "DIECINUEVE",
  21: "VEINTIÚN",
  22: "VEINTIDÓS",
  23: "VEINTITRÉS",
  24: "VEINTICUATRO",
  25: "VEINTICINCO",
  26: "VEINTISÉIS",
  27: "VEINTISIETE",
  28: "VEINTIOCHO",
  29: "VEINTINUEVE",
};

const CENTENAS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

function convertirGrupo(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";

  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const resto = n % 100;

  let texto = CENTENAS[c] ? `${CENTENAS[c]} ` : "";

  if (resto > 0) {
    if (ESPECIALES[resto]) {
      texto += ESPECIALES[resto];
    } else if (d > 0 && u > 0) {
      texto += `${DECENAS[d]} Y ${UNIDADES[u]}`;
    } else if (d > 0) {
      texto += DECENAS[d];
    } else if (u > 0) {
      texto += UNIDADES[u];
    }
  }

  return texto.trim();
}

export function numberToMexicanCurrencyText(amount: number): string {
  if (Number.isNaN(amount) || amount === 0) {
    return "CERO PESOS 00/100 M.N.";
  }

  const absAmount = Math.abs(amount);
  const entero = Math.floor(absAmount);
  const centavos = Math.round((absAmount - entero) * 100);
  const centavosStr = String(centavos).padStart(2, "0");

  if (entero === 0) {
    return `CERO PESOS ${centavosStr}/100 M.N.`;
  }

  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const unidades = entero % 1000;

  const partes: string[] = [];

  if (millones > 0) {
    if (millones === 1) partes.push("UN MILLÓN");
    else partes.push(`${convertirGrupo(millones)} MILLONES`);
  }

  if (miles > 0) {
    if (miles === 1) partes.push("UN MIL");
    else partes.push(`${convertirGrupo(miles)} MIL`);
  }

  if (unidades > 0) {
    partes.push(convertirGrupo(unidades));
  }

  const textoPesos = partes.join(" ").trim();
  const moneda = entero === 1 ? "PESO" : "PESOS";

  return `${textoPesos} ${moneda} ${centavosStr}/100 M.N.`;
}
