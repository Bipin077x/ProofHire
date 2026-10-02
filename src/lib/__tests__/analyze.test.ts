import { describe, it, expect, vi } from "vitest";
import { analyzePost } from "../analyze";
import * as extractMod from "../extract";

vi.mock("../extract", () => ({
  extractClaims: vi.fn()
}));

describe("analyzePost", () => {
  it("Test 1 (Scam): Expect rollup HIGH", async () => {
    vi.mocked(extractMod.extractClaims).mockResolvedValue({
      company: "Google",
      payment: { requested: true, wording: "pay Rs 999" },
      transcript: "pay Rs 999"
    });
    
    const result = await analyzePost("pay Rs 999");
    expect(result.rollup?.riskLevel).toBe("HIGH");
    expect(result.rollup?.reasons.length).toBeGreaterThan(0);
  });

  it("Test 2 (Unverified): Expect rollup CAUTION", async () => {
    vi.mocked(extractMod.extractClaims).mockResolvedValue({
      company: "Unknown XYZ",
      contact: { type: "phone", phone: "+911234567890" },
      transcript: "Call +911234567890"
    });
    
    const result = await analyzePost("Call +911234567890");
    expect(result.rollup?.riskLevel).toBe("CAUTION");
    expect(result.rollup?.reasons.some(r => r.includes("Core identity"))).toBe(true);
  });
  
  it("handles extraction failures", async () => {
    vi.mocked(extractMod.extractClaims).mockRejectedValue(new Error("Zod validation failed"));
    const result = await analyzePost("bad data");
    expect(result.status).toBe(400);
    expect(result.error).toContain("Extraction failed: Zod validation failed");
  });
});
