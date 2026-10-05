import React from "react";
import { HudPanel } from "./HudPanel";
import { AlertTriangle, Info, CheckCircle, ShieldAlert, HelpCircle } from "lucide-react";
import { verdictCopy } from "../content/verdictCopy";

export function OverallVerdict({ verdict, why }: { verdict: string; why: string }) {
  let color = "var(--text)";
  let Icon = Info;
  let label = verdict;

  switch (verdict) {
    case "HIGH_RISK":
      color = "var(--status-risk)";
      Icon = ShieldAlert;
      label = "HIGH RISK";
      break;
    case "CAUTION":
      color = "var(--status-unclear)";
      Icon = AlertTriangle;
      label = "CAUTION";
      break;
    case "UNVERIFIED":
      color = "var(--status-not-verified)";
      Icon = HelpCircle; // Need to import HelpCircle or use Info
      label = "UNVERIFIED";
      break;
    case "NO_RED_FLAGS_FOUND":
      color = "var(--status-verified)";
      Icon = CheckCircle;
      label = "NO RED FLAGS FOUND";
      break;
  }

  const advice = verdictCopy[verdict] || "Decision support, not a guarantee.";

  return (
    <HudPanel className="mb-8 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-start gap-4">
        <Icon className="w-8 h-8 mt-1" style={{ color }} aria-hidden="true" />
        <div className="flex-1">
          <h2 className="text-2xl font-heading mb-2 uppercase" style={{ color }}>{label}</h2>
          {why && <p className="text-lg font-mono mb-4 text-[var(--text)]">{why}</p>}
          <div className="bg-black/30 p-3 border border-[var(--border)] rounded text-sm text-[var(--muted)]">
            <p className="mb-2"><strong>Action:</strong> {advice}</p>
            <p className="text-xs uppercase opacity-75">Decision support, not a guarantee. Independent verification is required.</p>
          </div>
        </div>
      </div>
    </HudPanel>
  );
}
