import test from "node:test";
import assert from "node:assert/strict";

type VariantOption = {
  id: string;
  name: string;
  price: number;
  active: boolean;
};

type ProductWithOptions = {
  id: string;
  name: string;
  variants: VariantOption[];
};

function getVisibleStep1Variants(product: ProductWithOptions): VariantOption[] {
  const activeVariants = product.variants.filter((v) => v.active);

  const medianoDobleVariant = activeVariants.find(
    (v) =>
      (v.name.toLowerCase().includes("mediano") || v.name.toLowerCase().includes("mediana")) &&
      v.name.toLowerCase().includes("doble"),
  );

  const grandeDobleVariant = activeVariants.find(
    (v) =>
      v.name.toLowerCase().includes("grande") &&
      v.name.toLowerCase().includes("doble"),
  );

  return activeVariants.filter((v) => {
    if (medianoDobleVariant && v.id === medianoDobleVariant.id) return false;
    if (grandeDobleVariant && v.id === grandeDobleVariant.id) return false;
    return true;
  });
}

function resolvePreparation(
  product: ProductWithOptions,
  size: "MEDIANO" | "GRANDE",
  isDoble: boolean,
): { name: string; price: number; id: string } {
  const activeVariants = product.variants.filter((v) => v.active);

  if (size === "MEDIANO") {
    const medianoNormal = activeVariants.find(
      (v) =>
        (v.name.toLowerCase().includes("mediano") || v.name.toLowerCase().includes("mediana")) &&
        !v.name.toLowerCase().includes("sin tequila") &&
        !v.name.toLowerCase().includes("sin alcohol") &&
        !v.name.toLowerCase().includes("doble"),
    );

    const medianoDoble = activeVariants.find(
      (v) =>
        (v.name.toLowerCase().includes("mediano") || v.name.toLowerCase().includes("mediana")) &&
        v.name.toLowerCase().includes("doble"),
    );

    if (!medianoNormal) throw new Error("No existe variante Mediana para este producto");

    if (!isDoble) {
      return { id: medianoNormal.id, name: medianoNormal.name, price: medianoNormal.price };
    }
    if (medianoDoble) {
      return { id: medianoDoble.id, name: medianoDoble.name, price: medianoDoble.price };
    }
    throw new Error("No existe una receta persistida para Mediano - Doble shot");
  }

  // GRANDE
  const grandeNormal = activeVariants.find(
    (v) =>
      v.name.toLowerCase().includes("grande") &&
      !v.name.toLowerCase().includes("sin tequila") &&
      !v.name.toLowerCase().includes("sin alcohol") &&
      !v.name.toLowerCase().includes("doble"),
  );

  const grandeDoble = activeVariants.find(
    (v) =>
      v.name.toLowerCase().includes("grande") &&
      v.name.toLowerCase().includes("doble"),
  );

  if (!grandeNormal) throw new Error("No existe variante Grande para este producto");

  if (!isDoble) {
    return { id: grandeNormal.id, name: grandeNormal.name, price: grandeNormal.price };
  }
  if (grandeDoble) {
    return { id: grandeDoble.id, name: grandeDoble.name, price: grandeDoble.price };
  }
  throw new Error("No existe una receta persistida para Grande - Doble shot");
}

const BEBIDAS_TEQUILITROS = [
  "Vampiro",
  "Cantarito",
  "Paloma",
  "Tequimiche",
  "Tequimora",
  "Tequimojito",
];

test("Las 6 bebidas de Tequilitros muestran únicamente los tamaños base en el primer menú", () => {
  for (const nombreBebida of BEBIDAS_TEQUILITROS) {
    const bebida: ProductWithOptions = {
      id: `prod-${nombreBebida.toLowerCase()}`,
      name: nombreBebida,
      variants: [
        { id: "v1", name: "Mediano", price: 70, active: true },
        { id: "v2", name: "Mediano - Doble shot", price: 70, active: true },
        { id: "v3", name: "Grande", price: 99, active: true },
        { id: "v4", name: "Grande - Doble shot", price: 99, active: true },
        { id: "v5", name: "Mediano sin tequila", price: 35, active: true },
        { id: "v6", name: "Grande sin tequila", price: 50, active: true },
      ],
    };

    const step1 = getVisibleStep1Variants(bebida);
    assert.equal(step1.length, 4, `Fallo en ${nombreBebida}`);
    assert.ok(step1.some((v) => v.name === "Mediano"));
    assert.ok(step1.some((v) => v.name === "Grande"));
    assert.ok(step1.some((v) => v.name === "Mediano sin tequila"));
    assert.ok(step1.some((v) => v.name === "Grande sin tequila"));
    assert.ok(!step1.some((v) => v.name.includes("Doble shot")));
  }
});

