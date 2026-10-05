import { InMemoryRateLimiter } from "../../../lib/rate-limit";
import { PrismaClient } from "@prisma/client";
import { handleAnalyzeRequest } from "./handler";

export const runtime = "nodejs";

const defaultLimiter = new InMemoryRateLimiter();
const defaultDb = new PrismaClient();

export async function POST(req: Request) {
  const { analyzePost } = await import("../../../lib/analyze");
  const { safeResolve } = await import("../../../lib/safe-fetch");
  const { getSearchProvider, getPageProvider } = await import("../../../lib/providers/index");
  
  const boundAnalyze = async (text: string, imageUrl?: string) => {
    return analyzePost(text, imageUrl, {
      searchProvider: getSearchProvider(),
      pageProvider: getPageProvider(safeResolve),
      resolveUrl: safeResolve
    });
  };

  return handleAnalyzeRequest(req, {
    rateLimiter: defaultLimiter,
    db: defaultDb,
    analyzePost: boundAnalyze,
    safeResolve
  });
}
