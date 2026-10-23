import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export type DatabaseActor = { id: string; role: string };
const actors = new AsyncLocalStorage<DatabaseActor | null>();

/** Trusted server/service entry points only. Never deserialize an actor from a form. */
export function withDatabaseActor<T>(actor: DatabaseActor | null, operation: () => T): T {
  return actors.run(actor, operation);
}

export async function databaseActor(): Promise<DatabaseActor | null> {
  const actor = actors.getStore();
  if (actor !== undefined) return actor;
  // Authentication reads its session with the raw client, avoiding recursion.
  const { getCurrentUser } = await import("@/lib/auth");
  try {
    return await getCurrentUser();
  } catch (error) {
    // Command-line callers must supply an explicit trusted actor. Never elevate.
    if (error instanceof Error && error.message.includes("outside a request scope")) return null;
    throw error;
  }
}
