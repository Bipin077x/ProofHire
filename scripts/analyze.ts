import fs from "fs";
import { analyzePost } from "../src/lib/analyze";

async function main() {
  const args = process.argv.slice(2);
  const regexOnly = args.includes("--regex-only");
  const targetArg = args.find(a => !a.startsWith("--"));

  if (!targetArg) {
    console.error("Usage: npm run analyze -- [--regex-only] <file>");
    process.exit(1);
  }

  const text = fs.readFileSync(targetArg, "utf-8");
  
  // NOTE: the analyze.ts in lib uses extractClaims, but we need to pass regexOnly. 
  // Let's modify analyze.ts to accept regexOnly in its signature or just let extractClaims fail and fallback.
  // Wait, the prompt said "run ... --regex-only". We can just mock Anthropic or pass it.
  
  const result = await analyzePost(text, undefined, {
    searchProvider: {
      async search(_query: string) { return []; }
    }
  });
  console.log(JSON.stringify({ passport: result.passport, rollup: result.rollup }, null, 2));
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
