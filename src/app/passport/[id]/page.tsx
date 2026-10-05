import React from "react";
import { notFound } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { Header } from "../../../components/Header";
import { Footer } from "../../../components/Footer";
import { OverallVerdict } from "../../../components/OverallVerdict";
import { EvidencePassport } from "../../../components/EvidencePassport";
import { AnalyzerPanel } from "../../../components/AnalyzerPanel";
import { ReportScam } from "../../../components/ReportScam";

const db = new PrismaClient();

export default async function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const scan = await db.scan.findUnique({
    where: { id },
    include: { claims: true }
  });

  if (!scan) {
    notFound();
  }

  const hasIndicators = scan.indicatorHashes && scan.indicatorHashes !== "[]";

  return (
    <>
      <div className="fixed inset-0 bg-black/60 pointer-events-none z-0" aria-hidden="true" />
      <div className="flex-1 flex flex-col min-h-screen relative z-10">
        <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-heading uppercase text-[var(--text)] mb-2">Analysis Results</h1>
          <div className="text-sm font-mono text-[var(--muted)] flex items-center gap-4">
            <span>ID: {scan.id}</span>
            <span>Analyzed: {scan.createdAt.toLocaleString()}</span>
          </div>
        </div>

        <OverallVerdict verdict={scan.verdict} why={scan.why} />
        
        <AnalyzerPanel text={scan.redactedTranscript || undefined} />

        <EvidencePassport claims={scan.claims} />

        {hasIndicators && (
          <div className="mt-12">
            <ReportScam passportId={scan.id} />
          </div>
        )}
      </main>
      <Footer />
      </div>
    </>
  );
}
