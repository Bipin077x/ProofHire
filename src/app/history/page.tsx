"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ArrowRight, Trash2 } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { HudPanel } from "../../components/HudPanel";
import { StatusBadge } from "../../components/StatusBadge";
import { z } from "zod";

const historySchema = z.array(z.object({
  id: z.string().optional(),
  verdict: z.string().optional(),
  title: z.string().optional(),
  createdAt: z.string().optional(),
  date: z.string().optional() // legacy fallback
}));

type HistoryItem = z.infer<typeof historySchema>[number];

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("proofhire-history");
      if (raw) {
        const parsed = JSON.parse(raw);
        const validated = historySchema.parse(parsed);
        setHistory(validated.filter(item => item.id || item.date)); // Keep items that are at least somewhat valid
      }
    } catch (e) {
      setHistory([]);
    }
  }, []);

  const clearHistory = () => {
    localStorage.removeItem("proofhire-history");
    setHistory([]);
  };

  const formatRelativeDate = (isoString?: string) => {
    if (!isoString) return "Unknown date";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Unknown date";
    
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const daysDifference = Math.round((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDifference === 0) {
      const hoursDifference = Math.round((date.getTime() - new Date().getTime()) / (1000 * 60 * 60));
      if (hoursDifference === 0) return "Just now";
      return rtf.format(hoursDifference, "hour");
    }
    return rtf.format(daysDifference, "day");
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-transparent">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-heading uppercase text-[var(--text)] flex items-center gap-2">
            <Clock className="w-8 h-8 text-[var(--hud-primary)]" /> My History
          </h1>
          {history.length > 0 && (
            <button 
              onClick={clearHistory}
              className="text-xs font-mono uppercase flex items-center gap-1 text-[var(--muted)] hover:text-[var(--status-risk)] transition-colors focus:outline-none"
            >
              <Trash2 className="w-4 h-4" /> Clear Local History
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <HudPanel className="text-center py-16">
            <Clock className="w-16 h-16 text-[var(--muted)] opacity-50 mx-auto mb-4" />
            <h3 className="text-xl font-heading uppercase text-[var(--text)] mb-2">No History Found</h3>
            <p className="text-sm font-mono text-[var(--muted)] mb-6">Your analyzed opportunities will appear here.</p>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-mono uppercase text-[var(--hud-primary)] hover:text-[var(--gold-accent)] transition-colors">
              Analyze a post <ArrowRight className="w-4 h-4" />
            </Link>
          </HudPanel>
        ) : (
          <div className="space-y-4">
            {history.map((item, i) => {
              if (!item.id && !item.verdict) return null;
              
              const isLegacy = !item.verdict;
              const title = item.title || (isLegacy ? "Older scan" : "Untitled post");
              const linkTarget = item.id ? `/passport/${item.id}` : "#";

              return (
                <Link 
                  key={`${item.id}-${i}`}
                  href={linkTarget} 
                  className="block p-4 border border-[var(--border)] bg-black/40 rounded hover:bg-black/60 hover:border-[var(--hud-primary)] transition-colors group focus:outline-none focus:ring-2 focus:ring-[var(--hud-primary)]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-mono text-base text-[var(--text)] uppercase">{title}</h3>
                      <p className="font-mono text-xs text-[var(--muted)] mt-1">
                        {formatRelativeDate(item.createdAt || item.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {item.verdict ? (
                        <StatusBadge status={item.verdict as any} />
                      ) : (
                        <span className="text-xs font-mono uppercase text-[var(--muted)] border border-[var(--muted)] px-2 py-1 rounded">Legacy</span>
                      )}
                      <ArrowRight className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--hud-primary)] transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
