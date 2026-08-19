import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const isAdmin = user.role === "ADMIN";

  let branches: { id: string; name: string; code: string }[] = [];

  if (isAdmin) {
    branches = await prisma.branch.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  } else {
    const userBranches = await prisma.userBranch.findMany({
      where: { userId: user.id, branch: { active: true } },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    branches = userBranches.map((ub) => ub.branch);
  }

  return NextResponse.json({ branches, isAdmin });
}
