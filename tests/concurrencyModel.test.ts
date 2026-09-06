import assert from "node:assert/strict";
import test from "node:test";

class LockedAggregate {
  private queue = Promise.resolve();
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await work(); } finally { release(); }
  }
}

test("modelo de lock permite exactamente una cancelación y una compensación", async () => {
  const lock = new LockedAggregate();
  let status = "COMPLETADA";
  let inventoryReversals = 0;
  let financialAdjustments = 0;
  const cancel = () => lock.transaction(async () => {
    if (status === "CANCELADA") return "duplicate";
    status = "CANCELADA";
    inventoryReversals += 1;
    financialAdjustments += 1;
    return "cancelled";
  });
  const results = await Promise.all([cancel(), cancel()]);
  assert.deepEqual(results.sort(), ["cancelled", "duplicate"]);
  assert.equal(inventoryReversals, 1);
  assert.equal(financialAdjustments, 1);
});

test("modelo de lock de stock=1 permite exactamente una venta", async () => {
  const lock = new LockedAggregate();
  let stock = 1;
  let sales = 0;
  const sell = () => lock.transaction(async () => {
    if (stock < 1) return "insufficient";
    stock -= 1;
    sales += 1;
    return "completed";
  });
  const results = await Promise.all([sell(), sell()]);
  assert.deepEqual(results.sort(), ["completed", "insufficient"]);
  assert.equal(stock, 0);
  assert.equal(sales, 1);
});

test("modelo de claim idempotente concurrente ejecuta una vez y reproduce resultado", async () => {
  const lock = new LockedAggregate();
  const receipts = new Map<string, { hash: string; result: string }>();
  let executions = 0;
  const run = (id: string, hash: string) => lock.transaction(async () => {
    const receipt = receipts.get(id);
    if (receipt) {
      if (receipt.hash !== hash) return "key_reused";
      return receipt.result;
    }
    executions += 1;
    receipts.set(id, { hash, result: "ok" });
    return "ok";
  });
  assert.deepEqual(await Promise.all([run("op", "same"), run("op", "same")]), ["ok", "ok"]);
  assert.equal(executions, 1);
  assert.equal(await run("op", "different"), "key_reused");
});
