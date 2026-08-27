import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { Client } from "pg";

const EXPECTED_HOST_PREFIX = "ep-red-lake-ats4n9i7";
const QA_USERS = [
  { id: "wfqa_auth_admin", name: "WFQA-ADMIN", username: "wfqa-admin", email: "wfqa-admin@example.invalid", role: "ADMIN" },
  { id: "wfqa_auth_operator", name: "WFQA-OPERATOR", username: "wfqa-operator", email: "wfqa-operator@example.invalid", role: "OPERATOR" },
] as const;

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  assert.ok(rawUrl, "DATABASE_URL is required");
  const url = new URL(rawUrl);
  assert.ok(url.hostname.startsWith(EXPECTED_HOST_PREFIX), "refusing non-DEV endpoint");
  assert.equal(url.pathname, "/neondb", "refusing non-DEV database");
  const client = new Client({ connectionString: rawUrl });
  await client.connect();
  try {
    if (process.argv.includes("--cleanup")) {
      await client.query("BEGIN");
      await client.query(`DELETE FROM "UserSession" WHERE "userId"=ANY($1::text[])`, [QA_USERS.map((user) => user.id)]);
      await client.query(`DELETE FROM "ModulePermission" WHERE "userId"=ANY($1::text[])`, [QA_USERS.map((user) => user.id)]);
      await client.query(`DELETE FROM "User" WHERE id=ANY($1::text[]) AND username=ANY($2::text[]) AND name LIKE 'WFQA-%'`, [QA_USERS.map((user) => user.id), QA_USERS.map((user) => user.username)]);
      const remaining = await client.query(`SELECT count(*)::int AS count FROM "User" WHERE id=ANY($1::text[])`, [QA_USERS.map((user) => user.id)]);
      assert.equal(remaining.rows[0].count, 0, "QA users remain after cleanup");
      await client.query("COMMIT");
      console.log(JSON.stringify({ environment: "verified DEV", action: "cleanup", qaUsersRemaining: remaining.rows[0].count }));
      return;
    }
    const password = process.env.WFQA_ADMIN_PASSWORD;
    assert.ok(password && password.length >= 16, "WFQA_ADMIN_PASSWORD with at least 16 characters is required");
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query("BEGIN");
    for (const user of QA_USERS) {
      const collision = await client.query(`SELECT id,name,username FROM "User" WHERE id=$1 OR username=$2 OR email=$3`, [user.id, user.username, user.email]);
      if (collision.rowCount && collision.rows.some((row) => row.id !== user.id || row.name !== user.name || row.username !== user.username)) throw new Error(`refusing non-QA collision for ${user.username}`);
      await client.query(
        `INSERT INTO "User" (id,name,username,email,password,role,active,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,true,now(),now())
         ON CONFLICT (id) DO UPDATE SET password=EXCLUDED.password,active=true,"updatedAt"=now()
         WHERE "User".name=EXCLUDED.name AND "User".username=EXCLUDED.username`,
        [user.id, user.name, user.username, user.email, passwordHash, user.role],
      );
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ environment: "verified DEV", action: "seed", accounts: QA_USERS.map(({ username, role }) => ({ username, role })), passwordPrinted: false }));
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { await client.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
