"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { SourceCard } from "./SourceCard";
import { claimLabels } from "../content/claimLabels";
import { explanations } from "../content/explanations";
import { Claim } from "@prisma/client";
import { EvidenceTimeline } from "./EvidenceTimeline";

export function ClaimRow({ claim }: { claim: Claim }) {
  const [expanded, setExpanded] = useState(false);
  const labelConfig = claimLabels[claim.key] || { label: claim.key, Icon: () => null };
  const Icon = labelConfig.Icon;

  // Real "Why?" copy from static map
  let whyCopy = explanations[claim.ruleId] || explanations["fallback"];
  if (claim.key === "role" && claim.status === "UNCLEAR") {
    if (!whyCopy.includes("not the same as fake")) {
      whyCopy += " Not found in the sources we checked is not the same as fake. Many real internships are not publicly listed.";
    }
  }
  if (claim.key === "company" && claim.status === "UNCLEAR") {
    if (!whyCopy.includes("Limited public evidence does not mean the company is fake")) {
      whyCopy += " Limited public evidence does not mean the company is fake.";
    }
  }

  let sources: any[] = [];
  if (claim.sourcesJson) {
    try {
      sources = JSON.parse(claim.sourcesJson);
    } catch(e) {}
  }

  return (
    <div className="border border-[var(--border)] bg-black/20 rounded mb-2 overflow-hidden">
      <button 
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--border)]/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--hud-primary)] focus:ring-inset"
      >
        <div className="flex items-center gap-4 flex-1">
          <Icon className="w-5 h-5 text-[var(--hud-primary)]" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="text-lg font-heading uppercase text-[var(--gold-accent)]">{labelConfig.label}</h3>
            <p className="text-sm font-mono text-[var(--text)] mt-1">{claim.evidence}</p>
          </div>
          <StatusBadge status={claim.status as any} ruleId={claim.ruleId} />
        </div>
        <div className="ml-4 flex items-center gap-2 text-[var(--hud-primary)]">
          <span className="text-xs uppercase font-mono hidden sm:inline">Why?</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 border-t border-[var(--border)] bg-black/40 text-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-4">
            <div>
              <h4 className="text-xs uppercase font-mono text-[var(--muted)] mb-1">Evidence Explanation</h4>
              <p className="text-[var(--text)] mb-6">{whyCopy}</p>

              <h4 className="text-xs uppercase font-mono text-[var(--muted)] mb-2">Sources Checked</h4>
              {sources.length > 0 ? (
                <div className="space-y-2">
                  {sources.map((s, i) => <SourceCard key={i} source={s} />)}
                </div>
              ) : (
                <p className="text-sm italic text-[var(--muted)]">No external source was consulted for this check.</p>
              )}
            </div>
            <div>
              <h4 className="text-xs uppercase font-mono text-[var(--muted)] mb-4">Verification Trail</h4>
              <EvidenceTimeline claimKey={claim.key} status={claim.status} evidence={claim.evidence} sourceCount={sources.length} />
            </div>
          </div>

          {(claim.nextAction || claim.limitations) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]/50">
              {claim.nextAction && (
                <div>
                  <h4 className="text-xs uppercase font-mono text-[var(--muted)] mb-1">Next Action</h4>
                  <p>{claim.nextAction}</p>
                </div>
              )}
              {claim.limitations && (
                <div>
                  <h4 className="text-xs uppercase font-mono text-[var(--muted)] mb-1">Limitations</h4>
                  <p>{claim.limitations}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
