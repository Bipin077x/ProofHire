import React from "react";
import { CheckCircle, AlertTriangle, HelpCircle, XCircle } from "lucide-react";
import { Status } from "../lib/verify/types";

const statusConfig: Record<string, { label: string; Icon: typeof CheckCircle; color: string }> = {
  VERIFIED: { label: "Verified", Icon: CheckCircle, color: "var(--status-verified)" },
  UNCLEAR: { label: "Unclear", Icon: HelpCircle, color: "var(--status-unclear)" },
  NOT_VERIFIED: { label: "Not Verified", Icon: HelpCircle, color: "var(--status-not-verified)" },
  RISK: { label: "Risk", Icon: XCircle, color: "var(--status-risk)" },
  HIGH_RISK: { label: "Risk", Icon: XCircle, color: "var(--status-risk)" },
  CAUTION: { label: "Caution", Icon: AlertTriangle, color: "var(--status-unclear)" },
  UNVERIFIED: { label: "Unverified", Icon: HelpCircle, color: "var(--status-not-verified)" },
  NO_RED_FLAGS_FOUND: { label: "No Red Flags", Icon: CheckCircle, color: "var(--status-verified)" }
};

export function StatusBadge({ status, ruleId }: { status: string; ruleId?: string }) {
  const config = statusConfig[status];
  if (!config) return null;
  const { Icon, label, color } = config;

  return (
    <div 
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded border bg-black/40 text-sm font-mono"
      style={{ borderColor: color, color }}
      title={ruleId ? `Rule: ${ruleId}` : undefined}
      role="status"
      aria-label={`${label}${ruleId ? ` (Rule: ${ruleId})` : ""}`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