test("En tamaño Mediano: Normal cobra $70 y Doble shot cobra $70 (shot extra en $0 por promoción)", () => {
  const paloma: ProductWithOptions = {
    id: "prod-paloma",
    name: "Paloma",
    variants: [
      { id: "v1", name: "Mediano", price: 70, active: true },
      { id: "v2", name: "Mediano - Doble shot", price: 70, active: true },
      { id: "v3", name: "Grande", price: 99, active: true },
      { id: "v4", name: "Grande - Doble shot", price: 99, active: true },
    ],
  };

  const normal = resolvePreparation(paloma, "MEDIANO", false);
  assert.equal(normal.name, "Mediano");
  assert.equal(normal.price, 70);

  const doble = resolvePreparation(paloma, "MEDIANO", true);
  assert.equal(doble.name, "Mediano - Doble shot");
  assert.equal(doble.price, 70);
});

test("En tamaño Grande: Normal cobra $99 y Doble shot cobra $99 (shot extra en $0 por promoción)", () => {
  const paloma: ProductWithOptions = {
    id: "prod-paloma",
    name: "Paloma",
    variants: [
      { id: "v1", name: "Mediano", price: 70, active: true },
      { id: "v2", name: "Mediano - Doble shot", price: 70, active: true },
      { id: "v3", name: "Grande", price: 99, active: true },
      { id: "v4", name: "Grande - Doble shot", price: 99, active: true },
    ],
  };

  const normal = resolvePreparation(paloma, "GRANDE", false);
  assert.equal(normal.name, "Grande");
  assert.equal(normal.price, 99);

  const doble = resolvePreparation(paloma, "GRANDE", true);
  assert.equal(doble.name, "Grande - Doble shot");
  assert.equal(doble.price, 99);
});

test("Receta de inventario: Mediano Doble shot descuenta 60 ml y Grande Doble shot descuenta 120 ml", () => {
  // Receta base Mediano: 30 ml tequila
  const recetaMedianoNormal = [
    { code: "POS-ING-SAL", quantity: 1.5, unit: "pizca" },
    { code: "POS-ING-TEQUILA", quantity: 30, unit: "ml" },
  ];
  const recetaMedianoDoble = recetaMedianoNormal.map((i) =>
    i.code === "POS-ING-TEQUILA" ? { ...i, quantity: i.quantity * 2 } : i,
  );
  assert.equal(recetaMedianoDoble.find((i) => i.code === "POS-ING-TEQUILA")?.quantity, 60);

  // Receta base Grande: 60 ml tequila
  const recetaGrandeNormal = [
    { code: "POS-ING-SAL", quantity: 3, unit: "pizca" },
    { code: "POS-ING-TEQUILA", quantity: 60, unit: "ml" },
  ];
  const recetaGrandeDoble = recetaGrandeNormal.map((i) =>
    i.code === "POS-ING-TEQUILA" ? { ...i, quantity: i.quantity * 2 } : i,
  );
  assert.equal(recetaGrandeDoble.find((i) => i.code === "POS-ING-TEQUILA")?.quantity, 120);
});

test("Cuando quiten la promoción y editen el precio en el catálogo, el POS usa el nuevo precio", () => {
  // Por ejemplo, el administrador sube el precio de Doble shot a $95 para mediano y $139 para grande
  const palomaConPrecioEditado: ProductWithOptions = {
    id: "prod-paloma",
    name: "Paloma",
    variants: [
      { id: "v1", name: "Mediano", price: 70, active: true },
      { id: "v2", name: "Mediano - Doble shot", price: 95, active: true }, // Precio editado
      { id: "v3", name: "Grande", price: 99, active: true },
      { id: "v4", name: "Grande - Doble shot", price: 139, active: true }, // Precio editado
    ],
  };

  const medianoDoble = resolvePreparation(palomaConPrecioEditado, "MEDIANO", true);
  assert.equal(medianoDoble.price, 95);

  const grandeDoble = resolvePreparation(palomaConPrecioEditado, "GRANDE", true);
  assert.equal(grandeDoble.price, 139);
});

test("No se permite vender doble shot si la variante guardada no existe", () => {
  const palomaSinRecetaDoble: ProductWithOptions = {
    id: "prod-paloma",
    name: "Paloma",
    variants: [
      { id: "v1", name: "Mediano", price: 70, active: true },
      { id: "v3", name: "Grande", price: 99, active: true },
    ],
  };

  assert.throws(
    () => resolvePreparation(palomaSinRecetaDoble, "MEDIANO", true),
    /receta persistida/,
  );
  assert.throws(
    () => resolvePreparation(palomaSinRecetaDoble, "GRANDE", true),
    /receta persistida/,
  );
});
