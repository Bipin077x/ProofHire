import React from "react";
import { notFound } from "next/navigation";
import { demoData } from "../data";
import { Header } from "../../../components/Header";
import { Footer } from "../../../components/Footer";
import { OverallVerdict } from "../../../components/OverallVerdict";
import { EvidencePassport } from "../../../components/EvidencePassport";
import { AnalyzerPanel } from "../../../components/AnalyzerPanel";

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = demoData[slug];
  
  if (!data) {
    notFound();
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-heading uppercase text-[var(--text)] mb-2">Analysis Results</h1>
          <div className="text-sm font-mono text-[var(--muted)] flex items-center gap-4">
            <span>ID: {data.id}</span>
            <span>Analyzed: {data.createdAt.toLocaleString()}</span>
            <span className="bg-[var(--border)] text-[var(--text)] px-2 py-0.5 rounded text-xs">DEMO MODE</span>
          </div>
        </div>

        <OverallVerdict verdict={data.verdict} why={data.why} />
        
        <AnalyzerPanel text={data.redactedTranscript || undefined} />

        <EvidencePassport claims={data.claims} />
      </main>
      <Footer />
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(demoData).map(slug => ({ slug }));
}
