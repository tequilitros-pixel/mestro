import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";

export async function getSale(actor: CommandActor, id: string) {
  const sale = await prisma.pos2Sale.findUniqueOrThrow({ where: { id }, include: { branch: true, register: true, terminal: true, cashier: { select: { id: true, name: true } }, lines: { orderBy: { position: "asc" },include:{returnLines:true} }, payments: { orderBy: { position: "asc" },include:{reversals:true,refundAllocations:true} },cancellation:{include:{paymentReversals:true}},returns:{include:{lines:true},orderBy:{createdAt:"asc"}},refunds:{include:{allocations:true},orderBy:{createdAt:"asc"}} } });
  requireActorBranch(actor, sale.branchId); await prisma.$transaction((tx) => requireCapability(tx, actor, "pos.sale.complete", sale.branchId)); const [cashMovements,inventoryMovements]=await Promise.all([prisma.cashMovement.findMany({where:{OR:[{sourceId:sale.id},{sourceId:sale.cancellation?.id},{sourceId:{in:sale.refunds.map(r=>r.id)}}]},orderBy:{createdAt:"asc"}}),prisma.inventoryMovement.findMany({where:{OR:[{sourceId:sale.id},{sourceId:sale.cancellation?.id},{sourceId:{in:sale.returns.map(r=>r.id)}}]},orderBy:{createdAt:"asc"}})]);const returnableQuantities=sale.lines.map(line=>{const returned=line.returnLines.reduce((sum,item)=>sum.plus(item.quantity),new Prisma.Decimal(0));return {saleLineId:line.id,sold:line.quantity.toFixed(6),returned:returned.toFixed(6),returnable:line.quantity.minus(returned).toFixed(6),unit:line.unit};});const paid=sale.payments.reduce((sum,p)=>sum.plus(p.amount),new Prisma.Decimal(0));const refunded=sale.refunds.reduce((sum,r)=>sum.plus(r.amount),new Prisma.Decimal(0));return {...sale,returnableQuantities,refundableAmount:paid.minus(refunded).toFixed(2),cashMovements,inventoryMovements};
}

export async function listSales(actor: CommandActor, input: { branchId: string; cashSessionId?: string; take?: number }) {
  requireActorBranch(actor, input.branchId); await prisma.$transaction((tx) => requireCapability(tx, actor, "pos.sale.complete", input.branchId));
  return prisma.pos2Sale.findMany({ where: { branchId: input.branchId, cashSessionId: input.cashSessionId }, include: { branch: true, register: true, cashier: { select: { id: true, name: true } }, payments: { orderBy: { position: "asc" } } }, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: Math.min(input.take ?? 50, 200) });
}

export async function getReceipt(actor: CommandActor, id: string) {
  const sale = await getSale(actor, id);
  return { branchId: sale.branchId, saleNumber: sale.saleNumber, completedAt: sale.completedAt.toISOString(), branch: { id: sale.branch.id, name: sale.branch.name, code: sale.branch.code }, register: { id: sale.register.id, name: sale.register.name, code: sale.register.code }, cashier: sale.cashier, currency: sale.currency, subtotal: sale.subtotal.toFixed(2), discountTotal: sale.discountTotal.toFixed(2), total: sale.total.toFixed(2), lines: sale.lines.map((line) => ({ description: line.variantNameSnapshot ? `${line.productNameSnapshot} — ${line.variantNameSnapshot}` : line.productNameSnapshot, sku: line.skuSnapshot, quantity: line.quantity.toFixed(6), unit: line.unit, unitPrice: line.unitPrice.toFixed(2), total: line.lineTotal.toFixed(2) })), payments: sale.payments.map((payment) => ({ method: payment.method, amount: payment.amount.toFixed(2), cashTendered: payment.cashTendered?.toFixed(2) ?? null, changeGiven: payment.changeGiven?.toFixed(2) ?? null, reference: payment.reference })) };
}

export async function getCompensationReceipt(actor:CommandActor,saleId:string,kind:"cancellation"|"return"|"refund",documentId:string){const sale=await getSale(actor,saleId);const document=kind==="cancellation"?sale.cancellation:kind==="return"?sale.returns.find(item=>item.id===documentId):sale.refunds.find(item=>item.id===documentId);if(!document)throw new Error("Compensation document not found");return {kind,documentId,saleNumber:sale.saleNumber,branch:sale.branch,cashier:sale.cashier,createdAt:document.createdAt.toISOString(),currency:sale.currency,document};}
