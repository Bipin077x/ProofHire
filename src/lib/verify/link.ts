import { VerifyResult } from "./types";
import { safeResolve } from "../safe-fetch";
import { isLookalike, isOfficial, registrableDomain } from "./domain";
import { resolveCompany } from "./data/companies";

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly"];
const FORM_CHAT_HOSTS = ["forms.gle", "docs.google.com", "wa.me", "chat.whatsapp.com", "t.me", "linktr.ee"];
const SUSPICIOUS_TLDS = [".xyz", ".top", ".click", ".work", ".buzz", ".icu", ".vip"];

interface RdapCacheEntry {
  timestamp: number;
  dateStr?: string;
  error?: string;
}
const rdapCache = new Map<string, RdapCacheEntry>();

async function getDomainAge(regDomain: string): Promise<{ dateStr?: string; error?: string; ageDays?: number }> {
  const cacheHit = rdapCache.get(regDomain);
  if (cacheHit && Date.now() - cacheHit.timestamp < 24 * 60 * 60 * 1000) {
    if (cacheHit.error) return { error: cacheHit.error };
    const ageDays = cacheHit.dateStr ? (Date.now() - new Date(cacheHit.dateStr).getTime()) / (1000 * 60 * 60 * 24) : undefined;
    return { dateStr: cacheHit.dateStr, ageDays };
  }

  const result = await safeResolve(`https://rdap.org/domain/${regDomain}`, { method: "GET", readBody: true, headers: { "Accept": "application/json" } });
  if (result.error || result.blocked || !result.text) {
    return { error: result.error || result.blocked?.reason || "no_body" };
  }
  
  try {
    const data = JSON.parse(result.text);
    const regEvent = data.events?.find((e: { eventAction?: string; eventDate?: string }) => e.eventAction === "registration");
    if (regEvent && regEvent.eventDate) {
      const ageDays = (Date.now() - new Date(regEvent.eventDate).getTime()) / (1000 * 60 * 60 * 24);
      rdapCache.set(regDomain, { timestamp: Date.now(), dateStr: regEvent.eventDate });
      return { dateStr: regEvent.eventDate, ageDays };
    }
    return { error: "no_registration_date" };
  } catch (e: unknown) {
    return { error: "invalid_json" };
  }
}

