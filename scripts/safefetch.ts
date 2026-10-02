import { safeResolve } from "../src/lib/safe-fetch/index";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: npm run safefetch -- <url>");
    process.exit(1);
  }

  console.log(`Resolving: ${url}`);
  const result = await safeResolve(url);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
