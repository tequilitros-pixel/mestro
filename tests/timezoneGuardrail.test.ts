import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const productionRoots = ["app", "components", "lib"];
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);

function sourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...sourceFiles(fullPath));
    else if (sourceExtensions.has(path.extname(entry.name))) result.push(fullPath);
  }
  return result;
}

function matchingCallEnd(source: string, openParen: number): number {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let escaped = false;

  for (let index = openParen; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "/" && next === "/") {
      const lineEnd = source.indexOf("\n", index + 2);
      index = lineEnd === -1 ? source.length : lineEnd;
      continue;
    }
    if (character === "/" && next === "*") {
      const commentEnd = source.indexOf("*/", index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 1;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function findCalls(source: string, expression: string) {
  const calls: Array<{ start: number; text: string }> = [];
  let from = 0;
  while (true) {
    const start = source.indexOf(expression, from);
    if (start === -1) return calls;
    const openParen = source.indexOf("(", start + expression.length - 1);
    const end = matchingCallEnd(source, openParen);
    calls.push({
      start,
      text: end === -1 ? source.slice(start) : source.slice(start, end + 1),
    });
    from = start + expression.length;
  }
}

function violationsFor(expression: string, requireTimeZone: boolean) {
  const violations: string[] = [];
  for (const relativeRoot of productionRoots) {
    const root = path.join(process.cwd(), relativeRoot);
    for (const file of sourceFiles(root)) {
      const source = fs.readFileSync(file, "utf8");
      for (const call of findCalls(source, expression)) {
        if (requireTimeZone && !/\btimeZone\b/.test(call.text)) {
          const line = source.slice(0, call.start).split("\n").length;
          violations.push(`${path.relative(process.cwd(), file)}:${line}`);
        }
      }
    }
  }
  return violations;
}

test("production time formatters always declare an explicit timezone", () => {
  assert.deepEqual(violationsFor("new Intl.DateTimeFormat(", true), []);
  assert.deepEqual(violationsFor("toLocaleDateString(", true), []);
  assert.deepEqual(violationsFor("toLocaleTimeString(", false), []);
});
