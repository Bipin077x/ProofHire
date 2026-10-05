"use client";

import React from "react";
import { Info, CheckCircle2, ShieldCheck, HelpCircle } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { HudPanel } from "../../components/HudPanel";
import { copy } from "../../content/copy";

export default function HowItWorksPage() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-transparent">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <h1 className="text-3xl font-heading uppercase text-[var(--text)] flex items-center gap-2 mb-8">
          <Info className="w-8 h-8 text-[var(--hud-primary)]" /> How It Works
        </h1>

        <HudPanel className="mb-12">
          <h2 className="text-xl font-heading uppercase text-[var(--gold-accent)] mb-6">The Process</h2>
          
          <div className="relative border-l border-[var(--hud-primary)]/30 ml-4 space-y-8 pb-4">
            {copy.howItWorks.steps.map((step, idx) => (
              <div key={idx} className="relative pl-8">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[var(--surface)] border-2 border-[var(--hud-primary)] shadow-[0_0_8px_var(--hud-primary)]" />
                <h3 className="font-heading uppercase text-lg text-[var(--text)]">
                  {idx + 1}. {step.title}
                </h3>
                <p className="font-mono text-sm text-[var(--muted)] mt-1 max-w-2xl">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </HudPanel>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <HudPanel>
            <h2 className="text-xl font-heading uppercase text-[var(--gold-accent)] mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> What Each Check Does
            </h2>
            <ul className="space-y-4">
              {copy.howItWorks.checks.map((check, idx) => (
                <li key={idx}>
                  <h3 className="font-mono text-sm font-bold uppercase text-[var(--text)] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-verified)]" />
                    {check.name}
                  </h3>
                  <p className="font-mono text-xs text-[var(--muted)] mt-1 ml-6">
                    {check.desc}
                  </p>
                </li>
              ))}
            </ul>
          </HudPanel>

          <HudPanel>
            <h2 className="text-xl font-heading uppercase text-[var(--gold-accent)] mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5" /> Limits
            </h2>
            <ul className="space-y-4">
              {copy.howItWorks.limits.map((limit, idx) => (
                <li key={idx} className="flex gap-2 items-start">
                  <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--status-not-verified)] shrink-0" />
                  <p className="font-mono text-sm text-[var(--muted)]">{limit}</p>
                </li>
              ))}
            </ul>
          </HudPanel>
        </div>
      </main>
      <Footer />
    </div>
  );
}
