import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium } from "/Users/joseadansanchez/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const url = process.env.QA_DATABASE_URL ?? "postgresql://qa:qa@127.0.0.1:55432/maestro_qa?schema=public";
const runtimeUrl = url.replace("qa:qa@", "maestro_runtime:runtime@");
const base = process.env.QA_BASE ?? "http://127.0.0.1:3105";
const prefix = `WFBROWSERQA_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const ids = { users: [], employees: [] };
const password = "browser-qa-password-123";

async function seed() {
  const hashed = await bcrypt.hash(password, 10);
  const admin = await db.user.create({ data: { name: `${prefix} Admin`, username: `${prefix}_admin`, password: hashed, role: "ADMIN" } });
  const userA = await db.user.create({ data: { name: `${prefix} Usuario A`, username: `${prefix}_a`, password: hashed, role: "OPERATOR" } });
  const userB = await db.user.create({ data: { name: `${prefix} Usuario B`, username: `${prefix}_b`, password: hashed, role: "GERENTE" } });
  ids.users.push(admin.id, userA.id, userB.id);
  const employeeA = await db.employee.create({ data: { employeeNumber: `${prefix}_A`, displayName: `${prefix} Empleado A`, active: true, employments: { create: { status: "ACTIVE", startedAt: new Date("2026-01-01"), dataConfidence: "KNOWN" } } } });
  const employeeB = await db.employee.create({ data: { employeeNumber: `${prefix}_B`, displayName: `${prefix} Empleado B`, active: true, employments: { create: { status: "ACTIVE", startedAt: new Date("2026-01-01"), dataConfidence: "KNOWN" } } } });
  ids.employees.push(employeeA.id, employeeB.id);
  const token = crypto.randomBytes(32).toString("base64url");
  await db.userSession.create({ data: { userId: admin.id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
  return { employeeA, employeeB, userA, userB, token };
}

async function cleanup() {
  await db.userSession.deleteMany({ where: { userId: { in: ids.users } } });
  await db.employment.deleteMany({ where: { employeeId: { in: ids.employees } } });
  await db.employee.deleteMany({ where: { id: { in: ids.employees } } });
  await db.user.deleteMany({ where: { id: { in: ids.users } } });
  const remaining = await Promise.all([
    db.user.count({ where: { username: { startsWith: prefix } } }),
    db.employee.count({ where: { employeeNumber: { startsWith: prefix } } }),
  ]);
  assert.deepEqual(remaining, [0, 0]);
  console.log("BROWSER QA CLEANUP: PASS");
}

  const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3105"], {
  cwd: "/Users/joseadansanchez/maestro-dev",
  env: { ...process.env, DATABASE_URL: runtimeUrl, MAESTRO_RUNTIME_DATABASE_URL: runtimeUrl, WORKFORCE_V1_ENABLED: "true", RESEND_API_KEY: "re_local_qa_placeholder" },
    stdio: "inherit",
  });
  server.on("exit", (code, signal) => console.error("QA SERVER EXIT", code, signal));
try {
  const q = await seed();
  let ready = false;
  for (let i = 0; i < 60; i++) { try { const response = await fetch(`${base}/login`); if (response.ok) { ready = true; break; } } catch {} await wait(1000); }
  assert.equal(ready, true, "QA app did not become ready");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: "maestro_session", value: q.token, domain: "127.0.0.1", path: "/" }]);
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  page.on("pageerror", (error) => console.error("BROWSER PAGEERROR", error.message));
  page.on("console", (message) => { if (message.type() === "error") console.error("BROWSER CONSOLE", message.text()); });
  const firstResponse = await page.goto(`${base}/administration/workforce/employees/${q.employeeA.id}`, { waitUntil: "networkidle" });
  assert.equal(firstResponse?.status(), 200);
  assert.equal((await page.title()).length > 0, true);
  assert.match(await page.locator("body").innerText(), /ACCESO A MAESTRO/i);
  assert.equal(await page.locator("select[name=userId]").count(), 1);
  assert.ok(await page.locator("select[name=userId] option").count() >= 3);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log("MOBILE 390x844 / SELECTOR / HUMAN LABELS: PASS");

  await page.locator("select[name=userId]").selectOption(q.userA.id);
  await page.getByRole("button", { name: "Guardar vínculo" }).click();
  await page.waitForURL(/saved=1/);
  await page.reload({ waitUntil: "networkidle" });
  assert.match(await page.locator("body").innerText(), new RegExp(`@${q.userA.username}`));
  console.log("BROWSER LINK + RELOAD: PASS");

  const optionTexts = await page.locator("select[name=userId] option").allTextContents();
  assert.ok(!optionTexts.some((text) => text.includes(q.userA.username) && !text.includes("@" + q.userA.username)) || optionTexts.length > 0);
  await page.locator("select[name=userId]").selectOption(q.userB.id);
  await page.getByRole("button", { name: "Guardar vínculo" }).click();
  await page.waitForURL(/saved=1/);
  assert.match(await page.locator("body").innerText(), new RegExp(`@${q.userB.username}`));
  console.log("BROWSER CHANGE + CONFIRMATION: PASS");

  await page.locator("select[name=userId]").selectOption("");
  await page.getByRole("button", { name: "Guardar vínculo" }).click();
  await page.waitForURL(/saved=1/);
  assert.match(await page.locator("body").innerText(), /Sin usuario/i);
  await page.goto(`${base}/administration/personnel`, { waitUntil: "networkidle" });
  await page.getByText(new RegExp(`${prefix} Usuario B`)).waitFor({ timeout: 45000 });
  assert.match(await page.locator("body").innerText(), new RegExp(`${prefix} Usuario B`));
  console.log("BROWSER UNLINK + PERSONNEL REFLECTION: PASS");
  await browser.close();
} finally {
  server.kill("SIGTERM");
  await cleanup();
  await db.$disconnect();
}
