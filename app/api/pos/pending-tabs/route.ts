import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

type PendingTabLine = {
  key: string;
  variantId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
};

type PendingTab = {
  id: string;
  branchId: string;
  customerName: string;
  phone?: string;
  notes?: string;
  status: "PENDIENTE" | "PAGADA" | "CANCELADA";
  lines: PendingTabLine[];
  total: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
  saleId?: string | null;
  saleCode?: string | null;
};

const DATA_FILE = path.join(process.cwd(), "data", "pos-pending-tabs.json");

async function readAllTabs(): Promise<PendingTab[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAllTabs(tabs: PendingTab[]): Promise<void> {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = `${DATA_FILE}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(tabs, null, 2), "utf-8");
  await fs.rename(tempPath, DATA_FILE);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const status = searchParams.get("status");

  let tabs = await readAllTabs();

  if (branchId) {
    tabs = tabs.filter((t) => t.branchId === branchId);
  }
  if (status) {
    tabs = tabs.filter((t) => t.status === status);
  }

  tabs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(tabs);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<PendingTab>;

    if (!body.customerName || !body.customerName.trim()) {
      return NextResponse.json({ error: "El nombre del cliente es obligatorio." }, { status: 400 });
    }

    if (!body.branchId) {
      return NextResponse.json({ error: "La sucursal es obligatoria." }, { status: 400 });
    }

    const lines = Array.isArray(body.lines) ? body.lines : [];
    const total = lines.reduce((sum, line) => sum + (line.unitPrice || 0) * (line.quantity || 0), 0);

    const now = new Date().toISOString();
    const id = body.id || crypto.randomUUID();

    const normalizedTab: PendingTab = {
      id,
      branchId: body.branchId,
      customerName: body.customerName.trim(),
      phone: body.phone?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
      status: body.status || "PENDIENTE",
      lines,
      total,
      createdAt: body.createdAt || now,
      updatedAt: now,
      paidAt: body.paidAt ?? null,
      paymentMethod: body.paymentMethod ?? null,
      saleId: body.saleId ?? null,
      saleCode: body.saleCode ?? null,
    };

    const allTabs = await readAllTabs();
    const index = allTabs.findIndex((t) => t.id === id);

    if (index >= 0) {
      allTabs[index] = normalizedTab;
    } else {
      allTabs.unshift(normalizedTab);
    }

    await writeAllTabs(allTabs);

    return NextResponse.json(normalizedTab);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al guardar cuenta pendiente" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Se requiere el ID de la cuenta." }, { status: 400 });
  }

  const allTabs = await readAllTabs();
  const filtered = allTabs.filter((t) => t.id !== id);
  await writeAllTabs(filtered);

  return NextResponse.json({ success: true });
}
