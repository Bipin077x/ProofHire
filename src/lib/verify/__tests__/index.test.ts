import { describe, it, expect, vi } from "vitest";
import { runAllVerifiers } from "../index";
import { SearchProvider } from "../role";
import * as link from "../link";

class MockProvider implements SearchProvider {
  async search(query: string) { return []; }
}

describe("runAllVerifiers", () => {
  it("runs all verifiers and returns array", async () => {
    vi.spyOn(link, "verifyLinks").mockResolvedValue({
      claim: "link", status: "VERIFIED", evidence: "", ruleId: "", sources: []
    });
    const results = await runAllVerifiers({ transcript: "", company: "Google" }, { searchProvider: new MockProvider() });
    expect(results.length).toBe(6);
    expect(results.find(r => r.claim === "link")).toBeDefined();
    expect(results.find(r => r.claim === "role")).toBeDefined();
    expect(results.find(r => r.claim === "payment")).toBeDefined();
  });

  it("handles timeout or rejected promises as UNCLEAR", async () => {
    vi.spyOn(link, "verifyLinks").mockRejectedValue(new Error("Network Error"));
    const results = await runAllVerifiers({ transcript: "", company: "Google" }, { searchProvider: new MockProvider() });
    const linkResult = results.find(r => r.claim === "link");
    expect(linkResult?.status).toBe("UNCLEAR");
    expect(linkResult?.ruleId).toBe("system.check_failed");
  });

  it("handles hanging verifiers using fake timers", async () => {
    vi.useFakeTimers();
    vi.spyOn(link, "verifyLinks").mockImplementation(() => new Promise(() => {})); // Hangs forever
    
    const runPromise = runAllVerifiers({ transcript: "", company: "Google" }, { searchProvider: new MockProvider() });
    
    // Advance timers by 15s to trigger timeout
    vi.advanceTimersByTime(15000);
    
    const results = await runPromise;
    const linkResult = results.find(r => r.claim === "link");
    expect(linkResult?.status).toBe("UNCLEAR");
    expect(linkResult?.ruleId).toBe("system.check_failed");
    expect(linkResult?.evidence).toBe("check failed");
    
    vi.useRealTimers();
  });
});
