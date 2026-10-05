"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { HudPanel } from "../components/HudPanel";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-transparent">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center">
        <HudPanel className="text-center py-16 w-full max-w-lg">
          <AlertTriangle className="w-16 h-16 text-[var(--status-risk)] mx-auto mb-4" />
          <h3 className="text-xl font-heading uppercase text-[var(--text)] mb-2">404 - Not Found</h3>
          <p className="text-sm font-mono text-[var(--muted)] mb-6">The page or passport you&apos;re looking for does not exist.</p>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-mono uppercase text-[var(--hud-primary)] hover:text-[var(--gold-accent)] transition-colors">
            Return to Home <ArrowRight className="w-4 h-4" />
          </Link>
        </HudPanel>
      </main>
      <Footer />
    </div>
  );
}
