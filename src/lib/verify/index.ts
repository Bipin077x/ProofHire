import { VerifyResult, ClaimKey } from "./types";
import { verifyPayment } from "./payment";
import { verifyContact } from "./contact";
import { verifyCompany } from "./company";
import { verifyPressure } from "./pressure";
import { verifyLinks } from "./link";
import { verifyRole, SearchProvider } from "./role";
import { verifyPage } from "./page";
import type { PageProvider } from "../providers/index";
import type { ClaimsInput } from "../extract/claimsSchema";

export function runOfflineVerifiers(claims: ClaimsInput): VerifyResult[] {
  return [
    verifyPayment(claims),
    verifyContact(claims),
    verifyCompany(claims),
    verifyPressure(claims),
  ];
}

export interface VerificationDeps {
  searchProvider: SearchProvider;
  pageProvider?: PageProvider;
  resolveUrl?: (url: string) => Promise<import("../safe-fetch").SafeFetchResult>;
}

export async function runAllVerifiers(claims: ClaimsInput, deps: VerificationDeps): Promise<VerifyResult[]> {
  const offline = runOfflineVerifiers(claims);
  
  const timeoutPromise = (name: string) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000));
  
  const linkPromise = Promise.race([verifyLinks(claims, deps.resolveUrl), timeoutPromise("link")]);
  const rolePromise = Promise.race([verifyRole(claims, deps.searchProvider), timeoutPromise("role")]);
  const pagePromise = Promise.race([verifyPage(claims, deps.pageProvider), timeoutPromise("page")]);
  
  const [linkRes, roleRes, pageRes] = await Promise.allSettled([linkPromise, rolePromise, pagePromise]);
  
  const mapResult = (res: PromiseSettledResult<VerifyResult>, claimName: ClaimKey): VerifyResult => {
    if (res.status === "fulfilled") {
      return res.value;
    }
    return {
      claim: claimName,
      status: "UNCLEAR",
      evidence: "check failed",
      ruleId: "system.check_failed",
      limitations: (res as PromiseRejectedResult).reason?.message || "Unknown error",
      sources: []
    };
  };

  const mapped = [
    ...offline,
    mapResult(linkRes as PromiseSettledResult<VerifyResult>, "link"),
    mapResult(roleRes as PromiseSettledResult<VerifyResult>, "role"),
    mapResult(pageRes as PromiseSettledResult<VerifyResult>, "page")
  ];

  const { getTemplate } = await import("../../content/copyTemplates");
  for (const res of mapped) {
    if (res.claim === "link" || res.claim === "page") continue;
    const template = getTemplate(res.ruleId);
    if (template && template.evidence) {
      res.evidence = template.evidence;
    }
  }

  return mapped;
}
