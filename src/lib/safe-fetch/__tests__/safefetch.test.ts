import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { safeResolve } from "../index";
import { createSafeResolver } from "../factory";
import type { SafeResolverOptions } from "../factory";
import dns from "dns";
import http from "http";
import * as undici from "undici";

vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return {
    ...actual,
    Agent: vi.fn().mockImplementation(function(opts: undici.Agent.Options) {
      return new actual.Agent(opts);
    }),
    request: vi.fn().mockImplementation((url: string | URL, opts?: undici.Dispatcher.RequestOptions) => actual.request(url, opts))
  };
});

describe("safeFetch", () => {
  let server: http.Server;
  let serverPort: number;
  let localResolver: ReturnType<typeof createSafeResolver>;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer((req, res) => {
        if (req.url === "/redirect1") {
          res.writeHead(302, { Location: "/redirect2" });
          res.end();
        } else if (req.url === "/redirect2") {
          res.writeHead(302, { Location: "/final" });
          res.end();
        } else if (req.url === "/final") {
          res.writeHead(200);
          res.end("OK");
        } else if (req.url === "/loop") {
          res.writeHead(302, { Location: "/loop" });
          res.end();
        } else if (req.url === "/to-private") {
          res.writeHead(302, { Location: "http://127.0.0.1/" });
          res.end();
        } else if (req.url === "/to-file") {
          res.writeHead(302, { Location: "file:///etc/passwd" });
          res.end();
        } else if (req.url === "/chain1") {
          res.writeHead(302, { Location: "/chain2" }); res.end();
        } else if (req.url === "/chain2") {
          res.writeHead(302, { Location: "/chain3" }); res.end();
        } else if (req.url === "/chain3") {
          res.writeHead(302, { Location: "/chain4" }); res.end();
        } else if (req.url === "/chain4") {
          res.writeHead(302, { Location: "/chain5" }); res.end();
        } else if (req.url === "/chain5") {
          res.writeHead(302, { Location: "/chain6" }); res.end();
        } else if (req.url === "/chain6") {
          res.writeHead(200); res.end("OK");
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(0, "127.0.0.1", () => {
        serverPort = (server.address() as net.AddressInfo).port;
        const localOpts: SafeResolverOptions = {
          allowedPorts: [80, 443, serverPort],
          dnsLookup: async (host: string) => {
            const h = host.replace(/\[|\]/g, "");
            const netMod = await import("net");
            if (netMod.isIP(h)) return [{ address: h, family: netMod.isIPv4(h) ? 4 : 6 } as dns.LookupAddress];
            if (h === "localhost") return [{ address: "127.0.0.1", family: 4 } as dns.LookupAddress];
            if (h === "private.com") return [{ address: "10.0.0.5", family: 4 } as dns.LookupAddress];
            if (h === "127.0.0.1") return [{ address: "127.0.0.1", family: 4 } as dns.LookupAddress];
            return [{ address: "127.0.0.1", family: 4 } as dns.LookupAddress];
          },
          validateAddress: () => true
        };
        localResolver = createSafeResolver(localOpts);
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(dns.promises, "lookup").mockImplementation((async (host: string) => {
      const h = (host as string).replace(/\[|\]/g, "");
      const netMod = await import("net");
      if (netMod.isIP(h)) return [{ address: h, family: netMod.isIPv4(h) ? 4 : 6 }] as dns.LookupAddress[];
      if (host === "localhost") return [{ address: "127.0.0.1", family: 4 }] as dns.LookupAddress[];
      if (host === "private.com") return [{ address: "10.0.0.5", family: 4 }] as dns.LookupAddress[];
      if (host === "rebinder.com") {
        return [{ address: "93.184.216.34", family: 4 }, { address: "192.168.1.1", family: 4 }] as dns.LookupAddress[];
      }
      if (host === "dns-fail.com") return [] as dns.LookupAddress[];
      if (host === "rebinder-multi-call.com") {
        return [{ address: "93.184.216.34", family: 4 }] as dns.LookupAddress[];
      }
      return [{ address: "93.184.216.34", family: 4 }] as dns.LookupAddress[];
    }) as unknown as typeof dns.promises.lookup);
  });

  it("default safeResolve rejects non-standard ports and private IPs", async () => {
    const res = await safeResolve("http://127.0.0.1:8080");
    expect(res.blocked?.reason).toBe("blocked_port");
    
    const res2 = await safeResolve("http://127.0.0.1");
    expect(res2.blocked?.reason).toBe("private_ip");
  });

  describe("IP Literals & Bad Protocols", () => {
    const cases: Array<{ url: string; reason: string }> = [
      { url: "http://2130706433", reason: "non_canonical_ip" },
      { url: "http://0x7f000001", reason: "non_canonical_ip" },
      { url: "http://0177.0.0.1", reason: "non_canonical_ip" },
      { url: "http://127.1", reason: "non_canonical_ip" },
      { url: "http://[::1]", reason: "private_ip" },
      { url: "http://[::ffff:127.0.0.1]", reason: "private_ip" },
      { url: "http://[::ffff:7f00:1]", reason: "private_ip" },
      { url: "http://[0:0:0:0:0:ffff:127.0.0.1]", reason: "private_ip" },
      { url: "http://[::ffff:127.1]", reason: "invalid_url" },
      { url: "http://[0000:0000:0000:0000:0000:ffff:127.0.0.1]", reason: "private_ip" },
      { url: "http://169.254.169.254/latest/meta-data", reason: "private_ip" },
      { url: "http://user:pass@example.com", reason: "credentials_in_url" },
      { url: "ftp://x", reason: "unsupported_protocol" },
      { url: "file:///etc/passwd", reason: "unsupported_protocol" }
    ];
    
    it.each(cases)("blocks $url with $reason", async ({ url, reason }) => {
      const res = await safeResolve(url);
      expect(res.blocked?.reason || res.error).toBe(reason);
    });

    it("does not block 007.com as non_canonical_ip", async () => {
      vi.mocked(undici.request).mockResolvedValueOnce({ statusCode: 200, headers: {}, body: { dump: vi.fn(), destroy: vi.fn() } } as unknown as undici.Dispatcher.ResponseData);
      const res = await safeResolve("http://007.com");
      expect(res.blocked?.reason).not.toBe("non_canonical_ip");
    });
  });

  describe("DNS Pinning", () => {
    it("lookup called once per hop, uses first IP even if DNS changes later", async () => {
      let callCount = 0;
      const customDnsLookup = async (_host: string): Promise<dns.LookupAddress[]> => {
        callCount++;
        if (callCount === 1) return [{ address: "127.0.0.1", family: 4 } as dns.LookupAddress];
        return [{ address: "192.168.1.1", family: 4 } as dns.LookupAddress];
      };
      const resolver = createSafeResolver({ 
        allowedPorts: [80, 443, serverPort], 
        dnsLookup: customDnsLookup,
        validateAddress: () => true 
      });
      
      const res = await resolver(`http://rebinder-test.com:${serverPort}/final`);
      expect(callCount).toBe(1); 
      expect(res.error).toBeUndefined();
      expect(res.blocked).toBeUndefined();
    });

    it("hostname returning [public, private] together is blocked (ANY private blocks)", async () => {
      const customDnsLookup = async (): Promise<dns.LookupAddress[]> => [
        { address: "93.184.216.34", family: 4 } as dns.LookupAddress,
        { address: "192.168.1.1", family: 4 } as dns.LookupAddress
      ];
      const resolver = createSafeResolver({ allowedPorts: [80, 443], dnsLookup: customDnsLookup });
      
      const res = await resolver(`http://mixed-ips.com/`);
      expect(res.blocked?.reason).toBe("private_ip");
    });

    it("concurrency test: simultaneous resolves maintain independent state", async () => {
      const customDnsLookup = async (host: string): Promise<dns.LookupAddress[]> => {
        if (host === "public.com") return [{ address: "93.184.216.34", family: 4 } as dns.LookupAddress];
        if (host === "private.com") return [{ address: "192.168.1.1", family: 4 } as dns.LookupAddress];
        return [];
      };
      const resolver = createSafeResolver({ allowedPorts: [80, 443], dnsLookup: customDnsLookup });
      
      vi.mocked(undici.request).mockImplementationOnce(async () => {
        return { statusCode: 200, headers: {}, body: { dump: vi.fn(), destroy: vi.fn() } } as unknown as undici.Dispatcher.ResponseData;
      });

      const [resPub, resPriv] = await Promise.all([
        resolver("http://public.com/"),
        resolver("http://private.com/")
      ]);

      expect(resPriv.blocked?.reason).toBe("private_ip");
      expect(resPub.blocked).toBeUndefined();
    });
  });

  describe("Redirect behaviors (Real Server)", () => {
    it("follows relative Location header correctly", async () => {
      const res = await localResolver(`http://127.0.0.1:${serverPort}/redirect1`);
      expect(res.finalUrl).toBe(`http://127.0.0.1:${serverPort}/final`);
      expect(res.chain.length).toBe(3);
    });

    it("stops on redirect loops (too_many_redirects)", async () => {
      const res = await localResolver(`http://127.0.0.1:${serverPort}/loop`);
      expect(res.error).toBe("too_many_redirects");
      expect(res.chain.length).toBe(5);
    });
    
    it("blocks 6-hop chain with too_many_redirects", async () => {
      const res = await localResolver(`http://127.0.0.1:${serverPort}/chain1`);
      expect(res.error).toBe("too_many_redirects");
      expect(res.chain.length).toBe(5);
    });

    it("blocks public URL redirecting to private IP at hop 2", async () => {
      const noPrivateResolver = createSafeResolver({ 
        allowedPorts: [80, 443, serverPort], 
        dnsLookup: async (host: string): Promise<dns.LookupAddress[]> => {
          const h = host.replace(/\[|\]/g, "");
          const netMod = await import("net");
          if (netMod.isIP(h)) return [{ address: h, family: netMod.isIPv4(h) ? 4 : 6 } as dns.LookupAddress];
          return [{ address: "127.0.0.1", family: 4 } as dns.LookupAddress];
        }
      });
      
      // 127.0.0.1 is blocked at hop 1 because validateAddress uses strict check
      const res = await noPrivateResolver(`http://127.0.0.1:${serverPort}/to-private`);
      expect(res.blocked?.reason).toBe("private_ip");
      expect(res.chain.length).toBe(0);
      
      // Mock undici.request for hop 2 test (redirect to private at second hop)
      const resolverMock = createSafeResolver({
        allowedPorts: [80, 443],
        dnsLookup: async (): Promise<dns.LookupAddress[]> => [{ address: "93.184.216.34", family: 4 } as dns.LookupAddress]
      });
      
      vi.mocked(undici.request).mockResolvedValueOnce({ statusCode: 302, headers: { location: "http://127.0.0.1/" }, body: { dump: vi.fn(), destroy: vi.fn() } } as unknown as undici.Dispatcher.ResponseData);
      const res2 = await resolverMock("http://public.com/hop1");
      expect(res2.blocked?.reason).toBe("private_ip");
      expect(res2.chain.length).toBe(1);
    });
    
    it("blocks redirect pointing to different scheme", async () => {
      const res = await localResolver(`http://127.0.0.1:${serverPort}/to-file`);
      expect(res.blocked?.reason).toBe("unsupported_protocol");
      expect(res.chain.length).toBe(1);
    });
  });
});

// needed for server.address() type
import net from "net";
