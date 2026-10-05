import net from "net";
import dns from "dns/promises";
import type { VerificationDeps } from "../verify";
import { SafeFetchResult } from "../safe-fetch";

let installed = false;

export function installOfflineMocks(viContext?: typeof import("vitest").vi) {
  if (installed) return;
  installed = true;

  if (viContext) {
    viContext.spyOn(net.Socket.prototype, "connect").mockImplementation(() => {
      throw new Error("REAL SOCKET CALL BLOCKED");
    });
    viContext.spyOn(dns, "lookup").mockImplementation(() => {
      throw new Error("REAL DNS CALL BLOCKED");
    });
  } else {
    net.Socket.prototype.connect = () => {
      throw new Error("Offline mode - real socket blocked");
    };
    // @ts-ignore
    dns.lookup = async () => {
      throw new Error("Offline mode - real dns blocked");
    };
  }
}

export function createFakeResolve() {
  return async function fakeResolve(urlStr: string): Promise<SafeFetchResult> {
    if (urlStr.includes("rdap.org")) {
      return {
        finalUrl: urlStr,
        chain: [{ url: urlStr, status: 200 }],
        text: JSON.stringify({
          events: [{ eventAction: "registration", eventDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() }]
        })
      };
    }

    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();

    // Private/IP literal never connected
    if (host === "127.0.0.1" || host === "0177.0.0.1" || host.match(/^[0-9.]+$/)) {
      return {
        finalUrl: urlStr,
        chain: [{ url: urlStr, status: 200 }],
        blocked: { reason: "non_canonical_ip", url: urlStr }
      };
    }

    if (host === "bit.ly" || host === "rb.gy" || host === "short.link" || host === "xn--ggle-0nda.com" || host === "microsoft-hiring.co") {
      return {
        finalUrl: urlStr,
        error: "unresolved",
        chain: [{ url: urlStr, status: 200 }]
      };
    }

    return {
      finalUrl: urlStr,
      chain: [{ url: urlStr, status: 200 }],
      text: "ok"
    };
  };
}

export const offlineDeps: VerificationDeps = {
  searchProvider: {
    async search() { return { ok: true, results: [] }; }
  }
};
