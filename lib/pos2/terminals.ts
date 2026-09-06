import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");

export async function createTerminalEnrollment(input: { actor: CommandActor; branchId: string; name: string; expiresInMinutes?: number }) {
  const rawToken = secret();
  const expiresInMinutes = Math.min(Math.max(input.expiresInMinutes ?? 15, 1), 60);
  const terminal = await prisma.$transaction(async (tx) => {
    requireActorBranch(input.actor, input.branchId);
    await requireCapability(tx, input.actor, "terminal.manage", input.branchId);
    const created = await tx.terminal.create({ data: { branchId: input.branchId, name: input.name.trim(), createdById: input.actor.id } });
    await tx.terminalEnrollment.create({ data: {
      terminalId: created.id, tokenHash: digest(rawToken), expiresAt: new Date(Date.now() + expiresInMinutes * 60_000), createdById: input.actor.id,
    } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, action: "terminal.created", entityType: "Terminal", entityId: created.id });
    return created;
  });
  return { terminal, enrollmentToken: rawToken };
}

export async function enrollTerminal(input: { enrollmentToken: string; deviceIdentifier: string }) {
  const credential = secret();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "TerminalEnrollment" WHERE "tokenHash" = ${digest(input.enrollmentToken)} FOR UPDATE`;
    if (!rows[0]) throw new DomainError("PERMISSION_DENIED", {}, "El token de enrolamiento no es válido.");
    const enrollment = await tx.terminalEnrollment.findUniqueOrThrow({ where: { id: rows[0].id }, include: { terminal: true } });
    if (enrollment.usedAt || enrollment.revokedAt || enrollment.expiresAt <= new Date() || enrollment.terminal.status === "REVOKED") {
      throw new DomainError("PERMISSION_DENIED", {}, "El token de enrolamiento expiró o ya fue utilizado.");
    }
    const terminal = await tx.terminal.update({ where: { id: enrollment.terminalId }, data: {
      deviceIdentifier: input.deviceIdentifier.trim(), credentialHash: digest(credential), status: "ACTIVE", enrolledAt: new Date(), credentialIssuedAt: new Date(), lastSeenAt: new Date(),
    } });
    await tx.terminalEnrollment.update({ where: { id: enrollment.id }, data: { usedAt: new Date() } });
    await appendAuditEvent(tx, { branchId: terminal.branchId, action: "terminal.enrolled", entityType: "Terminal", entityId: terminal.id });
    return { terminal: { id: terminal.id, branchId: terminal.branchId, name: terminal.name, status: terminal.status }, credential };
  });
}

export async function authenticateTerminal(input: { terminalId: string; credential: string }) {
  const terminal = await prisma.terminal.findUnique({ where: { id: input.terminalId } });
  if (!terminal?.credentialHash || terminal.status !== "ACTIVE") throw new DomainError("PERMISSION_DENIED");
  const actual = Buffer.from(digest(input.credential));
  const expected = Buffer.from(terminal.credentialHash);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new DomainError("PERMISSION_DENIED");
  await prisma.terminal.update({ where: { id: terminal.id }, data: { lastSeenAt: new Date() } });
  return terminal;
}

export async function revokeTerminal(input: { actor: CommandActor; terminalId: string }) {
  return prisma.$transaction(async (tx) => {
    const terminal = await tx.terminal.findUniqueOrThrow({ where: { id: input.terminalId } });
    requireActorBranch(input.actor, terminal.branchId);
    await requireCapability(tx, input.actor, "terminal.manage", terminal.branchId);
    const revoked = await tx.terminal.update({ where: { id: terminal.id }, data: { status: "REVOKED", credentialHash: null } });
    await tx.terminalEnrollment.updateMany({ where: { terminalId: terminal.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: terminal.branchId, action: "terminal.revoked", entityType: "Terminal", entityId: terminal.id });
    return revoked;
  });
}
