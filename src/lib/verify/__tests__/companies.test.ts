import { describe, it, expect } from "vitest";
import { resolveCompany } from "../data/companies";

describe("Companies Data", () => {
  it("resolves exact names and aliases", () => {
    expect(resolveCompany("Google").company?.name).toBe("Google");
    expect(resolveCompany("alphabet").company?.name).toBe("Google");
    expect(resolveCompany("ms").company?.name).toBe("Microsoft");
    expect(resolveCompany("TCS").company?.name).toBe("TCS");
  });

  it("resolves short-name exactness", () => {
    // "ms" is length 2, so it requires exact match
    expect(resolveCompany("ms").company?.name).toBe("Microsoft");
    expect(resolveCompany("m").company).toBeNull(); // too short, no alias "m"
  });

  it("resolves typos using Levenshtein distance", () => {
    expect(resolveCompany("Microsooft").company?.name).toBe("Microsoft");
    expect(resolveCompany("Googl").company?.name).toBe("Google");
    expect(resolveCompany("Accnture").company?.name).toBe("Accenture");
  });

  it("returns null for completely unknown companies", () => {
    expect(resolveCompany("Unknown Startup LLC").company).toBeNull();
    expect(resolveCompany("RandomTech").company).toBeNull();
  });
});
