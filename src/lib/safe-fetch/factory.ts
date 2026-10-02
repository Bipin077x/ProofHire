import { Agent, request, Dispatcher } from "undici";
import dns from "dns";
import net from "net";

export interface SafeFetchResult {
  finalUrl: string;
  chain: { url: string; status: number }[];
  blocked?: { reason: string; url: string };
  error?: string;
  text?: string;
}

function parseIpv4(ip: string): number {
  const parts = ip.split(".");
  return (
    (parseInt(parts[0], 10) << 24) |
    (parseInt(parts[1], 10) << 16) |
    (parseInt(parts[2], 10) << 8) |
    parseInt(parts[3], 10)
  ) >>> 0;
}

export function isPrivateIp(ip: string, family: number): boolean {
  if (family === 6) {
    if (ip === "::1" || ip === "::") return true;
    const lower = ip.toLowerCase();
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    if (lower.startsWith("::ffff:")) {
      return isPrivateIp(lower.substring(7), 4);
    }
    return false;
  }

  if (family === 4) {
    if (!net.isIPv4(ip)) return true;
    const num = parseIpv4(ip);
    
    if (((num & 0xff000000) >>> 0) === 0x00000000) return true;
    if (((num & 0xff000000) >>> 0) === 0x0a000000) return true;
    if (((num & 0xffc00000) >>> 0) === 0x64400000) return true;
    if (((num & 0xff000000) >>> 0) === 0x7f000000) return true;
    if (((num & 0xffff0000) >>> 0) === 0xa9fe0000) return true;
    if (((num & 0xfff00000) >>> 0) === 0xac100000) return true;
    if (((num & 0xffffff00) >>> 0) === 0xc0000000) return true;
    if (((num & 0xffff0000) >>> 0) === 0xc0a80000) return true;
    if (((num & 0xfffe0000) >>> 0) === 0xc6120000) return true;
    if (((num & 0xf0000000) >>> 0) === 0xe0000000) return true;
    if (((num & 0xf0000000) >>> 0) === 0xf0000000) return true;
    
    return false;
  }
  
  return true;
}

export interface SafeResolverOptions {
  allowedPorts: number[];
  dnsLookup: (hostname: string, options: dns.LookupOptions) => Promise<dns.LookupAddress[]>;
  validateAddress?: (ip: string, family: number) => boolean;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

interface RequestOpts {
  method?: string;
  headers?: Record<string, string>;
  readBody?: boolean;
}

export function createSafeResolver(config: SafeResolverOptions) {
  const isValidAddress = config.validateAddress || ((ip, family) => !isPrivateIp(ip, family));

  return async function safeResolve(urlStr: string, opts?: RequestOpts): Promise<SafeFetchResult> {
    const chain: { url: string; status: number }[] = [];
    let currentUrlStr = urlStr;
    let bodyText: string | undefined;
    
    const overallAc = new AbortController();
    const overallTimeout = setTimeout(() => overallAc.abort(), 12000);

    try {
      for (let hop = 0; hop < 5; hop++) {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(currentUrlStr);
        } catch {
          clearTimeout(overallTimeout);
          return { finalUrl: currentUrlStr, chain, error: "invalid_url" };
        }

        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          clearTimeout(overallTimeout);
          return { finalUrl: currentUrlStr, chain, blocked: { reason: "unsupported_protocol", url: currentUrlStr } };
        }
        if (parsedUrl.username || parsedUrl.password) {
          clearTimeout(overallTimeout);
          return { finalUrl: currentUrlStr, chain, blocked: { reason: "credentials_in_url", url: currentUrlStr } };
        }
        
        const portNum = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === "https:" ? 443 : 80);
        if (!config.allowedPorts.includes(portNum)) {
          clearTimeout(overallTimeout);
          return { finalUrl: currentUrlStr, chain, blocked: { reason: "blocked_port", url: currentUrlStr } };
        }
        
        let host = parsedUrl.hostname;
        
        let rawHost = host;
        let isBracketed = false;
        const rawHostMatch = currentUrlStr.match(/^https?:\/\/(?:[^@\/]+@)?(\[[^\]]+\]|[^:\/]+)/i);
        if (rawHostMatch) {
          const matched = rawHostMatch[1];
          if (matched.startsWith('[') && matched.endsWith(']')) {
            isBracketed = true;
            rawHost = matched.slice(1, -1);
          } else {
            rawHost = matched;
          }
        }
        
        if (!isBracketed) {
          const isDigitsAndDots = /^[0-9.]+$/.test(rawHost);
          if (
            /^0x/i.test(rawHost) || 
            /^\d+$/.test(rawHost) || 
            (isDigitsAndDots && /^0\d/.test(rawHost)) || 
            (isDigitsAndDots && rawHost.match(/\./g) && rawHost.match(/\./g)!.length < 3 && net.isIPv4(host))
          ) {
            clearTimeout(overallTimeout);
            return { finalUrl: currentUrlStr, chain, blocked: { reason: "non_canonical_ip", url: currentUrlStr } };
          }
        }

        if (host.startsWith("[") && host.endsWith("]")) {
          host = host.slice(1, -1);
        }

