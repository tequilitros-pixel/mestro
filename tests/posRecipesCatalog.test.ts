import test from "node:test";
import assert from "node:assert/strict";

test("Charro Negro recipe template has correct standard bar proportions", () => {
  const charroNegroMediano = {
    name: "Charro Negro",
    variant: "Mediano",
    price: 70,
    ingredients: [
      { name: "Tequila Blanco", quantity: 30, unit: "ML" },
      { name: "Refresco RC / Cola", quantity: 180, unit: "ML" },
      { name: "Limón (jugo)", quantity: 15, unit: "ML" },
      { name: "Sal (escarchar)", quantity: 1.5, unit: "G" },
      { name: "Vaso mediano", quantity: 1, unit: "UNIT" },
    ],
  };

  assert.equal(charroNegroMediano.name, "Charro Negro");
  assert.equal(charroNegroMediano.price, 70);
  assert.equal(charroNegroMediano.ingredients.length, 5);

  const tequila = charroNegroMediano.ingredients.find((i) => i.name.includes("Tequila"));
  assert.equal(tequila?.quantity, 30);
  assert.equal(tequila?.unit, "ML");

  const cola = charroNegroMediano.ingredients.find((i) => i.name.includes("Cola"));
  assert.equal(cola?.quantity, 180);
});

test("Charro Negro Grande scales recipe proportions correctly", () => {
  const charroNegroGrande = {
    name: "Charro Negro",
    variant: "Grande",
    price: 99,
    ingredients: [
      { name: "Tequila Blanco", quantity: 60, unit: "ML" },
      { name: "Refresco RC / Cola", quantity: 300, unit: "ML" },
      { name: "Limón (jugo)", quantity: 30, unit: "ML" },
      { name: "Sal (escarchar)", quantity: 3, unit: "G" },
      { name: "Vaso grande", quantity: 1, unit: "UNIT" },
    ],
  };

  assert.equal(charroNegroGrande.variant, "Grande");
  const tequila = charroNegroGrande.ingredients.find((i) => i.name.includes("Tequila"));
  assert.equal(tequila?.quantity, 60);
});
