import React from "react";
import { CheckCircle2, Search, Target } from "lucide-react";

export function EvidenceTimeline({ claimKey, status, evidence, sourceCount }: { claimKey: string; status: string; evidence: string; sourceCount: number }) {
  const steps = [
    { title: `Extracted ${claimKey} claim`, icon: Target, desc: "Identified in provided text or URL" },
    { title: "Verification Check", icon: Search, desc: sourceCount > 0 ? `Consulted ${sourceCount} external source(s)` : "Analyzed against internal rules" },
    { title: "Result", icon: CheckCircle2, desc: evidence, highlight: true }
  ];

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[var(--border)] before:to-transparent">
      {steps.map((step, i) => (
        <div key={i} className="relative flex items-start gap-4">
          <div className="absolute left-[-24px] bg-[var(--bg)] p-1 rounded-full border border-[var(--border)] text-[var(--hud-primary)]">
            <step.icon className="w-3 h-3" />
          </div>
          <div>
            <h4 className={`text-sm font-heading uppercase ${step.highlight ? 'text-[var(--gold-accent)]' : 'text-[var(--hud-primary)]'}`}>{step.title}</h4>
            <p className="text-xs font-mono text-[var(--muted)] mt-1">{step.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
