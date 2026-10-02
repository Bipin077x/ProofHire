import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { analyzePost } from "../analyze";
import type { VerificationDeps } from "../verify";
import net from "net";
import dns from "dns/promises";
import { SafeFetchResult } from "../safe-fetch";

const fixturesDir = path.join(__dirname, "../../../scripts/fixtures");

// Guard against real network calls
beforeAll(() => {
  vi.spyOn(net.Socket.prototype, "connect").mockImplementation(() => {
    throw new Error("REAL SOCKET CALL BLOCKED");
  });
  vi.spyOn(dns, "lookup").mockImplementation(() => {
    throw new Error("REAL DNS CALL BLOCKED");
  });
});
afterAll(() => {
  vi.restoreAllMocks();
});

// Mock safeResolve to handle RDAP and normal links
vi.mock("../safe-fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../safe-fetch")>();
  return {
    ...actual,
    safeResolve: vi.fn().mockImplementation(async (url: string): Promise<SafeFetchResult> => {
      if (url.includes("rdap.org")) {
        return {
          finalUrl: url,
          chain: [{ url, status: 200 }],
          text: JSON.stringify({
            events: [{ eventAction: "registration", eventDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() }]
          })
        };
      }
      
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      
      if (host === "127.0.0.1" || host === "0177.0.0.1") {
        return {
          finalUrl: url,
          chain: [{ url, status: 200 }],
          blocked: { reason: "non_canonical_ip", url: host }
        };
      }
      
      if (host === "xn--ggle-0nda.com" || host === "microsoft-hiring.co") {
        return {
          error: "unresolved",
          chain: [{ url, status: 200 }]
        };
      }

      // Official domains resolve fine
      return {
        finalUrl: url,
        chain: [{ url, status: 200 }],
        text: "ok"
      };
    })
  };
});

const fakeDeps: VerificationDeps = {
  searchProvider: {
    async search() { return []; }
  }
};

describe("End-to-End Analysis (regex-only)", () => {
  it("01_simple_scam -> HIGH_RISK, payment RISK, contact RISK, link RISK", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "01_simple_scam.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).toBe("HIGH_RISK");
    
    const payment = result.results!.find(p => p.claim === "payment");
    expect(payment?.status).toBe("RISK");
    
    const contact = result.results!.find(p => p.claim === "contact");
    expect(contact?.status).toBe("RISK");
    
    const link = result.results!.find(p => p.claim === "link");
    expect(link?.status).toBe("RISK");
  });

  it("06_legit_email -> NO_RED_FLAGS_FOUND, payment+contact+company+link VERIFIED", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "06_legit_email.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).toBe("NO_RED_FLAGS_FOUND");
    
    const payment = result.results!.find(p => p.claim === "payment");
    expect(payment?.status).toBe("VERIFIED");
    
    const contact = result.results!.find(p => p.claim === "contact");
    expect(contact?.status).toBe("VERIFIED");
    
    const company = result.results!.find(p => p.claim === "company");
    expect(company?.status).toBe("VERIFIED");
    
    const link = result.results!.find(p => p.claim === "link");
    expect(link?.status).toBe("VERIFIED");
    
    const hasRisk = result.results!.some(p => p.status === "RISK");
    expect(hasRisk).toBe(false);
  });

  it("03_scam_fake_google -> HIGH_RISK, payment RISK", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "03_scam_fake_google.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).toBe("HIGH_RISK");
    
    const payment = result.results!.find(p => p.claim === "payment");
    expect(payment?.status).toBe("RISK");
    
    const contact = result.results!.find(p => p.claim === "contact");
    expect(contact?.status).toBe("RISK"); // g00gle-careers.in is a lookalike
  });

  it("04_legit_startup -> UNVERIFIED, no RISK row", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "04_legit_startup.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).toBe("UNVERIFIED");
    
    const hasRisk = result.results!.some(p => p.status === "RISK");
    expect(hasRisk).toBe(false);
  });

  it("08_obfuscated_links -> HIGH_RISK, link RISK for IPs, contact RISK, 007.com not blocked", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "08_obfuscated_links.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).toBe("HIGH_RISK");
    
    const link = result.results!.find(p => p.claim === "link");
    expect(link?.status).toBe("RISK");
    expect(link?.evidence).toContain("127.0.0.1 (Link is unsafe)");
    expect(link?.evidence).toContain("007.com");
    expect(link?.evidence).not.toContain("007.com (blocked");
    
    const contact = result.results!.find(p => p.claim === "contact");
    expect(contact?.status).toBe("RISK"); // mygoogle.com -> lookalike
  });

  it("09_sample -> HIGH_RISK", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "09_sample.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).toBe("HIGH_RISK");
  });

  it("shortener, gmail -> never NO_RED_FLAGS_FOUND", async () => {
    const shortener = fs.readFileSync(path.join(fixturesDir, "shortener.txt"), "utf-8");
    const gmail = fs.readFileSync(path.join(fixturesDir, "gmail.txt"), "utf-8");
    const res1 = await analyzePost(shortener, undefined, fakeDeps);
    const res2 = await analyzePost(gmail, undefined, fakeDeps);
    
    expect(res1.verdict).not.toBe("NO_RED_FLAGS_FOUND");
    expect(res2.verdict).not.toBe("NO_RED_FLAGS_FOUND");
  });

  it("infosys -> never HIGH_RISK/CAUTION", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "infosys.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).not.toBe("HIGH_RISK");
    expect(result.verdict).not.toBe("CAUTION");
  });
});
