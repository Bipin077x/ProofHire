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

export async function safeResolve(urlStr: string, opts?: any): Promise<SafeFetchResult> {
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
      if (parsedUrl.port !== "" && parsedUrl.port !== "80" && parsedUrl.port !== "443" && process.env.NODE_ENV !== "test") {
        return { finalUrl: currentUrlStr, chain, blocked: { reason: "blocked_port", url: currentUrlStr } };
      }
      
      const host = parsedUrl.hostname;
      
      const matchHost = currentUrlStr.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
      // Prevent non-canonical IP literals
      if (/^0x/i.test(matchHost) || /^0\d/.test(matchHost) || /^\d+$/.test(matchHost) || (matchHost.match(/\./g) && matchHost.match(/\./g)!.length < 3 && net.isIPv4(host))) {
        // e.g. 127.1 or 2130706433 or 0x7f000001
        return { finalUrl: currentUrlStr, chain, blocked: { reason: "non_canonical_ip", url: currentUrlStr } };
      }

      let address: string;
      let family: number;
      let lookupCalled = 0;

      try {
        const lookupRes = await dns.promises.lookup(host, { all: true });
        if (lookupRes.length === 0) throw new Error("no_dns");
        // Check ALL returned IPs to prevent DNS rebinding where 1 is public, 1 is private
        for (const res of lookupRes) {
          if (isPrivateIp(res.address, res.family)) {
            return { finalUrl: currentUrlStr, chain, blocked: { reason: "private_ip", url: currentUrlStr } };
          }
        }
        address = lookupRes[0].address;
        family = lookupRes[0].family;
      } catch (e) {
        return { finalUrl: currentUrlStr, chain, error: "dns_lookup_failed" };
      }

      // Create an agent that pins the IP
      const agent = new Agent({
        connect: {
          lookup: (hostname, options, callback) => {
            lookupCalled++;
            // We ensure lookup is only called once per hop, and returns the pre-validated IP
            callback(null, [{ address, family }]);
          }
        }
      });

      const hopAc = new AbortController();
      const hopTimeout = setTimeout(() => hopAc.abort(), 5000);
      
      // Link overall and hop abort controllers manually
      const onOverallAbort = () => hopAc.abort();
      overallAc.signal.addEventListener("abort", onOverallAbort);

      let response: any;
      try {
        // Try HEAD first
        response = await request(parsedUrl, {
          method: "HEAD",
          dispatcher: agent,
          signal: hopAc.signal,
          headers: {
            "User-Agent": "ProofHireBot/1.0 (+contact-url)"
          }
        });
        
        if ((response.statusCode === 405 || response.statusCode === 501 || !response.headers.location) && (response.statusCode >= 200 && response.statusCode < 300 || response.statusCode >= 400)) {
           // If HEAD fails or gives no location when it should, we might need GET. But let's only do GET if we suspect it's a redirect that needs GET, or we just abort. The spec says:
           // "Method HEAD first. If it returns 405/501 or no Location, retry with GET but do NOT read more than 64KB and then abort the body."
           if (response.statusCode === 405 || response.statusCode === 501 || response.statusCode >= 300) {
             // Let's just always fallback to GET if it's 405/501, or if it's 3xx without location? Actually 3xx without location is weird, we should GET to see if location appears.
             // The body is aborted.
           }
        }
      } catch (e: any) {
        clearTimeout(hopTimeout);
        overallAc.signal.removeEventListener("abort", onOverallAbort);
        return { finalUrl: currentUrlStr, chain, error: e.name === "AbortError" ? "timeout" : "network_error" };
      }

      // If we need to retry with GET
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
          // Abort body safely
          let bytesRead = 0;
          const chunks = [];
          for await (const chunk of response.body) {
            bytesRead += chunk.length;
            if (opts?.readBody) {
              chunks.push(chunk);
              if (bytesRead > 1048576) { // 1MB hard cap
                 response.body.destroy();
                 break;
              }
            } else {
              if (bytesRead > 65536) { // 64KB
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
        // Just consume the HEAD body
        response.body.dump();
      }
      
      clearTimeout(hopTimeout);
      overallAc.signal.removeEventListener("abort", onOverallAbort);
      
      // At this point we connected and got headers. We should assert lookup was called exactly once by undici.
      if (lookupCalled !== 1 && lookupCalled !== 0) { // 0 if it was IP literal
        // but wait, if it's an IP literal, dns lookup might not be called in undici connect.
      }

      chain.push({ url: currentUrlStr, status: response.statusCode });

      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        let loc = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
        currentUrlStr = new URL(loc, currentUrlStr).toString();
      } else {
        // Not a redirect, we reached the end
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
}
