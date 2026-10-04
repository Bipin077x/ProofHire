import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyLinks } from "../link";
import * as safefetch from "../../safe-fetch";

vi.mock("../../safe-fetch", () => ({
  safeResolve: vi.fn()
}));

describe("Link Verifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scam cases", () => {
    it("flags lookalike domains as RISK", async () => {
      vi.mocked(safefetch.safeResolve).mockResolvedValue({
        finalUrl: "https://microsooft.com",
        chain: [{ url: "https://microsooft.com", status: 200 }]
      });
      const result = await verifyLinks({ company: "Microsoft", urls: ["https://microsooft.com"] });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("link.lookalike");
    });

    it("flags microsoft-hiring.co as RISK even when DNS fails", async () => {
      vi.mocked(safefetch.safeResolve).mockResolvedValue({
        finalUrl: "https://microsoft-hiring.co",
        error: "dns_lookup_failed",
        chain: []
      });
      const result = await verifyLinks({ company: "Microsoft", urls: ["https://microsoft-hiring.co"] });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("link.lookalike");
    });

    it("flags shortener to unofficial domain as RISK", async () => {
      vi.mocked(safefetch.safeResolve).mockResolvedValue({
        finalUrl: "https://random-jobs.com",
        chain: [{ url: "https://bit.ly/123", status: 302 }, { url: "https://random-jobs.com", status: 200 }]
      });
      const result = await verifyLinks({ company: "Google", urls: ["https://bit.ly/123"] });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("link.shortener_unofficial");
    });

    it("flags IP literal domains as RISK", async () => {
      vi.mocked(safefetch.safeResolve).mockResolvedValue({
        finalUrl: "http://10.0.0.1",
        chain: [],
        blocked: { reason: "private_ip", url: "http://10.0.0.1" }
      });
      const result = await verifyLinks({ company: "Google", urls: ["http://10.0.0.1"] });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("link.ip_literal");
    });

    it("flags new domains (< 90 days) as RISK", async () => {
      vi.mocked(safefetch.safeResolve).mockImplementation(async (url) => {
        if (url.includes("rdap.org")) {
          return {
            finalUrl: url,
            chain: [],
            text: JSON.stringify({ events: [{ eventAction: "registration", eventDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }] })
          };
        }
        return { finalUrl: url, chain: [{ url, status: 200 }] };
      });
      
      const result = await verifyLinks({ company: "Google", urls: ["https://new-jobs-portal.com"] });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("link.new_domain");
    });

    it("flags suspicious TLDs as RISK", async () => {
      vi.mocked(safefetch.safeResolve).mockImplementation(async (url) => {
        if (url.includes("rdap.org")) return { finalUrl: url, chain: [], text: "{}" };
        return { finalUrl: url, chain: [{ url, status: 200 }] };
      });
      
      const result = await verifyLinks({ company: "Microsoft", urls: ["https://jobs.xyz"] });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("link.suspicious_tld");
    });
  });

  describe("Legitimate & Unclear cases", () => {
    it("verifies official domain", async () => {
      vi.mocked(safefetch.safeResolve).mockResolvedValue({
        finalUrl: "https://careers.google.com",
        chain: [{ url: "https://careers.google.com", status: 200 }]
      });
      const result = await verifyLinks({ company: "Google", urls: ["https://careers.google.com"] });
      expect(result.status).toBe("VERIFIED");
    });

    it("verifies official domain even when DNS fails", async () => {
      vi.mocked(safefetch.safeResolve).mockResolvedValue({
        finalUrl: "https://careers.google.com",
        error: "dns_lookup_failed",
        chain: []
      });
      const res1 = await verifyLinks({ company: "Google", urls: ["https://careers.google.com"] });
      expect(res1.status).toBe("VERIFIED");
      expect(res1.ruleId).toBe("link.official_domain");
      
      const res2 = await verifyLinks({ company: "Infosys", urls: ["https://careers.infosys.com"] });
      expect(res2.status).toBe("VERIFIED");
      expect(res2.ruleId).toBe("link.official_domain");
    });

    it("verifies shortener resolving to official domain", async () => {
      vi.mocked(safefetch.safeResolve).mockResolvedValue({
        finalUrl: "https://careers.google.com",
        chain: [{ url: "https://bit.ly/123", status: 302 }, { url: "https://careers.google.com", status: 200 }]
      });
      const result = await verifyLinks({ company: "Google", urls: ["https://bit.ly/123"] });
      expect(result.status).toBe("VERIFIED");
    });

    it("returns UNCLEAR for forms/chat hosts", async () => {
      vi.mocked(safefetch.safeResolve).mockResolvedValue({
        finalUrl: "https://forms.gle/xyz",
        chain: [{ url: "https://forms.gle/xyz", status: 200 }]
      });
      const result = await verifyLinks({ company: "Microsoft", urls: ["https://forms.gle/xyz"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("link.form_chat_host");
    });

    it("returns UNCLEAR for unresolved URLs", async () => {
      vi.mocked(safefetch.safeResolve).mockResolvedValue({
        finalUrl: "https://broken-link.com",
        chain: [],
        error: "dns_lookup_failed"
      });
      const result = await verifyLinks({ company: "Google", urls: ["https://broken-link.com"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("link.unresolved");
    });

    it("returns UNCLEAR for recent domains (< 365 days)", async () => {
      vi.mocked(safefetch.safeResolve).mockImplementation(async (url) => {
        if (url.includes("rdap.org")) {
          return {
            finalUrl: url,
            chain: [],
            text: JSON.stringify({ events: [{ eventAction: "registration", eventDate: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString() }] })
          };
        }
        return { finalUrl: url, chain: [{ url, status: 200 }] };
      });
      
      const result = await verifyLinks({ company: "Google", urls: ["https://some-jobs-portal.com"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("link.recent_domain");
    });

    it("returns UNCLEAR for unknown company", async () => {
      vi.mocked(safefetch.safeResolve).mockImplementation(async (url) => {
        if (url.includes("rdap.org")) {
          return {
            finalUrl: url,
            chain: [],
            text: JSON.stringify({ events: [{ eventAction: "registration", eventDate: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString() }] })
          };
        }
        return { finalUrl: url, chain: [{ url, status: 200 }] };
      });
      
      const result = await verifyLinks({ company: "UnknownStartup", urls: ["https://unknownstartup.com"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("link.unknown_company");
    });
    
    it("handles RDAP failure without returning RISK (limitation noted)", async () => {
      vi.mocked(safefetch.safeResolve).mockImplementation(async (url) => {
        if (url.includes("rdap.org")) return { finalUrl: url, chain: [], error: "network_error" };
        return { finalUrl: url, chain: [{ url, status: 200 }] };
      });
      
      const result = await verifyLinks({ company: "UnknownStartup2", urls: ["https://rdap-fail.com"] });
      expect(result.status).not.toBe("RISK");
      expect(result.limitations || "").toContain("Could not verify domain age");
    });
  });
});
