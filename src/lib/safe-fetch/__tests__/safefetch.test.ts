import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { safeResolve } from "../index";
import dns from "dns";
import * as undici from "undici";

vi.mock("undici", () => {
  return {
    Agent: vi.fn(),
    request: vi.fn()
  };
});

describe("safeFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks invalid protocols", async () => {
    const res1 = await safeResolve("ftp://example.com");
    expect(res1.blocked?.reason).toBe("unsupported_protocol");
    
    const res2 = await safeResolve("file:///etc/passwd");
    expect(res2.blocked?.reason).toBe("unsupported_protocol");
  });

  it("blocks credentials in URL", async () => {
    const res = await safeResolve("http://user:pass@example.com");
    expect(res.blocked?.reason).toBe("credentials_in_url");
  });

  it("blocks non-standard ports (mocking env)", async () => {
    const old = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = "production";
    const res = await safeResolve("http://example.com:8080");
    expect(res.blocked?.reason).toBe("blocked_port");
    // @ts-ignore
    process.env.NODE_ENV = old;
  });

  it("blocks non-canonical IPs", async () => {
    const cases = [
      "http://2130706433",
      "http://0x7f000001",
      "http://0177.0.0.1",
      "http://127.1"
    ];
    for (const c of cases) {
      const res = await safeResolve(c);
      expect(res.blocked?.reason).toBe("non_canonical_ip");
    }
  });

  describe("DNS and IP checks", () => {
    beforeAll(() => {
      // @ts-ignore
      vi.spyOn(dns.promises, "lookup").mockImplementation(async (host: string, options: any) => {
        if (host === "localhost") return [{ address: "127.0.0.1", family: 4 }] as any;
        if (host === "private.com") return [{ address: "10.0.0.5", family: 4 }] as any;
        if (host === "public.com") return [{ address: "93.184.216.34", family: 4 }] as any;
        if (host === "rebinder.com") {
          // Rebinding simulation: first lookup returns public, second returns private.
          // BUT our code should only lookup once per hop.
          return [{ address: "93.184.216.34", family: 4 }, { address: "192.168.1.1", family: 4 }] as any;
        }
        return [{ address: "127.0.0.1", family: 4 }] as any; // default mock
      });
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it("blocks private IPs like loopback directly via hostname", async () => {
      const res1 = await safeResolve("http://127.0.0.1");
      expect(res1.blocked?.reason).toBe("private_ip");

      const res2 = await safeResolve("http://localhost");
      expect(res2.blocked?.reason).toBe("private_ip");
      
      const res3 = await safeResolve("http://[::1]");
      expect(res3.blocked?.reason).toBe("private_ip");
      
      const res4 = await safeResolve("http://169.254.169.254/latest/meta-data");
      expect(res4.blocked?.reason).toBe("private_ip");
    });

    it("blocks public hostname that resolves to private IP", async () => {
      const res = await safeResolve("http://private.com");
      expect(res.blocked?.reason).toBe("private_ip");
    });

    it("rebinding simulation (multiple IPs where one is private) blocks immediately", async () => {
      const res = await safeResolve("http://rebinder.com");
      expect(res.blocked?.reason).toBe("private_ip");
      expect(dns.promises.lookup).toHaveBeenCalled();
    });
  });

  describe("Redirect behaviors", () => {
    it("follows redirects and returns chain", async () => {
      vi.mocked(undici.request)
        .mockResolvedValueOnce({ statusCode: 302, headers: { location: "http://public.com/2" }, body: { dump: vi.fn(), destroy: vi.fn() } } as any)
        .mockResolvedValueOnce({ statusCode: 200, headers: {}, body: { dump: vi.fn(), destroy: vi.fn() } } as any);

      const res = await safeResolve(`http://public.com/1`);
      expect(res.error).toBeUndefined();
      expect(res.blocked).toBeUndefined();
      expect(res.chain.length).toBe(2);
      expect(res.finalUrl).toBe(`http://public.com/2`);
    });

    it("stops on redirect loops (too_many_redirects)", async () => {
      vi.mocked(undici.request).mockResolvedValue({ statusCode: 302, headers: { location: "http://public.com/loop" }, body: { dump: vi.fn(), destroy: vi.fn() } } as any);
      
      const res = await safeResolve(`http://public.com/loop`);
      expect(res.error).toBe("too_many_redirects");
      expect(res.chain.length).toBe(5);
    });

    it("blocks public URL redirecting to private IP at hop 2", async () => {
      vi.mocked(undici.request).mockResolvedValueOnce({ statusCode: 302, headers: { location: "http://127.0.0.1/" }, body: { dump: vi.fn(), destroy: vi.fn() } } as any);
      
      const res = await safeResolve(`http://public.com/to-private`);
      expect(res.blocked?.reason).toBe("private_ip");
      expect(res.chain.length).toBe(1);
    });
  });
});
