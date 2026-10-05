"use client";

import React, { useState } from "react";
import { Code, Image as ImageIcon, FileText } from "lucide-react";
import { HudPanel } from "./HudPanel";

export function AnalyzerPanel({ text, imageUrl }: { text?: string; imageUrl?: string }) {
  const [activeTab, setActiveTab] = useState<"text" | "image">("text");

  return (
    <HudPanel className="mb-8">
      <h3 className="text-sm font-heading uppercase text-[var(--gold-accent)] mb-4 flex items-center gap-2">
        <Code className="w-4 h-4" /> Analyzed Input
      </h3>
      
      {imageUrl && (
        <div className="flex gap-2 mb-4">
          <button 
            onClick={() => setActiveTab("text")}
            className={`px-3 py-1.5 text-xs font-mono uppercase border ${activeTab === 'text' ? 'bg-[var(--hud-glow)] border-[var(--hud-primary)] text-[var(--hud-primary)]' : 'border-[var(--border)] text-[var(--muted)] hover:bg-black/40'} transition-colors rounded`}
          >
            <FileText className="w-3 h-3 inline mr-1" /> Text
          </button>
          <button 
            onClick={() => setActiveTab("image")}
            className={`px-3 py-1.5 text-xs font-mono uppercase border ${activeTab === 'image' ? 'bg-[var(--hud-glow)] border-[var(--hud-primary)] text-[var(--hud-primary)]' : 'border-[var(--border)] text-[var(--muted)] hover:bg-black/40'} transition-colors rounded`}
          >
            <ImageIcon className="w-3 h-3 inline mr-1" /> Screenshot
          </button>
        </div>
      )}

      <div className="bg-black/50 border border-[var(--border)] rounded p-4 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[var(--hud-primary)] to-transparent opacity-30" />
        {activeTab === "text" ? (
          <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--text)] overflow-y-auto max-h-64 scrollbar-thin">
            {text || "No text provided."}
          </pre>
        ) : (
          <div className="flex justify-center max-h-64 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="User uploaded screenshot" className="object-contain max-h-64" />
          </div>
        )}
      </div>
    </HudPanel>
  );
}
