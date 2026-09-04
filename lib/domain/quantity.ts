import { Prisma } from "@prisma/client";

export type QuantityUnit = "UNIT" | "ML";
type DecimalInput = Prisma.Decimal | string | bigint;

const SCALE = 6;

function parseValue(value: DecimalInput) {
  if (typeof value === "string" && !/^-?\d+(\.\d+)?$/.test(value.trim())) {
    throw new Error("Invalid quantity value");
  }
  const decimal = new Prisma.Decimal(value.toString());
  if (!decimal.isFinite()) throw new Error("Invalid quantity value");
  return decimal.toDecimalPlaces(SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

export class Quantity {
  static readonly scale = SCALE;
  readonly unit: QuantityUnit;
  readonly #value: Prisma.Decimal;

  private constructor(value: Prisma.Decimal, unit: QuantityUnit) {
    this.#value = value;
    this.unit = unit;
    Object.freeze(this);
  }

  static from(value: DecimalInput, unit: QuantityUnit) {
    return new Quantity(parseValue(value), unit);
  }

  static zero(unit: QuantityUnit) {
    return Quantity.from("0", unit);
  }

  static nonNegative(value: DecimalInput, unit: QuantityUnit) {
    const quantity = Quantity.from(value, unit);
    if (quantity.isNegative()) throw new Error("Quantity cannot be negative");
    return quantity;
  }

  add(other: Quantity) {
    this.assertCompatible(other);
    return Quantity.from(this.#value.plus(other.#value), this.unit);
  }

  subtract(other: Quantity) {
    this.assertCompatible(other);
    return Quantity.from(this.#value.minus(other.#value), this.unit);
  }

  multiply(multiplier: DecimalInput) {
    return Quantity.from(this.#value.times(multiplier.toString()), this.unit);
  }

  equals(other: Quantity) {
    return this.unit === other.unit && this.#value.equals(other.#value);
  }

  compare(other: Quantity) {
    this.assertCompatible(other);
    return this.#value.comparedTo(other.#value);
  }

  isNegative() {
    return this.#value.isNegative();
  }

  toDecimal() {
    return new Prisma.Decimal(this.#value);
  }

  toString() {
    return this.#value.toFixed(SCALE);
  }

  toJSON() {
    return { value: this.toString(), unit: this.unit };
  }

  private assertCompatible(other: Quantity) {
    if (this.unit !== other.unit) {
      throw new Error(`Incompatible quantity units: ${this.unit} and ${other.unit}`);
    }
  }
}
