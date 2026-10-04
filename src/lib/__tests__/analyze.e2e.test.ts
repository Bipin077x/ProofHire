import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { analyzePost } from "../analyze";
import type { VerificationDeps } from "../verify";

const fixturesDir = path.join(__dirname, "../../../scripts/fixtures");

// vi.hoisted makes the function available to the hoisted vi.mock factory
const { makeFakeResolve } = vi.hoisted(() => {
  return {
    makeFakeResolve: () => {
      return async function fakeResolve(urlStr: string) {
        if (urlStr.includes("rdap.org")) {
          return {
            finalUrl: urlStr,
            chain: [{ url: urlStr, status: 200 }],
            text: JSON.stringify({
              events: [{ eventAction: "registration", eventDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() }]
            })
          };
        }
        const parsed = new URL(urlStr);
        const host = parsed.hostname.toLowerCase();
        if (host === "127.0.0.1" || host === "0177.0.0.1" || host.match(/^[0-9.]+$/)) {
          return {
            finalUrl: urlStr,
            chain: [{ url: urlStr, status: 200 }],
            blocked: { reason: "non_canonical_ip", url: urlStr }
          };
        }
        if (host === "bit.ly" || host === "rb.gy" || host === "short.link" || host === "xn--ggle-0nda.com" || host === "microsoft-hiring.co") {
          return {
            finalUrl: urlStr,
            error: "unresolved",
            chain: [{ url: urlStr, status: 200 }]
          };
        }
        return {
          finalUrl: urlStr,
          chain: [{ url: urlStr, status: 200 }],
          text: "ok"
        };
      };
    }
  };
});

// Guard against real network calls
beforeAll(async () => {
  const { installOfflineMocks } = await import("../testing/offlineDeps");
  installOfflineMocks(vi);
});
afterAll(() => {
  vi.restoreAllMocks();
});

// Mock safeResolve to handle RDAP and normal links
vi.mock("../safe-fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../safe-fetch")>();
  return {
    ...actual,
    safeResolve: vi.fn().mockImplementation(makeFakeResolve())
  };
});

const fakeDeps: VerificationDeps = {
  searchProvider: { async search() { return []; } },
  resolveUrl: makeFakeResolve()
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

  it("06_legit_email -> UNVERIFIED, no RISK rows, payment+company+link VERIFIED, contact UNCLEAR (no email in original)", async () => {
    // Original 02_legit_email.txt content: careers.google.com URL but no explicit email address.
    // contact is UNCLEAR because no email/phone is present.
    // With all 4 required claims (payment/company/contact/link), contact is not VERIFIED -> UNVERIFIED.
    const text = fs.readFileSync(path.join(fixturesDir, "06_legit_email.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).toBe("UNVERIFIED");

    const payment = result.results!.find(p => p.claim === "payment");
    expect(payment?.status).toBe("VERIFIED");

    const company = result.results!.find(p => p.claim === "company");
    expect(company?.status).toBe("VERIFIED");

    const link = result.results!.find(p => p.claim === "link");
    expect(link?.status).toBe("VERIFIED");

    const contact = result.results!.find(p => p.claim === "contact");
    expect(contact?.status).toBe("UNCLEAR"); // no email/phone in original file

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

  it("07_mixed_signals -> HIGH_RISK, payment RISK, pressure UNCLEAR, link RISK", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "07_mixed_signals.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).toBe("HIGH_RISK");
    
    const payment = result.results!.find(p => p.claim === "payment");
    expect(payment?.status).toBe("RISK");
    
    const pressure = result.results!.find(p => p.claim === "pressure");
    expect(pressure?.status).toBe("UNCLEAR"); // pressure is never RISK
    
    const link = result.results!.find(p => p.claim === "link");
    expect(link?.status).toBe("RISK");
  });

  it("10_legit_with_contact -> NO_RED_FLAGS_FOUND", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "10_legit_with_contact.txt"), "utf-8");
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
  });

  it("08_obfuscated_links -> HIGH_RISK, link RISK for IPs, contact RISK, 007.com not blocked", async () => {
    const text = fs.readFileSync(path.join(fixturesDir, "08_obfuscated_links.txt"), "utf-8");
    const result = await analyzePost(text, undefined, fakeDeps);
    expect(result.verdict).toBe("HIGH_RISK");
    
    const link = result.results!.find(p => p.claim === "link");
    expect(link?.status).toBe("RISK");
    expect(link?.evidence).toContain("127.0.0.1");
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
