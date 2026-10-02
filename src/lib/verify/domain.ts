export function getHostFromEmailOrUrl(input: string): string | null {
  try {
    if (input.includes("@")) {
      return input.split("@")[1].toLowerCase();
    }
    const url = input.startsWith("http") ? input : `http://${input}`;
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().split(".");
  if (parts.length <= 1) return host;
  
  // Handling two-level TLDs like co.in, org.in, ac.in
  const twoLevelTlds = ["co.in", "org.in", "ac.in", "gov.in", "net.in", "co.uk", "org.uk", "com.au"];
  const lastTwo = parts.slice(-2).join(".");
  
  if (twoLevelTlds.includes(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join(".");
  }
  
  return parts.slice(-2).join(".");
}

export function isOfficial(host: string, officialDomains: string[]): boolean {
  const lowerHost = host.toLowerCase();
  return officialDomains.some((domain) => {
    return lowerHost === domain || lowerHost.endsWith("." + domain);
  });
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

export function isLookalike(host: string, officialDomains: string[]): boolean {
  if (isOfficial(host, officialDomains)) return false;
  
  const regHost = registrableDomain(host);
  const hostName = regHost.split(".")[0]; // e.g. google from google.com
  
  // Detect IDN homographs
  if (host.includes("xn--")) return true;
  
  for (const official of officialDomains) {
    const regOff = registrableDomain(official);
    const offName = regOff.split(".")[0];
    
    // Exact match in name but different TLD (e.g. google.in instead of google.com)
    // Sometimes companies own them, but if it's not in officialDomains, it might be a lookalike
    // We'll consider it a lookalike if the edit distance is <= 2
    
    if (hostName === offName) return true;
    if (hostName.includes(offName + "-") || hostName.includes("-" + offName)) return true;
    
    // Subdomain check (e.g. google.com.evil.in or google.evil.in)
    if (host.includes(offName + ".") || host.includes("." + offName)) return true;
    
    // Digit substitutions or small typos (edit distance <= 2)
    // Only apply if the name is reasonably long
    if (offName.length > 4) {
      if (levenshtein(hostName, offName) <= 2) return true;
      
      // Also check parts split by hyphens (e.g. g00gle-careers -> g00gle and careers)
      const parts = hostName.split("-");
      for (const part of parts) {
        if (levenshtein(part, offName) <= 2) return true;
      }
    }
  }
  return false;
}
