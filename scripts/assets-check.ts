import fs from "fs";
import path from "path";

const BUDGETS = {
  "logo-mark.svg": 5000,
  "logo-wordmark.svg": 10000,
  "favicon.svg": 2000,
  "empty-history.svg": 50000,
  "error.svg": 50000,
  "rate-limited.svg": 50000
};

let hasError = false;

function checkAsset(filename: string, maxBytes: number) {
  const p = path.join(process.cwd(), "public", "brand", filename);
  const pIll = path.join(process.cwd(), "public", "illustrations", filename);
  let finalPath = p;

  if (!fs.existsSync(p)) {
    if (!fs.existsSync(pIll)) {
      console.warn(`[WARN] Missing asset: ${filename}`);
      return;
    }
    finalPath = pIll;
  }
  
  const stats = fs.statSync(finalPath);
  if (stats.size > maxBytes) {
    console.error(`[ERROR] Asset ${filename} exceeds budget: ${stats.size} bytes > ${maxBytes} bytes`);
    hasError = true;
  } else {
    console.log(`[OK] Asset ${filename}: ${stats.size} bytes`);
  }
}

for (const [file, budget] of Object.entries(BUDGETS)) {
  checkAsset(file, budget);
}

// Check for missing alt text in TSX files
const srcDir = path.join(process.cwd(), "src");

function walkDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith(".tsx")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      // Match <img> but verify alt attribute
      const imgTags = content.match(/<img[^>]*>/g) || [];
      for (const tag of imgTags) {
        if (!tag.includes("alt=")) {
          console.error(`[ERROR] Missing alt text in ${path.relative(process.cwd(), fullPath)}: ${tag}`);
          hasError = true;
        }
      }
    }
  }
}

walkDir(srcDir);

if (hasError) {
  process.exit(1);
} else {
  console.log("All asset checks passed.");
}
