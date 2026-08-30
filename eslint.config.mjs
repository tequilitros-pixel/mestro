import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefactos locales de auditoría, reconciliación y respaldos:
    // no son código de la aplicación ni deben participar en lint.
    ".tmp-*/**",
    "fase3/**",
    "_to_delete/**",
    "prisma/migrations-archive-prebaseline-20260820/**",
  ]),
]);

export default eslintConfig;
