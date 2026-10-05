import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { explanations } from "../explanations";

describe("explanations", () => {
  it("has an explanation for all ruleIds in the verify directory", () => {
    const dir = path.join(__dirname, "../../lib/verify");
    const files = fs.readdirSync(dir);
    const ruleIds = new Set<string>();

    for (const file of files) {
      if (file.endsWith(".ts")) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        const matches = content.match(/ruleId:\s*["']([^"']+)["']/g);
        if (matches) {
          for (const match of matches) {
            const id = match.split(/["']/)[1];
            ruleIds.add(id);
          }
        }
      }
    }

    const missing: string[] = [];
    for (const id of ruleIds) {
      if (!explanations[id]) {
        missing.push(id);
      }
    }
    
    // Some ruleIds might be dynamically constructed but we checked static ones
    expect(missing).toEqual([]);
  });
});
