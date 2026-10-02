import { extractClaims } from "./extract";
import { runAllVerifiers, VerificationDeps } from "./verify";
import { calculateRollup, RollupResult } from "./rollup";
import { VerifyResult } from "./verify/types";

export interface AnalyzeResult {
  passport?: VerifyResult[];
  rollup?: RollupResult;
  extracted?: any;
  error?: string;
  status?: number;
}

export async function analyzePost(text: string, imageUrl?: string, deps?: VerificationDeps): Promise<AnalyzeResult> {
  let extracted: any;
  try {
    extracted = await extractClaims({ text, imageUrl });
  } catch (err: any) {
    return {
      error: "Extraction failed: " + (err.message || String(err)),
      status: 400
    };
  }

  // Use dummy provider if deps not passed
  const provider = deps || {
    searchProvider: {
      async search(query: string) { return []; }
    }
  };

  const passport = await runAllVerifiers(extracted, provider);
  const rollup = calculateRollup(passport);

  return {
    passport,
    rollup,
    extracted
  };
}
