"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  
  return (
    <header className="border-b border-[var(--border)] bg-black/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-[var(--hud-primary)] rounded" aria-current={pathname === "/" ? "page" : undefined}>
          <ShieldCheck className="w-6 h-6 text-[var(--hud-primary)] group-hover:text-[var(--gold-accent)] transition-colors" />
          <span className="font-heading text-xl uppercase tracking-wider text-[var(--text)] group-hover:text-[var(--hud-primary)] transition-colors">
            ProofHire
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-mono uppercase text-[var(--muted)]">
          <Link 
            href="/" 
            className={`transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--hud-primary)] rounded px-1 ${pathname === "/" ? "text-[var(--hud-primary)]" : "hover:text-[var(--hud-primary)]"}`}
            aria-current={pathname === "/" ? "page" : undefined}
          >
            Scan
          </Link>
          <Link 
            href="/history" 
            className={`transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--hud-primary)] rounded px-1 ${pathname === "/history" ? "text-[var(--hud-primary)]" : "hover:text-[var(--hud-primary)]"}`}
            aria-current={pathname === "/history" ? "page" : undefined}
          >
            History
          </Link>
          <Link 
            href="/how-it-works" 
            className={`transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--hud-primary)] rounded px-1 ${pathname === "/how-it-works" ? "text-[var(--hud-primary)]" : "hover:text-[var(--hud-primary)]"}`}
            aria-current={pathname === "/how-it-works" ? "page" : undefined}
          >
            How It Works
          </Link>
        </nav>
      </div>
    </header>
  );
}
