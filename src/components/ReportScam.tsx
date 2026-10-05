"use client";

import React, { useState } from "react";
import { Flag, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { HudPanel } from "./HudPanel";

export function ReportScam({ passportId }: { passportId: string }) {
  const [indicatorType, setIndicatorType] = useState("domain");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passportId, indicatorType, note })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit report");
      }
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  if (status === "success") {
    return (
      <HudPanel className="mb-8 border-[var(--status-verified)]">
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-[var(--status-verified)] mb-4" />
          <h3 className="text-xl font-heading text-[var(--status-verified)] mb-2">Report Submitted</h3>
          <p className="text-sm font-mono text-[var(--text)]">Thank you for helping the community stay informed.</p>
        </div>
      </HudPanel>
    );
  }

  return (
    <HudPanel className="mb-8 border-[var(--status-unclear)]">
      <h3 className="text-lg font-heading uppercase text-[var(--status-unclear)] mb-4 flex items-center gap-2">
        <Flag className="w-5 h-5" /> Report as Scam
      </h3>
      <p className="text-sm font-mono text-[var(--text)] mb-6">
        If you have independently verified that this is a scam, report it to help others. This will flag the contact details in our database.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs uppercase font-mono text-[var(--muted)] mb-1">Primary Indicator Type</label>
          <select 
            value={indicatorType} 
            onChange={(e) => setIndicatorType(e.target.value)}
            className="w-full bg-black/50 border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--hud-primary)]"
          >
            <option value="domain">Domain / Website</option>
            <option value="email">Email Address</option>
            <option value="phone">Phone Number</option>
            <option value="upi">UPI / Payment Details</option>
            <option value="shortener">URL Shortener</option>
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase font-mono text-[var(--muted)] mb-1">Additional Notes (Optional)</label>
          <textarea 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            className="w-full bg-black/50 border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--hud-primary)] min-h-[80px]"
            placeholder="How did you verify it was fake?"
          />
          <div className="text-right text-[10px] text-[var(--muted)] font-mono mt-1">
            {note.length} / 300
          </div>
        </div>

        {status === "error" && (
          <div className="p-3 bg-[var(--status-risk)]/20 border border-[var(--status-risk)] rounded flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--status-risk)] shrink-0 mt-0.5" />
            <span className="text-sm text-[var(--status-risk)]">{errorMsg}</span>
          </div>
        )}

        <button 
          type="submit" 
          disabled={status === "submitting"}
          className="w-full bg-[var(--status-unclear)]/20 hover:bg-[var(--status-unclear)]/30 border border-[var(--status-unclear)] text-[var(--status-unclear)] rounded py-2 font-mono uppercase text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === "submitting" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
          ) : (
            "Submit Report"
          )}
        </button>
      </form>
    </HudPanel>
  );
}
