import { VerifyResult } from "./types";
import { verifyPayment } from "./payment";
import { verifyContact } from "./contact";
import { verifyCompany } from "./company";
import { verifyPressure } from "./pressure";
import { verifyLinks } from "./link";
import { verifyRole, SearchProvider } from "./role";

export function runOfflineVerifiers(claims: any): VerifyResult[] {
  return [
    verifyPayment(claims),
    verifyContact(claims),
    verifyCompany(claims),
    verifyPressure(claims),
  ];
}

export interface VerificationDeps {
  searchProvider: SearchProvider;
}

export async function runAllVerifiers(claims: any, deps: VerificationDeps): Promise<VerifyResult[]> {
  const offline = runOfflineVerifiers(claims);
  
  const timeoutPromise = (name: string) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000));
  
  const linkPromise = Promise.race([verifyLinks(claims), timeoutPromise("link")]);
  const rolePromise = Promise.race([verifyRole(claims, deps.searchProvider), timeoutPromise("role")]);
  
  const [linkRes, roleRes] = await Promise.allSettled([linkPromise, rolePromise]);
  
  const mapResult = (res: PromiseSettledResult<any>, claimName: string): VerifyResult => {
    if (res.status === "fulfilled") {
      return res.value;
    }
    return {
      claim: claimName as any,
      status: "UNCLEAR",
      evidence: "check failed",
      ruleId: "system.check_failed",
      limitations: res.reason?.message || "Unknown error",
      sources: []
    };
  };

  return [
    ...offline,
    mapResult(linkRes, "link"),
    mapResult(roleRes, "role")
  ];
}
