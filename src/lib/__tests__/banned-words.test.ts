import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { analyzePost } from "../analyze";
import type { VerificationDeps } from "../verify";

const fixturesDir = path.join(__dirname, "../../../scripts/fixtures");

const checkNoBannedWords = (obj: unknown) => {
  if (typeof obj === "string") {
    // word boundaries, case insensitive. 'unsafe' is allowed.
    expect(obj).not.toMatch(/\b(safe|legit|genuine|100%)\b/i);
  } else if (Array.isArray(obj)) {
    obj.forEach(checkNoBannedWords);
  } else if (obj !== null && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      // Check all user-visible string fields
      if (!["verdict", "why", "evidence", "nextAction", "limitations", "label", "claim", "status", "ruleId", "sources", "results"].includes(key)) {
        continue;
      }
      // @ts-ignore
      checkNoBannedWords(obj[key]);
    }
  }
};

describe("Banned Words Scanner", () => {
  it("scans all fixtures for banned words in evidence, nextAction, limitations, why", async () => {
    const fixtures = fs.readdirSync(fixturesDir).filter(f => f.endsWith(".txt"));
    for (const file of fixtures) {
      const p = path.join(fixturesDir, file);
      const text = fs.readFileSync(p, "utf-8");
      const deps: VerificationDeps = { searchProvider: { async search() { return []; } } };
      const result = await analyzePost(text, undefined, deps);
      checkNoBannedWords(result.verdict);
      checkNoBannedWords(result.why);
      checkNoBannedWords(result.results);
    }
  }, 30000);
});
