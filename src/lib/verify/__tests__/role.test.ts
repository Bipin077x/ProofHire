import { describe, it, expect } from "vitest";
import { verifyRole, SearchProvider } from "../role";

class FakeProvider implements SearchProvider {
  constructor(private results: { title: string; url: string; snippet: string }[], private error?: string) {}
  async search(query: string, includeDomains?: string[]) {
    if (this.error) return { ok: false as const, reason: this.error };
    return { ok: true as const, results: this.results };
  }
}

describe("Role Verifier", () => {
  it("returns VERIFIED on match", async () => {
    const provider = new FakeProvider([{
      title: "Software Engineer Intern - Google Careers",
      url: "https://careers.google.com/jobs/results/123",
      snippet: "Apply for the software engineer intern position."
    }]);
    
    const result = await verifyRole({ company: "Google", role: "Software Engineer Intern" }, provider);
    expect(result.status).toBe("VERIFIED");
    expect(result.sources.some(s => s.url === "https://careers.google.com/jobs/results/123")).toBe(true);
  });

  it("returns UNCLEAR when no match", async () => {
    const provider = new FakeProvider([]);
    const result = await verifyRole({ company: "Google", role: "Software Engineer Intern" }, provider);
    expect(result.status).toBe("UNCLEAR");
    expect(result.evidence).toContain("Not found in the sources we checked");
  });

  it("ignores non-official results", async () => {
    const provider = new FakeProvider([{
      title: "Software Engineer Intern at Google",
      url: "https://linkedin.com/jobs/123",
      snippet: "Apply for the software engineer intern position."
    }]);
    
    const result = await verifyRole({ company: "Google", role: "Software Engineer Intern" }, provider);
    expect(result.status).toBe("UNCLEAR");
  });

  it("returns UNCLEAR on missing role", async () => {
    const provider = new FakeProvider([]);
    const result = await verifyRole({ company: "Google" }, provider);
    expect(result.status).toBe("UNCLEAR");
    expect(result.ruleId).toBe("role.missing");
  });

  it("returns UNCLEAR on provider error (no search key)", async () => {
    const provider = new FakeProvider([], "no search key");
    const result = await verifyRole({ company: "Google", role: "Software Engineer" }, provider);
    expect(result.status).toBe("UNCLEAR");
    expect(result.evidence).toContain("role lookup unavailable (no search key)");
  });
});
