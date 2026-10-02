import fs from "fs";
import path from "path";
import { extractClaims } from "../src/lib/extract";

function isExistingFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function readInput(arg: string): { type: "image" | "text" | "url"; content: string } {
  if (isExistingFile(arg)) {
    const ext = path.extname(arg).toLowerCase();
    const buffer = fs.readFileSync(arg);
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      return { type: "image", content: buffer.toString("base64") };
    }
    return { type: "text", content: buffer.toString("utf-8") };
  }
  if (/^https?:\/\//i.test(arg)) {
    return { type: "url", content: arg };
  }
  return { type: "text", content: arg };
}

async function main() {
  const args = process.argv.slice(2);
  const regexOnly = args.includes("--regex-only");
  const targetArg = args.find(a => !a.startsWith("--"));

  if (!targetArg) {
    console.error("Usage: npm run extract -- [--regex-only] <file-or-text-or-url>");
    process.exit(1);
  }
  
  let input;
  try {
    input = readInput(targetArg);
  } catch (e) {
    console.error("Failed to read input:", e);
    process.exit(1);
  }

  const text = typeof input.content === "string" && input.type !== "image" ? input.content : "";
  const imageUrl = input.type === "image" ? input.content : undefined;

  const result = await extractClaims({ text, imageUrl, regexOnly });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
