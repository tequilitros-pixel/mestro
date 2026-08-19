-- Existing one-time codes cannot be converted to keyed hashes safely.
-- Invalidating them is preferable to retaining plaintext secrets.
DELETE FROM "PasswordResetCode";

ALTER TABLE "PasswordResetCode" ALTER COLUMN "code" DROP NOT NULL;
ALTER TABLE "PasswordResetCode" ADD COLUMN "codeHash" TEXT;
DROP INDEX IF EXISTS "PasswordResetCode_code_idx";
