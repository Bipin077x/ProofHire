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
    expect(result.rollup?.verdict).toBe("HIGH_RISK");
    
    const payment = result.passport!.find(p => p.claim === "payment");
    expect(payment?.status).toBe("RISK");
    
    const contact = result.passport!.find(p => p.claim === "contact");
    expect(contact?.status).toBe("RISK");
    
    const link = result.passport!.find(p => p.claim === "link");
    expect(link?.status).toBe("RISK");
  });

  it("02_legit_email -> UNVERIFIED, payment VERIFIED, no RISK row", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "02_legit_email.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.rollup?.verdict).toBe("UNVERIFIED");
    
    const payment = result.passport!.find(p => p.claim === "payment");
    expect(payment?.status).toBe("VERIFIED");
    
    const hasRisk = result.passport!.some(p => p.status === "RISK");
    expect(hasRisk).toBe(false);
  });

  it("03_mixed_signals -> HIGH_RISK, payment RISK, pressure UNCLEAR, link RISK", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "03_mixed_signals.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.rollup?.verdict).toBe("HIGH_RISK");
    
    const payment = result.passport!.find(p => p.claim === "payment");
    expect(payment?.status).toBe("RISK");
    
    const pressure = result.passport!.find(p => p.claim === "pressure");
    expect(pressure?.status).toBe("UNCLEAR");
    
    const link = result.passport!.find(p => p.claim === "link");
    expect(link?.status).toBe("RISK"); // microsoft-hiring.co -> lookalike
  });

  it("04_obfuscated_links -> HIGH_RISK, link RISK for IPs, contact RISK, 007.com not blocked", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "04_obfuscated_links.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.rollup?.verdict).toBe("HIGH_RISK");
    
    const link = result.passport!.find(p => p.claim === "link");
    expect(link?.status).toBe("RISK");
    expect(link?.evidence).toContain("127.0.0.1 (blocked: link points to an internal/unsafe address)");
    // 0177.0.0.1 normalizes to 127.0.0.1, so it shouldn't appear separately due to deduping
    expect(link?.evidence).toContain("007.com");
    expect(link?.evidence).not.toContain("007.com (blocked");
    
    const contact = result.passport!.find(p => p.claim === "contact");
    expect(contact?.status).toBe("RISK"); // mygoogle.com -> lookalike
  });

  it("sample -> HIGH_RISK", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "sample.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.rollup?.verdict).toBe("HIGH_RISK");
  });

  it("shortener, gmail -> never NO_RED_FLAGS_FOUND", async () => {
    const shortener = fs.readFileSync(path.join(fixturesDir, "shortener.txt"), "utf-8");
    const gmail = fs.readFileSync(path.join(fixturesDir, "gmail.txt"), "utf-8");
    const res1 = await analyzePost(shortener, undefined, fakeDeps);
    const res2 = await analyzePost(gmail, undefined, fakeDeps);
    
    expect(res1.rollup?.verdict).not.toBe("NO_RED_FLAGS_FOUND");
    expect(res2.rollup?.verdict).not.toBe("NO_RED_FLAGS_FOUND");
  });

  it("infosys -> never HIGH_RISK/CAUTION", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "infosys.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.rollup?.verdict).not.toBe("HIGH_RISK");
    expect(result.rollup?.verdict).not.toBe("CAUTION");
  });

  it("1_scam_data_entry -> HIGH_RISK", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "1_scam_data_entry.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.rollup?.verdict).toBe("HIGH_RISK");
  });
});
