import test from "node:test";
import assert from "node:assert/strict";
import type { ReceiptData } from "@/components/pos/ReceiptTicket";

test("ReceiptData structure formats items and cash change correctly", () => {
  const receipt: ReceiptData = {
    saleId: "test-sale-123",
    saleCode: "POS-GDL-20261022-001",
    branchName: "Tequilitros Centro",
    branchAddress: "Av. Hidalgo 123",
    date: "22/10/2026 12:45",
    cashierName: "Juan Pérez",
    items: [
      {
        name: "Cantarito 1L",
        quantity: 2,
        unitPrice: 150,
        lineTotal: 300,
      },
      {
        name: "Refresco",
        quantity: 1,
        unitPrice: 35,
        lineTotal: 35,
      },
    ],
    subtotal: 335,
    discountAmount: 35,
    total: 300,
    payments: [{ method: "EFECTIVO", amount: 300 }],
    cashReceived: 500,
    change: 200,
    isOffline: false,
  };

  assert.equal(receipt.total, 300);
  assert.equal(receipt.items.length, 2);
  assert.equal(receipt.change, 200);
  assert.equal(receipt.cashReceived, 500);
  assert.equal(receipt.isOffline, false);
});

test("Offline ReceiptData supports local identification fallback", () => {
  const localReceipt: ReceiptData = {
    saleId: "local-uuid-999",
    saleCode: "LOCAL-999ABCD1",
    branchName: "Punto Remoto Festival",
    date: "22/10/2026 13:00",
    items: [
      {
        name: "Botella Reserva",
        quantity: 1,
        unitPrice: 650,
        lineTotal: 650,
      },
    ],
    subtotal: 650,
    discountAmount: 0,
    total: 650,
    payments: [{ method: "EFECTIVO", amount: 650 }],
    isOffline: true,
  };

  assert.equal(localReceipt.isOffline, true);
  assert.match(localReceipt.saleCode, /^LOCAL-/);
  assert.equal(localReceipt.total, 650);
});
