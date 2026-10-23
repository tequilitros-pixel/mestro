import test from "node:test";
import assert from "node:assert/strict";

type PendingTabLine = {
  key: string;
  variantId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
};

type PendingTabStatus = "PENDIENTE" | "PAGADA" | "CANCELADA";

type PendingTab = {
  id: string;
  branchId: string;
  customerName: string;
  phone?: string;
  notes?: string;
  status: PendingTabStatus;
  lines: PendingTabLine[];
  total: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
  saleId?: string | null;
  saleCode?: string | null;
};

function calculateTotal(lines: PendingTabLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

function addOrIncrementLine(
  lines: PendingTabLine[],
  item: { variantId: string; productName: string; variantName: string; unitPrice: number },
): PendingTabLine[] {
  const key = `variant:${item.variantId}`;
  const existing = lines.find((l) => l.key === key);
  if (existing) {
    return lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
  }
  return [
    ...lines,
    {
      key,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      unitPrice: item.unitPrice,
      quantity: 1,
    },
  ];
}

function updateLineQuantity(lines: PendingTabLine[], key: string, delta: number): PendingTabLine[] {
  return lines
    .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
    .filter((l) => l.quantity > 0);
}

function settlePendingTab(
  tab: PendingTab,
  paymentMethod: string,
  saleId: string,
  saleCode: string,
): PendingTab {
  return {
    ...tab,
    status: "PAGADA",
    paidAt: new Date().toISOString(),
    paymentMethod,
    saleId,
    saleCode,
    updatedAt: new Date().toISOString(),
  };
}

test("crea una cuenta pendiente con nombre del cliente, fecha y artículos", () => {
  const lines: PendingTabLine[] = [
    {
      key: "variant:charro-negro-gde",
      variantId: "charro-negro-gde",
      productName: "Charro Negro",
      variantName: "Grande",
      unitPrice: 120,
      quantity: 2,
    },
    {
      key: "variant:corona-extra",
      variantId: "corona-extra",
      productName: "Cerveza Corona",
      variantName: "355ml",
      unitPrice: 45,
      quantity: 1,
    },
  ];

  const tab: PendingTab = {
    id: "tab-123",
    branchId: "branch-tequilitros-1",
    customerName: "Juan Pérez",
    phone: "3312345678",
    notes: "Regresa en 2 horas a pagar",
    status: "PENDIENTE",
    lines,
    total: calculateTotal(lines),
    createdAt: "2026-10-22T20:00:00.000Z",
    updatedAt: "2026-10-22T20:00:00.000Z",
  };

  assert.equal(tab.customerName, "Juan Pérez");
  assert.equal(tab.status, "PENDIENTE");
  assert.equal(tab.lines.length, 2);
  // 120 * 2 + 45 = 285
  assert.equal(tab.total, 285);
});

test("agrega bebidas adicionales a una cuenta pendiente existente y recalcula total", () => {
  let lines: PendingTabLine[] = [
    {
      key: "variant:charro-negro-gde",
      variantId: "charro-negro-gde",
      productName: "Charro Negro",
      variantName: "Grande",
      unitPrice: 120,
      quantity: 1,
    },
  ];

  // El cliente pide otro Charro Negro
  lines = addOrIncrementLine(lines, {
    variantId: "charro-negro-gde",
    productName: "Charro Negro",
    variantName: "Grande",
    unitPrice: 120,
  });

  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 2);
  assert.equal(calculateTotal(lines), 240);

  // El cliente también pide un Tequila
  lines = addOrIncrementLine(lines, {
    variantId: "tequila-blanco-shot",
    productName: "Tequila Blanco",
    variantName: "Caballito",
    unitPrice: 80,
  });

  assert.equal(lines.length, 2);
  assert.equal(calculateTotal(lines), 320);
});

test("decrementa cantidad y elimina renglón si la cantidad llega a cero", () => {
  let lines: PendingTabLine[] = [
    {
      key: "variant:cerveza",
      variantId: "cerveza",
      productName: "Cerveza",
      variantName: "Media",
      unitPrice: 50,
      quantity: 2,
    },
  ];

  lines = updateLineQuantity(lines, "variant:cerveza", -1);
  assert.equal(lines[0].quantity, 1);
  assert.equal(calculateTotal(lines), 50);

  lines = updateLineQuantity(lines, "variant:cerveza", -1);
  assert.equal(lines.length, 0);
  assert.equal(calculateTotal(lines), 0);
});

test("liquida una cuenta pendiente al cobrar y conserva historial y método de pago", () => {
  const tab: PendingTab = {
    id: "tab-don-beto",
    branchId: "branch-tequilitros-1",
    customerName: "Don Beto",
    notes: "Vuelve mañana con efectivo",
    status: "PENDIENTE",
    lines: [
      {
        key: "variant:cantarito",
        variantId: "cantarito",
        productName: "Cantarito Tradicional",
        variantName: "1 Litro",
        unitPrice: 160,
        quantity: 2,
      },
    ],
    total: 320,
    createdAt: "2026-10-21T18:00:00.000Z",
    updatedAt: "2026-10-21T18:00:00.000Z",
  };

  // Al día siguiente el cliente regresa a liquidar en efectivo
  const settled = settlePendingTab(tab, "EFECTIVO", "sale-8899", "TK-8899");

  assert.equal(settled.status, "PAGADA");
  assert.equal(settled.paymentMethod, "EFECTIVO");
  assert.equal(settled.saleId, "sale-8899");
  assert.equal(settled.saleCode, "TK-8899");
  assert.ok(settled.paidAt);
  assert.equal(settled.total, 320);
});

test("filtra cuentas por sucursal, estado pendiente y búsqueda por nombre", () => {
  const tabs: PendingTab[] = [
    {
      id: "1",
      branchId: "branch-1",
      customerName: "Don Beto",
      notes: "Amigo de Pedro",
      status: "PENDIENTE",
      lines: [],
      total: 200,
      createdAt: "2026-10-22T10:00:00Z",
      updatedAt: "2026-10-22T10:00:00Z",
    },
    {
      id: "2",
      branchId: "branch-1",
      customerName: "María López",
      notes: "Mesa 4",
      status: "PAGADA",
      lines: [],
      total: 150,
      createdAt: "2026-10-22T11:00:00Z",
      updatedAt: "2026-10-22T11:00:00Z",
    },
    {
      id: "3",
      branchId: "branch-2",
      customerName: "Carlos Gómez",
      status: "PENDIENTE",
      lines: [],
      total: 500,
      createdAt: "2026-10-22T12:00:00Z",
      updatedAt: "2026-10-22T12:00:00Z",
    },
  ];

  // Solo sucursal 1 pendientes
  const branch1Pending = tabs.filter((t) => t.branchId === "branch-1" && t.status === "PENDIENTE");
  assert.equal(branch1Pending.length, 1);
  assert.equal(branch1Pending[0].customerName, "Don Beto");

  // Búsqueda por término "beto"
  const searchMatch = tabs.filter((t) => t.customerName.toLowerCase().includes("beto"));
  assert.equal(searchMatch.length, 1);
  assert.equal(searchMatch[0].customerName, "Don Beto");
});
