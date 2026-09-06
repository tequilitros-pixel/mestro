import { Prisma } from "@prisma/client";

export type Currency = "MXN";
type DecimalInput = Prisma.Decimal | string | bigint;

const SCALE = 2;
const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;

function decimalFrom(value: DecimalInput): Prisma.Decimal {
  if (typeof value === "string" && !/^-?\d+(\.\d+)?$/.test(value.trim())) {
    throw new Error("Invalid money value");
  }
  const decimal = new Prisma.Decimal(value.toString());
  if (!decimal.isFinite()) throw new Error("Invalid money value");
  return decimal.toDecimalPlaces(SCALE, ROUNDING);
}

export class Money {
  static readonly scale = SCALE;
  static readonly roundingMode = "ROUND_HALF_UP" as const;

  readonly currency: Currency;
  readonly #amount: Prisma.Decimal;

  private constructor(amount: Prisma.Decimal, currency: Currency) {
    this.#amount = amount;
    this.currency = currency;
    Object.freeze(this);
  }

  static from(value: DecimalInput, currency: Currency = "MXN") {
    return new Money(decimalFrom(value), currency);
  }

  static fromLegacyFloat(value: number, currency: Currency = "MXN") {
    if (!Number.isFinite(value)) throw new Error("Invalid legacy money value");
    return Money.from(value.toString(), currency);
  }

  static zero(currency: Currency = "MXN") {
    return Money.from("0", currency);
  }

  static nonNegative(value: DecimalInput, currency: Currency = "MXN") {
    const money = Money.from(value, currency);
    if (money.isNegative()) throw new Error("Money cannot be negative");
    return money;
  }

  add(other: Money) {
    this.assertSameCurrency(other);
    return Money.from(this.#amount.plus(other.#amount), this.currency);
  }

  subtract(other: Money) {
    this.assertSameCurrency(other);
    return Money.from(this.#amount.minus(other.#amount), this.currency);
  }

  multiply(multiplier: Prisma.Decimal | string | bigint) {
    const factor = new Prisma.Decimal(multiplier.toString());
    if (!factor.isFinite()) throw new Error("Invalid money multiplier");
    return Money.from(this.#amount.times(factor), this.currency);
  }

  negate() {
    return Money.from(this.#amount.negated(), this.currency);
  }

  isNegative() {
    return this.#amount.isNegative();
  }

  equals(other: Money) {
    return this.currency === other.currency && this.#amount.equals(other.#amount);
  }

  compare(other: Money) {
    this.assertSameCurrency(other);
    return this.#amount.comparedTo(other.#amount);
  }

  toDecimal() {
    return new Prisma.Decimal(this.#amount);
  }

  toJSON() {
    return { amount: this.toString(), currency: this.currency };
  }

  toString() {
    return this.#amount.toFixed(SCALE);
  }

  private assertSameCurrency(other: Money) {
    if (this.currency !== other.currency) throw new Error("Currency mismatch");
  }
}
