import { Agent, request } from "undici";
import dns from "dns";
import net from "net";

const lookupAsync = dns.promises.lookup;

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

function isPrivateIp(ip: string, family: number): boolean {
  if (family === 6) {
    if (ip === "::1" || ip === "::") return true;
    const lower = ip.toLowerCase();
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // fe80::/10
    if (lower.startsWith("::ffff:")) {
      return isPrivateIp(lower.substring(7), 4);
    }
    return false; // Assuming other IPv6 are public for this simplified check
  }

  if (family === 4) {
    if (!net.isIPv4(ip)) return true;
    const num = parseIpv4(ip);
    
    // 0.0.0.0/8
    if (((num & 0xff000000) >>> 0) === 0x00000000) return true;
    // 10.0.0.0/8
    if (((num & 0xff000000) >>> 0) === 0x0a000000) return true;
    // 100.64.0.0/10
    if (((num & 0xffc00000) >>> 0) === 0x64400000) return true;
    // 127.0.0.0/8
    if (((num & 0xff000000) >>> 0) === 0x7f000000) return true;
    // 169.254.0.0/16
    if (((num & 0xffff0000) >>> 0) === 0xa9fe0000) return true;
    // 172.16.0.0/12
    if (((num & 0xfff00000) >>> 0) === 0xac100000) return true;
    // 192.0.0.0/24
    if (((num & 0xffffff00) >>> 0) === 0xc0000000) return true;
    // 192.168.0.0/16
    if (((num & 0xffff0000) >>> 0) === 0xc0a80000) return true;
    // 198.18.0.0/15
    if (((num & 0xfffe0000) >>> 0) === 0xc6120000) return true;
    // 224.0.0.0/4 (multicast)
    if (((num & 0xf0000000) >>> 0) === 0xe0000000) return true;
    // 240.0.0.0/4 (reserved)
    if (((num & 0xf0000000) >>> 0) === 0xf0000000) return true;
    
    return false;
  }
  
  return true;
}

export interface SafeResolverOptions {
  allowedPorts: number[];
  dnsLookup: (hostname: string, options: any) => Promise<any>;
  allowPrivateForTests?: boolean;
}

const defaultOptions: SafeResolverOptions = {
  allowedPorts: [80, 443],
  dnsLookup: dns.promises.lookup
};

export function createSafeResolver(config: SafeResolverOptions) {
  return async function safeResolve(urlStr: string, opts?: any): Promise<SafeFetchResult> {
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
        } catch (e) {
          return { finalUrl: currentUrlStr, chain, error: "invalid_url" };
        }

        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          return { finalUrl: currentUrlStr, chain, blocked: { reason: "unsupported_protocol", url: currentUrlStr } };
        }
        if (parsedUrl.username || parsedUrl.password) {
          return { finalUrl: currentUrlStr, chain, blocked: { reason: "credentials_in_url", url: currentUrlStr } };
        }
        
        let portNum = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === "https:" ? 443 : 80);
        if (!config.allowedPorts.includes(portNum)) {
          return { finalUrl: currentUrlStr, chain, blocked: { reason: "blocked_port", url: currentUrlStr } };
        }
        
        const host = parsedUrl.hostname;
        
        const matchMatch = currentUrlStr.match(/^https?:\/\/(?:[^@\/]+@)?(\[[^\]]+\]|[^:\/]+)/i);
        const matchHost = matchMatch ? matchMatch[1] : host;
        // Prevent non-canonical IP literals
        if (/^0x/i.test(matchHost) || /^0\d/.test(matchHost) || /^\d+$/.test(matchHost) || (matchHost.match(/\./g) && matchHost.match(/\./g)!.length < 3 && net.isIPv4(host))) {
          return { finalUrl: currentUrlStr, chain, blocked: { reason: "non_canonical_ip", url: currentUrlStr } };
        }

        const matchHostStr = matchHost.replace(/\[|\]/g, "");
        if (net.isIP(matchHostStr)) {
          if (!config.allowPrivateForTests && isPrivateIp(matchHostStr, net.isIPv4(matchHostStr) ? 4 : 6)) {
            return { finalUrl: currentUrlStr, chain, blocked: { reason: "private_ip", url: currentUrlStr } };
          }
        }

        let validationError: string | undefined;
        let validationBlockedReason: string | undefined;
        let lookupCalled = 0;

        const agent = new Agent({
          connect: {
            lookup: (hostname, options, callback) => {
              lookupCalled++;
              config.dnsLookup(hostname, { all: true }).then((lookupRes: any) => {
                if (lookupRes.length === 0) {
                  validationError = "dns_lookup_failed";
                  return callback(new Error("no_dns"), []);
                }
                for (const res of lookupRes) {
                  if (!config.allowPrivateForTests && isPrivateIp(res.address, res.family)) {
                    validationBlockedReason = "private_ip";
                    return callback(new Error("private_ip"), []);
                  }
                }
                callback(null, [{ address: lookupRes[0].address, family: lookupRes[0].family }]);
              }).catch(() => {
                validationError = "dns_lookup_failed";
                callback(new Error("dns_lookup_failed"), []);
              });
            }
          }
        });

        const hopAc = new AbortController();
        const hopTimeout = setTimeout(() => hopAc.abort(), 5000);
        
        const onOverallAbort = () => hopAc.abort();
        overallAc.signal.addEventListener("abort", onOverallAbort);

        let response: any;
        try {
          response = await request(parsedUrl, {
            method: "HEAD",
            dispatcher: agent,
            signal: hopAc.signal,
            headers: {
              "User-Agent": "ProofHireBot/1.0 (+contact-url)"
            }
          });
        } catch (e: any) {
          clearTimeout(hopTimeout);
          overallAc.signal.removeEventListener("abort", onOverallAbort);
          if (validationBlockedReason) {
            return { finalUrl: currentUrlStr, chain, blocked: { reason: validationBlockedReason, url: currentUrlStr } };
          }
          if (validationError) {
            return { finalUrl: currentUrlStr, chain, error: validationError };
          }
          return { finalUrl: currentUrlStr, chain, error: e.name === "AbortError" ? "timeout" : "network_error" };
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
            const chunks = [];
            for await (const chunk of response.body) {
              bytesRead += chunk.length;
              if (opts?.readBody) {
                chunks.push(chunk);
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
          } catch (e: any) {
             clearTimeout(hopTimeout);
             overallAc.signal.removeEventListener("abort", onOverallAbort);
             return { finalUrl: currentUrlStr, chain, error: e.name === "AbortError" ? "timeout" : "network_error" };
          }
        } else {
          response.body.dump();
        }
        
        clearTimeout(hopTimeout);
        overallAc.signal.removeEventListener("abort", onOverallAbort);

        chain.push({ url: currentUrlStr, status: response.statusCode });

        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let loc = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
          currentUrlStr = new URL(loc, currentUrlStr).toString();
        } else {
          clearTimeout(overallTimeout);
          return { finalUrl: currentUrlStr, chain, text: bodyText };
        }
      }
      
      clearTimeout(overallTimeout);
      return { finalUrl: currentUrlStr, chain, error: "too_many_redirects", text: bodyText };
      
    } catch (e: any) {
      clearTimeout(overallTimeout);
      return { finalUrl: currentUrlStr, chain, error: "unexpected_error", text: bodyText };
    }
  };
}

export const safeResolve = createSafeResolver(defaultOptions);
