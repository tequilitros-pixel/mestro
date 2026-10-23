import assert from "node:assert/strict";
import test from "node:test";
import { DomainError } from "../lib/domain/errors";

test("DomainError expone contrato seguro y estable", () => {
  const error = new DomainError("INSUFFICIENT_STOCK", { productId: "safe-id" });
  assert.equal(error.httpStatus, 409);
  assert.equal(error.retryable, false);
  assert.deepEqual(error.toResponse("operation-id").error.metadata, { productId: "safe-id" });
  assert.equal("stack" in error.toResponse().error, false);
});
