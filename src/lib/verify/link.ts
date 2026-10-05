import { VerifyResult } from "./types";
import { safeResolve, SafeFetchResult } from "../safe-fetch";
import { isLookalike, isOfficial, registrableDomain } from "./domain";
import { resolveCompany, KNOWN_COMPANIES } from "./data/companies";

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly"];
const FORM_CHAT_HOSTS = ["forms.gle", "docs.google.com", "wa.me", "chat.whatsapp.com", "t.me", "linktr.ee"];
const SUSPICIOUS_TLDS = [".xyz", ".top", ".click", ".work", ".buzz", ".icu", ".vip"];
const LOOKALIKE_KEYWORDS = ["hiring", "careers", "jobs", "recruit", "hr", "apply", "internship", "official", "team", "india"];

interface RdapCacheEntry {
  timestamp: number;
  dateStr?: string;
  error?: string;
}
const rdapCache = new Map<string, RdapCacheEntry>();

async function getDomainAge(regDomain: string, resolveUrlOverride?: (url: string) => Promise<SafeFetchResult>): Promise<{ dateStr?: string; error?: string; ageDays?: number }> {
  const cacheHit = rdapCache.get(regDomain);
  if (cacheHit && Date.now() - cacheHit.timestamp < 24 * 60 * 60 * 1000) {
    if (cacheHit.error) return { error: cacheHit.error };
    const ageDays = cacheHit.dateStr ? (Date.now() - new Date(cacheHit.dateStr).getTime()) / (1000 * 60 * 60 * 24) : undefined;
    return { dateStr: cacheHit.dateStr, ageDays };
  }

  const resolver = resolveUrlOverride || ((u: string) => safeResolve(u, { method: "GET", readBody: true, headers: { "Accept": "application/json" } }));
  const result = await resolver(`https://rdap.org/domain/${regDomain}`);
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

export async function verifyLinks(claims: { company?: string; urls?: string[] }, resolveUrlOverride?: (url: string) => Promise<SafeFetchResult>): Promise<VerifyResult> {
  const companyName = claims.company;
  const urls = Array.from(new Set(claims.urls || [] as string[])).slice(0, 5);
  
  if (urls.length === 0) {
    return { claim: "link", status: "UNCLEAR", evidence: "No link provided.", ruleId: "link.missing", sources: [] };
  }

  let worstStatus = "VERIFIED";
  const combinedEvidence: string[] = [];
  const combinedSources: { url: string; label: string; kind?: "official" | "search_result" | "user_post" | "other" }[] = [];
  let ruleId = "link.verified";
  let limitations = "";

  const updateWorst = (status: string) => {
    if (status === "RISK") worstStatus = "RISK";
    else if (status === "UNCLEAR" && worstStatus !== "RISK") worstStatus = "UNCLEAR";
  };

  const companyData = companyName ? resolveCompany(companyName).company : null;
  const seenInitialHosts = new Set<string>();

  for (const urlStr of urls) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr as string);
    } catch {
      continue;
    }
    
    const initialHost = parsedUrl.hostname.toLowerCase();
    
    if (seenInitialHosts.has(initialHost)) continue;
    seenInitialHosts.add(initialHost);

    // 1. OFFLINE CHECKS BEFORE NETWORK CALL

    // Check Official Domain
    if (companyData && companyData.officialDomains && isOfficial(initialHost, companyData.officialDomains)) {
      // VERIFIED link.official_domain
      combinedEvidence.push(`Domain matches the company's official site; destination was not checked.`);
      combinedSources.push({ url: urlStr, label: initialHost, kind: "official" });
      if (ruleId === "link.verified") ruleId = "link.official_domain";
      continue; // Skip network call entirely
    }

    const isPunycode = initialHost.includes("xn--");
    let isLook = false;
    let lookalikeCompany = companyData?.name;
    
    if (companyData && companyData.officialDomains) {
      if (!isPunycode) {
         // Check Brand + hyphen/keyword lookalikes
         const brandNameLower = companyData.name.toLowerCase().replace(/[^a-z0-9]/g, "");
         const withoutTld = initialHost.split(".")[0];
         for (const kw of LOOKALIKE_KEYWORDS) {
           if (withoutTld.includes(brandNameLower) && withoutTld.includes(kw) && withoutTld !== brandNameLower) {
             isLook = true;
             break;
           }
         }
         if (!isLook) {
           isLook = isLookalike(initialHost, companyData.officialDomains);
         }
      }
    } else if (!companyData && !isPunycode) {
      for (const key of Object.keys(KNOWN_COMPANIES)) {
        const comp = KNOWN_COMPANIES[key];
        const brandNameLower = comp.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const withoutTld = initialHost.split(".")[0];
        let found = false;
        for (const kw of LOOKALIKE_KEYWORDS) {
          if (withoutTld.includes(brandNameLower) && withoutTld.includes(kw) && withoutTld !== brandNameLower) {
            found = true;
            break;
          }
        }
        if (found || isLookalike(initialHost, comp.officialDomains)) {
          isLook = true;
          lookalikeCompany = comp.name;
          break;
        }
      }
    }

    if (isLook) {
      updateWorst("RISK");
      combinedEvidence.push(`${initialHost} (lookalike of ${lookalikeCompany})`);
      ruleId = "link.lookalike";
      continue; // do not downgrade on network fail
    }

    // IP literals
    if (initialHost.match(/^[0-9.]+$/) || (initialHost.startsWith("[") && initialHost.endsWith("]"))) {
      updateWorst("RISK");
      combinedEvidence.push(`${initialHost} (IP literal)`);
      ruleId = "link.ip_literal";
      continue; // Do not resolve
    }

    if (isPunycode) {
      if (lookalikeCompany) { // implies it's claiming a known company or inferred one
        updateWorst("RISK");
        combinedEvidence.push(`${initialHost} (punycode domain targeting known brand)`);
        ruleId = "link.punycode";
      } else {
        updateWorst("UNCLEAR");
        combinedEvidence.push(`${initialHost} (punycode domain, check carefully)`);
        if (worstStatus !== "RISK") ruleId = "link.punycode_unknown";
      }
      continue;
    }

    // 2. NETWORK CALL
    const resolver = resolveUrlOverride || ((u: string) => safeResolve(u));
    const fetchRes = await resolver(urlStr as string);
    let finalHost = initialHost;
    let finalUrlStr = urlStr as string;
    
    if (fetchRes.finalUrl && !fetchRes.error && !fetchRes.blocked) {
      try {
        finalHost = new URL(fetchRes.finalUrl).hostname.toLowerCase();
        finalUrlStr = fetchRes.finalUrl;
      } catch (e) {}
    }
    
    const chainStr = fetchRes.chain.length > 1 ? `${initialHost} -> ${finalHost}` : finalHost;

    if (fetchRes.blocked) {
      updateWorst("RISK");
      combinedEvidence.push(`${chainStr} (Link is unsafe)`);
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.punycode_unknown") ruleId = "link.blocked_unsafe";
      continue;
    }

    if (fetchRes.error) {
      updateWorst("UNCLEAR");
      if (fetchRes.error === "unresolved" && SHORTENERS.some(s => initialHost === s || initialHost.endsWith("." + s))) {
         combinedEvidence.push(`${chainStr} (destination hidden)`);
      } else {
         combinedEvidence.push(`${chainStr} (Link failed to resolve)`);
      }
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.punycode_unknown" && ruleId !== "link.blocked_unsafe") ruleId = "link.unresolved";
      continue;
    }

    const regDom = registrableDomain(finalHost);
    
    if (SUSPICIOUS_TLDS.some(tld => finalHost.endsWith(tld))) {
      updateWorst("RISK");
      combinedEvidence.push(`${chainStr} (uses suspicious TLD)`);
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.punycode_unknown" && ruleId !== "link.blocked_unsafe") ruleId = "link.suspicious_tld";
    }

    if (FORM_CHAT_HOSTS.some(h => finalHost === h || finalHost.endsWith("." + h))) {
      updateWorst("UNCLEAR");
      combinedEvidence.push(`${chainStr} (external form/chat host; not the company's own site)`);
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.punycode_unknown" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld") ruleId = "link.form_chat_host";
      continue;
    }

    let isOff = false;

    if (companyData && companyData.officialDomains) {
      isOff = isOfficial(finalHost, companyData.officialDomains);
      
      if (isOff) {
        // VERIFIED for this URL
        combinedEvidence.push(`${chainStr} (official domain)`);
        combinedSources.push({ url: finalUrlStr, label: finalHost, kind: "official" });
        if (ruleId === "link.verified") ruleId = "link.official_domain";
      } else if (fetchRes.chain.length > 1 && SHORTENERS.some(s => initialHost === s || initialHost.endsWith("." + s))) {
        updateWorst("RISK");
        combinedEvidence.push(`${chainStr} (shortener resolved to unofficial domain)`);
        if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.punycode_unknown" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld") ruleId = "link.shortener_unofficial";
      } else {
        updateWorst("UNCLEAR");
        combinedEvidence.push(`${chainStr} (unofficial domain)`);
        if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.punycode_unknown" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld" && ruleId !== "link.shortener_unofficial") ruleId = "link.unofficial";
      }
    } else {
      updateWorst("UNCLEAR");
      combinedEvidence.push(`${chainStr} (company unknown, cannot verify if domain is official)`);
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.punycode_unknown" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld" && ruleId !== "link.shortener_unofficial") ruleId = "link.unknown_company";
    }

    // RDAP Domain Age (only if not official)
    if (regDom && !isOff && !FORM_CHAT_HOSTS.some(h => finalHost === h || finalHost.endsWith("." + h))) {
      const ageRes = await getDomainAge(regDom, resolveUrlOverride);
      if (ageRes.error) {
        limitations = "Could not verify domain age: " + ageRes.error;
      } else if (ageRes.ageDays !== undefined) {
        if (ageRes.ageDays < 90) {
          updateWorst("RISK");
          combinedEvidence.push(`${chainStr} (registered ${Math.floor(ageRes.ageDays)} days ago)`);
          if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.punycode_unknown" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld" && ruleId !== "link.shortener_unofficial") ruleId = "link.new_domain";
        } else if (ageRes.ageDays < 365) {
          updateWorst("UNCLEAR");
          combinedEvidence.push(`${chainStr} (registered ${Math.floor(ageRes.ageDays)} days ago)`);
          if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.punycode_unknown" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld" && ruleId !== "link.shortener_unofficial" && ruleId !== "link.new_domain") ruleId = "link.recent_domain";
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
