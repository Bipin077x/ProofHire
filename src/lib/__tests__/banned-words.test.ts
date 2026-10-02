import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { analyzePost } from "../analyze";
import type { VerificationDeps } from "../verify";

const fixturesDir = path.join(__dirname, "../../../../scripts/fixtures");

const checkNoBannedWords = (obj: unknown) => {
  if (typeof obj === "string") {
    // word boundaries, case insensitive. 'unsafe' is allowed.
    expect(obj).not.toMatch(/\b(safe|legit|genuine|100%)\b/i);
  } else if (Array.isArray(obj)) {
    obj.forEach(checkNoBannedWords);
  } else if (obj !== null && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (key !== "verdict" && key !== "reasons" && key !== "evidence" && key !== "nextAction" && key !== "limitations" && key !== "label" && key !== "claim" && key !== "status" && key !== "ruleId" && key !== "sources" && key !== "passport") {
        continue;
      }
      // @ts-ignore
      checkNoBannedWords(obj[key]);
    }
  }
};

describe("Banned Words Scanner", () => {
  it("scans all 8 fixtures", async () => {
    const fixtures = [
      "01_simple_scam.txt", "02_legit_email.txt", "03_mixed_signals.txt", "04_obfuscated_links.txt",
      "sample.txt", "shortener.txt", "gmail.txt", "infosys.txt"
    ];
    for (const file of fixtures) {
      const p = path.join(fixturesDir, file);
      if (fs.existsSync(p)) {
        const text = fs.readFileSync(p, "utf-8");
        const deps: VerificationDeps = { searchProvider: { async search() { return []; } } };
        const result = await analyzePost(text, undefined, deps);
        checkNoBannedWords(result.rollup?.verdict);
        checkNoBannedWords(result.rollup?.reasons);
        checkNoBannedWords(result.passport);
      }
    }
  });
});
