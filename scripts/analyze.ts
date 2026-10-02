import fs from "fs";
import net from "net";
import dns from "dns/promises";

async function main() {
  const args = process.argv.slice(2);
  const regexOnly = args.includes("--regex-only");
  const offline = args.includes("--offline");
  const targetArg = args.find(a => !a.startsWith("--"));

  if (!targetArg) {
    console.error("Usage: npm run analyze -- [--regex-only] [--offline] <file>");
    process.exit(1);
  }

  if (offline) {
    net.Socket.prototype.connect = () => { throw new Error("Offline mode - real socket blocked"); };
    // @ts-ignore
    dns.lookup = async (hostname) => {
      if (hostname === "127.0.0.1" || hostname === "0177.0.0.1") return [{ address: hostname, family: 4 }];
      if (hostname === "xn--ggle-0nda.com" || hostname === "microsoft-hiring.co") throw new Error("Offline mode");
      return [{ address: "93.184.216.34", family: 4 }];
    };
    const originalFetch = global.fetch;
    global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      if (url.toString().includes("rdap.org")) {
        return { ok: true, json: async () => ({ events: [{ eventAction: "registration", eventDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() }] }), text: async () => JSON.stringify({ events: [{ eventAction: "registration", eventDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() }] }) } as Response;
      }
      return originalFetch(url, init);
    };
  }

  const { analyzePost } = await import("../src/lib/analyze");
  const text = fs.readFileSync(targetArg, "utf-8");
  
  const result = await analyzePost(text, undefined, {
    searchProvider: {
      async search(_query: string) { return []; }
    }
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
