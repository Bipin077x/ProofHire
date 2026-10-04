import fs from "fs";

async function main() {
  const args = process.argv.slice(2);
  const regexOnly = args.includes("--regex-only");
  const offline = args.includes("--offline");
  const targetArg = args.find(a => !a.startsWith("--"));

  if (!targetArg) {
    console.error("Usage: npm run analyze -- [--regex-only] [--offline] <file>");
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resolveUrl: ((url: string) => Promise<any>) | undefined;

  if (offline) {
    const { installOfflineMocks, createFakeResolve } = await import("../src/lib/testing/offlineDeps");
    installOfflineMocks();
    resolveUrl = createFakeResolve();
  }

  const { analyzePost } = await import("../src/lib/analyze");
  const text = fs.readFileSync(targetArg, "utf-8");
  
  const result = await analyzePost(text, undefined, {
    searchProvider: {
      async search(_query: string) { return []; }
    },
    resolveUrl
  });

  if (regexOnly && result.claims) {
    result.claims.extractionMode = "regex-only";
  }

  console.log("Verdict:", result.verdict);
  console.log("Why:", result.why?.join("; "));
  console.log("\nEXTRACTED:");
  console.log(JSON.stringify(result.claims, null, 2));
  console.log("\nPASSPORT (Red Flags & Verified Claims):");
  
  if (result.results) {
    for (const p of result.results) {
      console.log(`${p.claim} | ${p.status} | ${p.ruleId} | ${p.evidence} | ${p.nextAction || ""}`);
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
