import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const FORBIDDEN_BRAND_WORDS = ["marvel", "disney", "iron man", "stark", "jarvis", "avengers"];
const BANNED_COPY = ["legit", "genuine", "100%", "coming soon"];

describe("Brand Rules", () => {
  it("contains no forbidden brand words or banned copy in the codebase", () => {
    const srcDir = path.join(__dirname, "../..");
    let found = false;
    let foundWord = "";

    function walk(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === "__tests__" || file === "node_modules" || file === ".next" || file === ".kilo" || file === "api") continue;
        
        const p = path.join(dir, file);
        if (fs.statSync(p).isDirectory()) {
          walk(p);
        } else if (p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".css")) {
          const content = fs.readFileSync(p, "utf-8").toLowerCase();
          for (const word of FORBIDDEN_BRAND_WORDS) {
            if (content.includes(word)) {
              console.error(`Forbidden brand word "${word}" found in ${p}`);
              found = true;
              foundWord = word;
            }
          }
          if (p.includes("src\\content") || p.includes("src/content") || p.includes("src\\app") || p.includes("src/app") || p.includes("src\\components") || p.includes("src/components")) {
            for (const word of BANNED_COPY) {
              if (word === "100%" && p.endsWith(".css")) continue;
              if (content.includes(word)) {
                console.error(`Banned copy "${word}" found in ${p}`);
                found = true;
                foundWord = word;
              }
            }
            // unsafe is allowed, but not safe
            if (content.includes("safe") && !content.includes("unsafe")) {
              const safeRegex = /\bsafe\b/g;
              const matches = [...content.matchAll(safeRegex)];
              if (matches.length > 0) {
                console.error(`Banned copy "safe" found in ${p}`);
                found = true;
                foundWord = "safe";
              }
            }
          }
        }
      }
    }
    
    walk(srcDir);
    expect(found, `Found forbidden word: ${foundWord}`).toBe(false);
  });
});
