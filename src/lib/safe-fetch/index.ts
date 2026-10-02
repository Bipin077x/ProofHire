import { createSafeResolver } from "./factory";
import type { SafeResolverOptions, SafeFetchResult } from "./factory";
import dns from "dns";

const defaultDnsLookup = (hostname: string, options: dns.LookupOptions): Promise<dns.LookupAddress[]> =>
  dns.promises.lookup(hostname, options as dns.LookupAllOptions) as Promise<dns.LookupAddress[]>;

const defaultOptions: SafeResolverOptions = {
  allowedPorts: [80, 443],
  dnsLookup: defaultDnsLookup
};

export const safeResolve = createSafeResolver(defaultOptions);
export type { SafeResolverOptions, SafeFetchResult };
