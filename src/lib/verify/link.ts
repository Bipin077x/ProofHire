import { VerifyResult } from "./types";
import { safeResolve } from "../safe-fetch";
import { isLookalike, isOfficial, registrableDomain } from "./domain";
import { resolveCompany, KNOWN_COMPANIES } from "./data/companies";

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
    return { claim: "link", status: "UNCLEAR", evidence: "No link provided.", ruleId: "link.missing", sources: [] };
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

    // OFFLINE HOSTNAME ANALYSIS
    let isPunycode = initialHost.includes("xn--");
    let isLook = false;
    let lookalikeCompany = companyData?.name;
    
    if (companyData && companyData.officialDomains) {
      isLook = isLookalike(initialHost, companyData.officialDomains);
    } else if (!companyData) {
      for (const key of Object.keys(KNOWN_COMPANIES)) {
        const comp = KNOWN_COMPANIES[key];
        if (isLookalike(initialHost, comp.officialDomains)) {
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

    if (isPunycode) {
      if (lookalikeCompany) { // implies it's claiming a known company or inferred one
        updateWorst("RISK");
        combinedEvidence.push(`${initialHost} (punycode domain targeting known brand)`);
        ruleId = "link.punycode";
      } else {
        updateWorst("UNCLEAR");
        combinedEvidence.push(`${initialHost} (punycode domain, check carefully)`);
        if (worstStatus !== "RISK") ruleId = "link.punycode";
      }
      continue;
    }

    // RESOLVE URL
    const fetchRes = await safeResolve(urlStr as string);
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
      combinedEvidence.push(`${chainStr} (blocked: link points to an internal/unsafe address)`);
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode") ruleId = "link.blocked_unsafe";
      continue;
    }

    if (fetchRes.error) {
      updateWorst("UNCLEAR");
      combinedEvidence.push(`${chainStr} (destination hidden; could not be resolved)`);
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.blocked_unsafe") ruleId = "link.unresolved";
      continue;
    }

    const regDom = registrableDomain(finalHost);
    
    if (SUSPICIOUS_TLDS.some(tld => finalHost.endsWith(tld))) {
      updateWorst("RISK");
      combinedEvidence.push(`${chainStr} (uses suspicious TLD)`);
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.blocked_unsafe") ruleId = "link.suspicious_tld";
    }

    if (FORM_CHAT_HOSTS.some(h => finalHost === h || finalHost.endsWith("." + h))) {
      updateWorst("UNCLEAR");
      combinedEvidence.push(`${chainStr} (external form/chat host; not the company's own site)`);
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld") ruleId = "link.form_chat_host";
      continue;
    }

    let isOff = false;

    if (companyData && companyData.officialDomains) {
      isOff = isOfficial(finalHost, companyData.officialDomains);
      
      if (isOff) {
        // VERIFIED for this URL
        combinedEvidence.push(`${chainStr} (official domain)`);
        combinedSources.push({ url: finalUrlStr, label: finalHost });
      } else if (fetchRes.chain.length > 1 && SHORTENERS.some(s => initialHost === s || initialHost.endsWith("." + s))) {
        updateWorst("RISK");
        combinedEvidence.push(`${chainStr} (shortener resolved to unofficial domain)`);
        if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld") ruleId = "link.shortener_unofficial";
      } else {
        updateWorst("UNCLEAR");
        combinedEvidence.push(`${chainStr} (unofficial domain)`);
        if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld" && ruleId !== "link.shortener_unofficial") ruleId = "link.unofficial";
      }
    } else {
      updateWorst("UNCLEAR");
      combinedEvidence.push(`${chainStr} (company unknown, cannot verify if domain is official)`);
      if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld" && ruleId !== "link.shortener_unofficial") ruleId = "link.unknown_company";
    }

    // RDAP Domain Age (only if not official)
    if (regDom && !isOff && !FORM_CHAT_HOSTS.some(h => finalHost === h || finalHost.endsWith("." + h))) {
      const ageRes = await getDomainAge(regDom);
      if (ageRes.error) {
        limitations = "Could not verify domain age: " + ageRes.error;
      } else if (ageRes.ageDays !== undefined) {
        if (ageRes.ageDays < 90) {
          updateWorst("RISK");
          combinedEvidence.push(`${chainStr} (registered ${Math.floor(ageRes.ageDays)} days ago)`);
          if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld" && ruleId !== "link.shortener_unofficial") ruleId = "link.new_domain";
        } else if (ageRes.ageDays < 365) {
          updateWorst("UNCLEAR");
          combinedEvidence.push(`${chainStr} (registered ${Math.floor(ageRes.ageDays)} days ago)`);
          if (ruleId !== "link.lookalike" && ruleId !== "link.punycode" && ruleId !== "link.blocked_unsafe" && ruleId !== "link.suspicious_tld" && ruleId !== "link.shortener_unofficial" && ruleId !== "link.new_domain") ruleId = "link.recent_domain";
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
