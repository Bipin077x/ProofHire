import { describe, it, expect, vi } from "vitest";
import { analyzePost } from "../analyze";
import * as extractMod from "../extract";
import type { ClaimsInput } from "../extract/claimsSchema";

vi.mock("../extract", () => ({
  extractClaims: vi.fn()
}));

describe("analyzePost", () => {
  it("Test 1 (Scam): Expect rollup HIGH_RISK", async () => {
    vi.mocked(extractMod.extractClaims).mockResolvedValue({
      company: "Google",
      payment: { requested: true, wording: "pay Rs 999" },
      transcript: "pay Rs 999",
      extractionMode: "llm+regex"
    } as ClaimsInput & { extractionMode: string });
    
    const result = await analyzePost("pay Rs 999");
    expect(result.rollup?.verdict).toBe("HIGH_RISK");
    expect(result.rollup?.reasons.length).toBeGreaterThan(0);
  });

  it("Test 2 (Legit): Expect rollup UNVERIFIED if no verifiers exist for unknown company", async () => {
    vi.mocked(extractMod.extractClaims).mockResolvedValue({
      company: "Unknown Startup LLC",
      transcript: "apply now",
      extractionMode: "llm+regex"
    } as ClaimsInput & { extractionMode: string });
    
    const result = await analyzePost("apply now");
    expect(result.rollup?.verdict).toBe("UNVERIFIED");
  });

  it("handles extraction failures", async () => {
    vi.mocked(extractMod.extractClaims).mockRejectedValue(new Error("Zod validation failed"));
    const result = await analyzePost("bad data");
    expect(result.status).toBe(400);
    expect(result.error).toContain("Extraction failed: Zod validation failed");
  });
});
