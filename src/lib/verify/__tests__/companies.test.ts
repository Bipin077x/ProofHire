import { describe, it, expect } from "vitest";
import { resolveCompany, resolveCompanyFromDomains } from "../data/companies";

describe("Companies Data", () => {
  describe("resolveCompany", () => {
    const cases = [
      ["Google", "Google"],
      ["alphabet", "Google"], // alias
      ["ms", "Microsoft"], // alias
      ["TCS", "TCS"],
      ["Microsooft", "Microsoft"], // typo
      ["Googl", "Google"], // typo
      ["Accnture", "Accenture"], // typo
      ["Unknown Startup LLC", null], // unknown
      ["m", null], // too short
    ];
    it.each(cases)("resolves '%s' -> %s", (input, expected) => {
      const res = resolveCompany(input as string).company?.name || null;
      expect(res).toBe(expected);
    });
  });

  describe("resolveCompanyFromDomains", () => {
    const domainCases: Array<[string[], string | null]> = [
      [["google.com"], "Google"],
      [["careers.microsoft.com", "microsoft.com"], "Microsoft"],
      [["unknown.com"], null],
    ];
    it.each(domainCases)("resolves domain %s -> %s", (domains, expected) => {
      const res = resolveCompanyFromDomains(domains as string[]).company?.name || null;
      expect(res).toBe(expected);
    });
  });
});
