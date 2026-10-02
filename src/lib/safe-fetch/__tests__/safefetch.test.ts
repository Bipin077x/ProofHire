import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { safeResolve, createSafeResolver } from "../index";
import dns from "dns";
import http from "http";
import * as undici from "undici";

vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return {
    ...actual,
    Agent: vi.fn().mockImplementation(function(opts) {
      return new actual.Agent(opts);
    }),
    request: vi.fn().mockImplementation((url, opts) => actual.request(url, opts))
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
        serverPort = (server.address() as any).port;
        localResolver = createSafeResolver({ 
          allowedPorts: [80, 443, serverPort], 
          dnsLookup: async (host: string, options: any) => {
            const h = host.replace(/\[|\]/g, "");
            import("net").then(net => {
              if (net.isIP(h)) return [{ address: h, family: net.isIPv4(h) ? 4 : 6 }];
            });
            // Simple pass-through or mock
            if (h === "localhost") return [{ address: "127.0.0.1", family: 4 }];
            if (h === "private.com") return [{ address: "10.0.0.5", family: 4 }];
            if (h === "127.0.0.1") return [{ address: "127.0.0.1", family: 4 }];
            return [{ address: "127.0.0.1", family: 4 }];
          }, 
          allowPrivateForTests: true 
        });
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    vi.spyOn(dns.promises, "lookup").mockImplementation(async (host: string, options: any) => {
      const h = host.replace(/\[|\]/g, "");
      const net = await import("net");
      if (net.isIP(h)) return [{ address: h, family: net.isIPv4(h) ? 4 : 6 }] as any;
      if (host === "localhost") return [{ address: "127.0.0.1", family: 4 }] as any;
      if (host === "private.com") return [{ address: "10.0.0.5", family: 4 }] as any;
      if (host === "rebinder.com") {
        return [{ address: "93.184.216.34", family: 4 }, { address: "192.168.1.1", family: 4 }] as any;
      }
      if (host === "dns-fail.com") return [] as any;
      if (host === "rebinder-multi-call.com") {
        return [{ address: "93.184.216.34", family: 4 }] as any;
      }
      return [{ address: "93.184.216.34", family: 4 }] as any;
    });
  });

  it("default safeResolve rejects non-standard ports", async () => {
    const res = await safeResolve("http://127.0.0.1:8080");
    expect(res.blocked?.reason).toBe("blocked_port");
  });

  describe("IP Literals & Bad Protocols", () => {
    const cases = [
      { url: "http://2130706433", reason: "non_canonical_ip" },
      { url: "http://0x7f000001", reason: "non_canonical_ip" },
      { url: "http://0177.0.0.1", reason: "non_canonical_ip" },
      { url: "http://127.1", reason: "non_canonical_ip" },
      { url: "http://[::1]", reason: "private_ip" },
      { url: "http://[::ffff:127.0.0.1]", reason: "private_ip" },
      { url: "http://169.254.169.254/latest/meta-data", reason: "private_ip" },
      { url: "http://user:pass@example.com", reason: "credentials_in_url" },
      { url: "ftp://x", reason: "unsupported_protocol" },
      { url: "file:///etc/passwd", reason: "unsupported_protocol" }
    ];
    
    it("blocks all literal cases correctly", async () => {
      for (const c of cases) {
        const res = await safeResolve(c.url);
        expect(res.blocked?.reason || res.error).toBe(c.reason);
      }
    });
  });

  describe("DNS Pinning", () => {
    it("lookup called once per hop, uses first IP even if DNS changes later", async () => {
      let callCount = 0;
      const customDnsLookup = async (host: string, options: any) => {
        callCount++;
        if (callCount === 1) return [{ address: "127.0.0.1", family: 4 }];
        return [{ address: "192.168.1.1", family: 4 }]; // private IP on call 2
      };
      const resolver = createSafeResolver({ allowedPorts: [80, 443, serverPort], dnsLookup: customDnsLookup as any, allowPrivateForTests: true });
      
      const res = await resolver(`http://rebinder-test.com:${serverPort}/final`);
      expect(callCount).toBe(1); 
      expect(res.error).toBeUndefined();
      expect(res.blocked).toBeUndefined();
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
        dnsLookup: async (host: string, options: any) => {
          const h = host.replace(/\[|\]/g, "");
          const net = await import("net");
          if (net.isIP(h)) return [{ address: h, family: net.isIPv4(h) ? 4 : 6 }];
          return [{ address: "127.0.0.1", family: 4 }];
        }, 
        allowPrivateForTests: false 
      });
      
      // 127.0.0.1 is blocked at hop 1 because allowPrivateForTests is false
      const res = await noPrivateResolver(`http://127.0.0.1:${serverPort}/to-private`);
      expect(res.blocked?.reason).toBe("private_ip");
      expect(res.chain.length).toBe(0);
      
      // We will create a local server resolver where allowPrivateForTests is false.
      // But we need to hit our local server. Our local server runs on 127.0.0.1.
      // If we use allowPrivateForTests: false, we can't reach the local server!
      // So we must mock undici.request just for the hop 2 test to avoid network.
      const resolverMock = createSafeResolver({
        allowedPorts: [80, 443],
        dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }]
      });
      
      vi.mocked(undici.request).mockResolvedValueOnce({ statusCode: 302, headers: { location: "http://127.0.0.1/" }, body: { dump: vi.fn(), destroy: vi.fn() } } as any);
      const res2 = await resolverMock("http://public.com/hop1");
      expect(res2.blocked?.reason).toBe("private_ip");
      expect(res2.chain.length).toBe(1);
    });
    
    it("blocks redirect pointing to different scheme", async () => {
      const res = await localResolver(`http://127.0.0.1:${serverPort}/to-file`);
      expect(res.blocked?.reason).toBe("unsupported_protocol");
      expect(res.chain.length).toBe(1); // the first request succeeds (302), then URL validation of hop 2 fails
    });
  });
});
