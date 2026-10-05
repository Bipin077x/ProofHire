import React from "react";
import { Globe, Search, User, FileText } from "lucide-react";
import { Source } from "../lib/verify/types";

export function SourceCard({ source }: { source: Source }) {
  let Icon = FileText;
  let tierLabel = "Source";
  
  if (source.kind === "official") {
    Icon = Globe;
    tierLabel = "Official company domain";
  } else if (source.kind === "search_result") {
    Icon = Search;
    tierLabel = "Search result from an official domain";
  } else if (source.kind === "user_post") {
    Icon = User;
    tierLabel = "Social media post (user-provided)";
  } else if (source.kind === "other") {
    Icon = FileText;
    tierLabel = "Third-party page";
  }

  return (
    <a 
      href={source.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 mt-2 bg-black/40 border border-[var(--border)] rounded hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--hud-primary)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
    >
      <Icon className="w-5 h-5 text-[var(--hud-primary)] shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-xs uppercase text-[var(--muted)] mb-0.5">{tierLabel}</div>
        <div className="text-sm font-mono truncate text-[var(--hud-primary)]">{source.label || source.url}</div>
      </div>
    </a>
  );
}