        if (net.isIP(host)) {
          // Normalize IPv4-mapped IPv6
          let checkIp = host;
          let checkFamily = net.isIPv4(host) ? 4 : 6;
          if (checkFamily === 6 && checkIp.toLowerCase().startsWith("::ffff:")) {
             const v4Part = checkIp.substring(7);
             if (net.isIPv4(v4Part)) {
                 checkIp = v4Part;
                 checkFamily = 4;
             }
          }
          if (!isValidAddress(checkIp, checkFamily)) {
            clearTimeout(overallTimeout);
            return { finalUrl: currentUrlStr, chain, blocked: { reason: "private_ip", url: currentUrlStr } };
          }
        }

        const state: { lookups: number; blockedReason?: string; error?: string } = { lookups: 0 };

        const agent = new Agent({
          connect: {
            lookup: (hostname: string, _options: dns.LookupOptions, callback: LookupCallback) => {
              state.lookups++;
              config.dnsLookup(hostname, { all: true }).then((lookupRes: dns.LookupAddress[]) => {
                if (lookupRes.length === 0) {
                  state.error = "dns_lookup_failed";
                  return callback(new Error("no_dns"), "");
                }
                
                let validAddress: dns.LookupAddress | undefined = undefined;
                
                for (const res of lookupRes) {
                  let addr = res.address;
                  let fam = res.family;
                  if (fam === 6 && addr.toLowerCase().startsWith("::ffff:")) {
                    const v4Part = addr.substring(7);
                    if (net.isIPv4(v4Part)) {
                        addr = v4Part;
                        fam = 4;
                    }
                  }
                  
                  if (!isValidAddress(addr, fam)) {
                    state.blockedReason = "private_ip";
                    return callback(new Error("private_ip"), "");
                  }
                  
                  if (!validAddress) {
                    validAddress = { address: addr, family: fam };
                  }
                }
                
                callback(null, [validAddress!]);
              }).catch(() => {
                state.error = "dns_lookup_failed";
                callback(new Error("dns_lookup_failed"), "");
              });
            }
          }
        });

        const hopAc = new AbortController();
        const hopTimeout = setTimeout(() => hopAc.abort(), 5000);
        
        const onOverallAbort = () => hopAc.abort();
        overallAc.signal.addEventListener("abort", onOverallAbort);

        let response: Dispatcher.ResponseData;
        try {
          response = await request(parsedUrl, {
            method: "HEAD",
            dispatcher: agent,
            signal: hopAc.signal,
            headers: {
              "User-Agent": "ProofHireBot/1.0 (+contact-url)"
            }
          });
        } catch (e: unknown) {
          clearTimeout(hopTimeout);
          overallAc.signal.removeEventListener("abort", onOverallAbort);
          if (state.blockedReason) {
            return { finalUrl: currentUrlStr, chain, blocked: { reason: state.blockedReason, url: currentUrlStr } };
          }
          if (state.error) {
            return { finalUrl: currentUrlStr, chain, error: state.error };
          }
          const err = e as { name?: string };
          return { finalUrl: currentUrlStr, chain, error: err.name === "AbortError" ? "timeout" : "network_error" };
        }

        if (response.statusCode === 405 || response.statusCode === 501 || (response.statusCode >= 300 && response.statusCode < 400 && !response.headers.location)) {
          try {
            response = await request(parsedUrl, {
              method: opts?.method || "GET",
              dispatcher: agent,
              signal: hopAc.signal,
              headers: {
                "User-Agent": "ProofHireBot/1.0 (+contact-url)",
                ...(opts?.headers || {})
              }
            });
            let bytesRead = 0;
            const chunks: Buffer[] = [];
            for await (const chunk of response.body) {
              const buf = chunk as Buffer;
              bytesRead += buf.length;
              if (opts?.readBody) {
                chunks.push(buf);
                if (bytesRead > 1048576) {
                   response.body.destroy();
                   break;
                }
              } else {
                if (bytesRead > 65536) {
                  response.body.destroy();
                  break;
                }
              }
            }
            if (opts?.readBody && chunks.length > 0) {
              bodyText = Buffer.concat(chunks).toString("utf-8");
            }
          } catch (e: unknown) {
             clearTimeout(hopTimeout);
             overallAc.signal.removeEventListener("abort", onOverallAbort);
             const err = e as { name?: string };
             return { finalUrl: currentUrlStr, chain, error: err.name === "AbortError" ? "timeout" : "network_error" };
          }
        } else {
          response.body.dump();
        }
        
        clearTimeout(hopTimeout);
        overallAc.signal.removeEventListener("abort", onOverallAbort);

        chain.push({ url: currentUrlStr, status: response.statusCode });

        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const loc = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
          currentUrlStr = new URL(loc as string, currentUrlStr).toString();
        } else {
          clearTimeout(overallTimeout);
          return { finalUrl: currentUrlStr, chain, text: bodyText };
        }
      }
      
      clearTimeout(overallTimeout);
      return { finalUrl: currentUrlStr, chain, error: "too_many_redirects", text: bodyText };
      
    } catch {
      clearTimeout(overallTimeout);
      return { finalUrl: currentUrlStr, chain, error: "unexpected_error", text: bodyText };
    }
  };
}
