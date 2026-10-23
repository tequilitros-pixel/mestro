import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse } from "@/lib/pos2/http";
import { publishAdjustmentVersion } from "@/lib/pos2/adjustments/manageRules";

export async function GET() { try { const rows = await prisma.adjustmentVersion.findMany({ include: { definition: true, branch: { select: { name: true } }, termination: true }, orderBy: [{ createdAt: "desc" }] }); return NextResponse.json(rows.map((row) => ({ ...row, percentage: row.percentage?.toString() ?? null, amount: row.amount?.toFixed(2) ?? null, bundleQuantity: row.bundleQuantity?.toString() ?? null, maxAmount: row.maxAmount?.toFixed(2) ?? null }))); } catch (error) { return pos2ErrorResponse(error); } }

export async function POST(request: Request) { try { const body = await request.json(); const outcome = await publishAdjustmentVersion({ ...body, actor: await getCurrentCommandActor(), operationId: String(body.operationId), code: String(body.code), name: String(body.name), validFrom: new Date(body.validFrom), validTo: body.validTo ? new Date(body.validTo) : undefined }); return NextResponse.json(outcome.result, { status: outcome.replayed ? 200 : 201 }); } catch (error) { return pos2ErrorResponse(error); } }
