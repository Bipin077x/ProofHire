"use client";

import React from "react";
import { Shield } from "lucide-react";
import { copy } from "../content/copy";

export function PrivacyNote() {
  return (
    <div className="flex items-start gap-3 p-4 bg-black/30 border border-[var(--border)] rounded text-sm text-[var(--muted)] font-mono">
      <Shield className="w-5 h-5 text-[var(--hud-primary)] shrink-0" aria-hidden="true" />
      <div>
        <p className="mb-1 text-[var(--text)] uppercase text-xs tracking-wider">Privacy &amp; Security Notice</p>
        <p>{copy.privacy.note}</p>
      </div>
    </div>
  );
}
