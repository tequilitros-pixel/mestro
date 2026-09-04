import { NextResponse } from "next/server";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
export const dynamic = "force-dynamic";
export async function GET(){await getCurrentCommandActor();return NextResponse.json({status:"ok",serverTime:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});}