export async function verifyLinks(claims: { company?: string; urls?: string[] }): Promise<VerifyResult> {
  const companyName = claims.company;
  const urls = Array.from(new Set(claims.urls || [] as string[])).slice(0, 5);
  
  if (urls.length === 0) {
    return { claim: "link", status: "NOT_VERIFIED", evidence: "No URLs provided.", ruleId: "link.missing", sources: [] };
  }

  let worstStatus = "VERIFIED";
  const combinedEvidence: string[] = [];
  const combinedSources: { url: string; label: string }[] = [];
  let ruleId = "link.verified";
  let limitations = "";

  const updateWorst = (status: string) => {
    if (status === "RISK") worstStatus = "RISK";
    else if (status === "UNCLEAR" && worstStatus !== "RISK") worstStatus = "UNCLEAR";
  };

  const companyData = companyName ? resolveCompany(companyName).company : null;

  for (const urlStr of urls) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr as string);
    } catch {
      continue;
    }
    
    const initialHost = parsedUrl.hostname;
    
    // Resolve URL through safe-fetch
    const fetchRes = await safeResolve(urlStr as string);
    let finalHost = initialHost;
    let finalUrlStr = urlStr as string;
    
    if (fetchRes.finalUrl && !fetchRes.error && !fetchRes.blocked) {
      try {
        finalHost = new URL(fetchRes.finalUrl).hostname;
        finalUrlStr = fetchRes.finalUrl;
      } catch (e) {}
    }
    
    const chainStr = fetchRes.chain.length > 1 ? `${initialHost} -> ${finalHost}` : finalHost;

    if (fetchRes.blocked) {
      updateWorst("RISK");
      combinedEvidence.push(`${chainStr} (blocked: link points to an internal/unsafe address)`);
      ruleId = "link.blocked_unsafe";
      continue;
    }

    if (fetchRes.error) {
      updateWorst("UNCLEAR");
      combinedEvidence.push(`${chainStr} (destination hidden; could not be resolved)`);
      if (ruleId !== "link.blocked_unsafe") ruleId = "link.unresolved";
      continue;
    }

    const regDom = registrableDomain(finalHost);
    
    if (SUSPICIOUS_TLDS.some(tld => finalHost.endsWith(tld))) {
      updateWorst("RISK");
      combinedEvidence.push(`${chainStr} (uses suspicious TLD)`);
      if (ruleId !== "link.blocked_unsafe") ruleId = "link.suspicious_tld";
    }

    if (FORM_CHAT_HOSTS.some(h => finalHost === h || finalHost.endsWith("." + h))) {
      updateWorst("UNCLEAR");
      combinedEvidence.push(`${chainStr} (external form/chat host; not the company's own site)`);
      if (worstStatus !== "RISK") ruleId = "link.form_chat_host";
      continue;
    }

    let isOff = false;
    let isLook = false;

    if (companyData && companyData.officialDomains) {
      isOff = isOfficial(finalHost, companyData.officialDomains);
      isLook = isLookalike(finalHost, companyData.officialDomains);
      
      if (isOff) {
        // VERIFIED for this URL
        combinedEvidence.push(`${chainStr} (official domain)`);
        combinedSources.push({ url: finalUrlStr, label: finalHost });
      } else if (isLook) {
        updateWorst("RISK");
        combinedEvidence.push(`${chainStr} (lookalike of the claimed brand)`);
        if (ruleId !== "link.blocked_unsafe") ruleId = "link.lookalike";
      } else if (fetchRes.chain.length > 1 && SHORTENERS.some(s => initialHost === s || initialHost.endsWith("." + s))) {
        updateWorst("RISK");
        combinedEvidence.push(`${chainStr} (shortener resolved to unofficial domain)`);
        if (ruleId !== "link.blocked_unsafe") ruleId = "link.shortener_unofficial";
      } else {
        updateWorst("UNCLEAR");
        combinedEvidence.push(`${chainStr} (unofficial domain)`);
        if (worstStatus !== "RISK") ruleId = "link.unofficial";
      }
    } else {
      updateWorst("UNCLEAR");
      combinedEvidence.push(`${chainStr} (company unknown, cannot verify if domain is official)`);
      if (worstStatus !== "RISK") ruleId = "link.unknown_company";
    }

    // RDAP Domain Age (only if not official, or maybe always?)
    if (regDom && !isOff && !FORM_CHAT_HOSTS.some(h => finalHost === h || finalHost.endsWith("." + h))) {
      const ageRes = await getDomainAge(regDom);
      if (ageRes.error) {
        limitations = "Could not verify domain age: " + ageRes.error;
      } else if (ageRes.ageDays !== undefined) {
        if (ageRes.ageDays < 90) {
          updateWorst("RISK");
          combinedEvidence.push(`${chainStr} (registered ${Math.floor(ageRes.ageDays)} days ago)`);
          if (ruleId !== "link.blocked_unsafe" && ruleId !== "link.lookalike") ruleId = "link.new_domain";
        } else if (ageRes.ageDays < 365) {
          updateWorst("UNCLEAR");
          combinedEvidence.push(`${chainStr} (registered ${Math.floor(ageRes.ageDays)} days ago)`);
          if (worstStatus !== "RISK") ruleId = "link.recent_domain";
        }
      }
    }
  }

  return {
    claim: "link",
    status: worstStatus as "VERIFIED" | "RISK" | "UNCLEAR" | "NOT_VERIFIED",
    evidence: combinedEvidence.join("; "),
    ruleId: ruleId,
    sources: combinedSources,
    limitations: limitations || undefined
  };
}
