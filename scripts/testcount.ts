import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run() {
  try {
    execSync('npx vitest run --no-file-parallelism --reporter=json --outputFile=.testcount.json', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (_err: unknown) {
    // Tests might fail, that's fine, we still have the json
  }

  try {
    const raw = fs.readFileSync('.testcount.json', 'utf-8');
    const data = JSON.parse(raw);
    const counts: Record<string, { passed: number; failed: number; skipped: number }> = {};
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const res of data.testResults) {
      // res.name is the file path
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      for (const assertion of res.assertionResults) {
        if (assertion.status === 'passed') passed++;
        if (assertion.status === 'failed') failed++;
        if (assertion.status === 'skipped') skipped++;
      }
      counts[res.name] = { passed, failed, skipped };
      totalPassed += passed;
      totalFailed += failed;
      totalSkipped += skipped;
    }

    let hasError = false;
    let baselineData: Record<string, number> | null = null;
    try {
      const baselineRaw = fs.readFileSync('.testbaseline.json', 'utf-8');
      const rawData = JSON.parse(baselineRaw);
      baselineData = {};
      for (const [k, v] of Object.entries(rawData)) {
        baselineData[k.replace(/\\/g, '/')] = v as number;
      }
    } catch {
      console.warn("No .testbaseline.json found, skipping baseline check.");
    }

    console.log('--- Test Counts ---');
    for (const [file, c] of Object.entries(counts)) {
      const relFile = path.relative(process.cwd(), file).replace(/\\/g, '/');
      const totalFile = c.passed + c.failed + c.skipped;
      console.log(`${relFile}: ${totalFile} tests (${c.passed} passed, ${c.failed} failed, ${c.skipped} skipped)`);
      if (baselineData && baselineData[relFile] !== undefined) {
        if (totalFile < baselineData[relFile]) {
          console.error(`ERROR: ${relFile} test count dropped to ${totalFile} (baseline is ${baselineData[relFile]})`);
          hasError = true;
        }
      }
    }
    const totalAll = totalPassed + totalFailed + totalSkipped;
    console.log(`\nTotal tests: ${totalAll} (${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped)`);
    
    if (baselineData && baselineData.total !== undefined && totalAll < baselineData.total) {
      console.error(`ERROR: Total test count dropped to ${totalAll} (baseline is ${baselineData.total})`);
      hasError = true;
    }

    if (baselineData) {
      for (const [bFile, bCount] of Object.entries(baselineData)) {
        if (bFile === 'total') continue;
        const normalized = bFile.replace(/\\/g, '/');
        const countObj = Object.values(counts).find((c, i) => Object.keys(counts)[i].replace(/\\/g, '/').endsWith(normalized));
        if (!countObj) {
           console.error(`ERROR: Baseline file ${normalized} is missing from test results!`);
           hasError = true;
        }
      }
    }
    
    if (hasError) {
      process.exit(1);
    }
  } catch (_e: unknown) {
    const error = _e as Error;
    console.error('Failed to parse test count:', error.message);
    process.exit(1);
  }
}

run();
