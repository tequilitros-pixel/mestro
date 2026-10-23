import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { databaseActor } from "@/lib/database-context";

type Tx = Prisma.TransactionClient;
const operation = Symbol("contextual-prisma-operation");
type Deferred = { [operation]: (tx: Tx) => Promise<unknown> };

/** Establish identity on the SAME connection/transaction as every runtime query.
 * Lazy operations preserve batch-transaction atomicity; no pool/session SET leaks.
 * Authentication and explicit withRlsContext use the raw client separately.
 */
export function contextualPrisma(raw: PrismaClient): PrismaClient {
  async function transaction(run: (tx: Tx) => Promise<unknown>, options?: object, identity = databaseActor()) {
    const actor = await identity;
    return raw.$transaction(async (tx) => {
      const { setRlsContext } = await import("@/lib/rls");
      await setRlsContext(tx, actor);
      return run(tx);
    }, options);
  }
  function deferred(run: (tx: Tx) => Promise<unknown>) {
    // Capture identity while inside AsyncLocalStorage, not at a later external
    // await of a lazy query returned by withDatabaseActor.
    const identity = databaseActor();
    let pending: Promise<unknown> | undefined;
    const get = () => pending ??= transaction(run, undefined, identity);
    return {
      [operation]: run,
      [Symbol.toStringTag]: "PrismaPromise",
      then: (yes: Parameters<Promise<unknown>["then"]>[0], no: Parameters<Promise<unknown>["then"]>[1]) => get().then(yes, no),
      catch: (no: Parameters<Promise<unknown>["catch"]>[0]) => get().catch(no),
      finally: (done: () => void) => get().finally(done),
    };
  }
  const delegates = new Map<PropertyKey, unknown>();
  return new Proxy(raw, {
    get(target, property) {
      if (property === "$transaction") return (input: ((tx: Tx) => Promise<unknown>) | Deferred[], options?: object) => {
        if (typeof input === "function") return transaction(input, options);
        if (!input.every((item) => typeof item?.[operation] === "function"))
          throw new Error("Use contextual Prisma operations in batch transactions.");
        return transaction(async (tx) => {
          const results = [];
          for (const item of input) results.push(await item[operation](tx));
          return results;
        }, options);
      };
      const value = Reflect.get(target, property);
      if (typeof property === "string" && /^\$(queryRaw|executeRaw)/.test(property))
        return (...args: unknown[]) => deferred((tx) => Reflect.get(tx, property).apply(tx, args));
      if (typeof value === "function") return value.bind(target);
      if (typeof property === "string" && !property.startsWith("_") && !property.startsWith("$") && value && typeof value === "object" && "findMany" in value) {
        if (!delegates.has(property)) delegates.set(property, new Proxy(value, {
          get(delegate, method) {
            const fn = Reflect.get(delegate, method);
            return typeof fn === "function"
              ? (...args: unknown[]) => deferred((tx) => {
                  const model = Reflect.get(tx, property);
                  return Reflect.get(model, method).apply(model, args);
                })
              : fn;
          },
        }));
        return delegates.get(property);
      }
      return value;
    },
  });
}
