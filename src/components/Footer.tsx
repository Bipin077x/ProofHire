import React from "react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-black/50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between text-xs font-mono text-[var(--muted)]">
        <p>&copy; {new Date().getFullYear()} ProofHire. All rights reserved.</p>
        <p className="mt-2 md:mt-0 opacity-70 uppercase tracking-widest">Decision support, not a guarantee.</p>
      </div>
    </footer>
  );
}
