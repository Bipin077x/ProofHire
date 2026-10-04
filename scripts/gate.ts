#!/usr/bin/env node
/**
 * npm run gate
 * Runs all gate checks and writes untruncated output to gate-report.txt
 */
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const OUT = "gate-report.txt";
const w = fs.createWriteStream(OUT, { flags: "w", encoding: "utf-8" });

function section(title: string) {
  const line = "=".repeat(70);
  w.write(`\n${line}\n${title}\n${line}\n`);
  process.stdout.write(`\n${line}\n${title}\n${line}\n`);
}

function run(cmd: string, cwd = process.cwd()): string {
  try {
    const out = execSync(cmd, { cwd, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
    w.write(out);
    process.stdout.write(out);
    return out;
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = (err.stdout || "") + (err.stderr || "");
    w.write(output || err.message || "(no output)");
    process.stdout.write(output || err.message || "(no output)");
    return output || "";
  }
}

function runNode(args: string): string {
  return run(`node ${args}`);
}

async function main() {
  w.write(`gate-report.txt — generated at ${new Date().toISOString()}\n`);

  // (a) git status + log
  section("(a) git status --short; git log --oneline -5");
  run("git status --short");
  run("git log --oneline -5");

  // (b) node -v and URL one-liner
  section("(b) node -v and URL hostname one-liner");
  run("node -v");
  run(`node -e "console.log(new URL('http://[::1]').hostname, new URL('http://2130706433').hostname, new URL('http://0x7f000001').hostname)"`);

  // (c) git diff --numstat HEAD~3
  section("(c) git diff --numstat HEAD~3 -- '*.test.ts' .testbaseline.json");
  run("git diff --numstat HEAD~3 -- *.test.ts .testbaseline.json");

  // (d) grep for bypass/env/NODE_ENV in safe-fetch (non-test)
  section("(d) git grep -n -E allowPrivate|NODE_ENV|VITEST|process.env|bypass in safe-fetch non-test");
  run(`git grep -n -E "allowPrivate|NODE_ENV|VITEST|process\\.env|bypass" -- src/lib/safe-fetch ":!src/lib/safe-fetch/__tests__"`);

  // (e) cat factory.ts
  section("(e) cat src/lib/safe-fetch/factory.ts");
  try {
    const content = fs.readFileSync("src/lib/safe-fetch/factory.ts", "utf-8");
    w.write(content);
    process.stdout.write(content);
  } catch (e) {
    w.write(`ERROR: ${e}\n`);
  }

  // (e2) cat index.ts
  section("(e2) cat src/lib/safe-fetch/index.ts");
  try {
    const content = fs.readFileSync("src/lib/safe-fetch/index.ts", "utf-8");
    w.write(content);
    process.stdout.write(content);
  } catch (e) {
    w.write(`ERROR: ${e}\n`);
  }

  // (e3) grep createSafeResolver
  section("(e3) git grep -n createSafeResolver -- src :!src/lib/safe-fetch/__tests__");
  run(`git grep -n createSafeResolver -- src ":!src/lib/safe-fetch/__tests__"`);

  // (e4) git log --oneline --stat -- scripts/fixtures
  section("(e4) git log --oneline --stat -- scripts/fixtures");
  run("git log --oneline --stat -- scripts/fixtures");

  // (e5) git diff HEAD~3 -- .testbaseline.json
  section("(e5) git diff HEAD~3 -- .testbaseline.json");
  run("git diff HEAD~3 -- .testbaseline.json");

  // (e6) baseline lowered check
  section("(e6) run testcount with baseline lowered (actually raised to trigger failure)");
  try {
     const bl = JSON.parse(fs.readFileSync(".testbaseline.json", "utf-8"));
     const fileKey = Object.keys(bl).find(k => k !== 'total');
     if (fileKey) {
       const originalVal = bl[fileKey];
       bl[fileKey] = originalVal + 1; // Raise baseline so actual < baseline
       fs.writeFileSync(".testbaseline.json", JSON.stringify(bl, null, 2));
       run("npx tsx scripts/testcount.ts");
       bl[fileKey] = originalVal;
       fs.writeFileSync(".testbaseline.json", JSON.stringify(bl, null, 2));
     }
  } catch(e) {
     w.write(`ERROR checking baseline: ${e}\n`);
  }

  // (f) npm test --run --reporter=verbose
  section("(f) npm test -- --run --reporter=verbose");
  run("npm test -- --run --reporter=verbose --testTimeout=30000");

  // (g) tsc + lint
  section("(g) npx tsc --noEmit; npm run lint");
  run("npx tsc --noEmit");
  run("npm run lint");

  // (h) all fixtures
  section("(h) All fixtures: cat + analyze --regex-only --offline");
  const fixturesDir = "scripts/fixtures";
  const fixtures = fs.readdirSync(fixturesDir)
    .filter(f => f.endsWith(".txt"))
    .sort();

  for (const fixture of fixtures) {
    const fixturePath = path.join(fixturesDir, fixture);
    const subSection = `----- ${fixture} -----`;
    w.write(`\n${subSection}\n`);
    process.stdout.write(`\n${subSection}\n`);

    // cat
    try {
      const content = fs.readFileSync(fixturePath, "utf-8");
      w.write(`[CONTENT]\n${content}\n`);
      process.stdout.write(`[CONTENT]\n${content}\n`);
    } catch (e) {
      w.write(`ERROR reading file: ${e}\n`);
    }

    // analyze
    w.write("[ANALYSIS]\n");
    process.stdout.write("[ANALYSIS]\n");
    run(`npx tsx scripts/analyze.ts --regex-only --offline ${fixturePath}`);
  }

  await new Promise<void>(resolve => w.end(resolve));
  console.log(`\n\ngate-report.txt written (${fs.statSync(OUT).size} bytes)`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
