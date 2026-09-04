"use server";
import { revalidatePath } from "next/cache";
import type { CatalogBaseUnit } from "@prisma/client";
import { requireAdminAction } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustInventory, countInventory, receiveInventory } from "@/lib/pos2/inventory/commands";
import { transferInventory } from "@/lib/pos2/inventory/transfer";
import { requireCapability } from "@/lib/pos2/authorization";
import { appendAuditEvent } from "@/lib/pos2/audit";
async function actor(){const u=await requireAdminAction();return{id:u.id,role:u.role,branchIds:null}as const;} const refresh=()=>revalidatePath("/administration/pos2/inventory"); const unit=(f:FormData):CatalogBaseUnit=>f.get("unit")==="ML"?"ML":"UNIT";
export async function receiveAction(f:FormData){await receiveInventory({actor:await actor(),operationId:String(f.get("operationId")),branchId:String(f.get("branchId")),inventoryProductId:String(f.get("inventoryProductId")),quantity:String(f.get("quantity")),unit:unit(f),reason:String(f.get("reason")),sourceId:String(f.get("sourceId"))});refresh();}
export async function adjustAction(f:FormData){await adjustInventory({actor:await actor(),operationId:String(f.get("operationId")),branchId:String(f.get("branchId")),inventoryProductId:String(f.get("inventoryProductId")),delta:String(f.get("delta")),unit:unit(f),reason:String(f.get("reason"))});refresh();}
export async function countAction(f:FormData){await countInventory({actor:await actor(),operationId:String(f.get("operationId")),branchId:String(f.get("branchId")),inventoryProductId:String(f.get("inventoryProductId")),declaredQuantity:String(f.get("declaredQuantity")),unit:unit(f),notes:String(f.get("notes")||"")});refresh();}
export async function transferAction(f:FormData){await transferInventory({actor:await actor(),operationId:String(f.get("operationId")),fromBranchId:String(f.get("fromBranchId")),toBranchId:String(f.get("toBranchId")),inventoryProductId:String(f.get("inventoryProductId")),quantity:String(f.get("quantity")),unit:unit(f),reason:String(f.get("reason"))});refresh();}
export async function configureUnitAction(f:FormData){const a=await actor(),id=String(f.get("inventoryProductId"));await prisma.$transaction(async tx=>{await requireCapability(tx,a,"inventory.adjust");await tx.inventoryProduct.update({where:{id},data:{inventoryBaseUnit:unit(f)}});await appendAuditEvent(tx,{actorId:a.id,action:"INVENTORY_BASE_UNIT_CONFIGURED",entityType:"InventoryProduct",entityId:id,metadata:{unit:unit(f)}});});refresh();}
