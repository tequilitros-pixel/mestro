import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isBranchAllowed } from "@/lib/branches/access";
import { getAccessibleBranchIds } from "@/lib/auth";
import { getActiveDiscountRules } from "@/lib/pos/discountRules";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const branchId = new URL(request.url).searchParams.get("branchId");
  if (!branchId) return NextResponse.json({ error: "Selecciona una sucursal" }, { status: 400 });
  const allowed = await getAccessibleBranchIds();
  if (!isBranchAllowed(allowed, branchId)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const rules = await getActiveDiscountRules(branchId);
  return NextResponse.json({
    blockedBy: rules.find((rule) => rule.mode === "BLOCK")?.name ?? null,
    discounts: rules.filter((rule) => rule.mode === "DISCOUNT").map((rule) => ({ id: rule.id, name: rule.name, percent: rule.percent })),
  });
}
