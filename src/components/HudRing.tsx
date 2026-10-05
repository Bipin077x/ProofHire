import React from "react";

export function HudRing({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="animate-hud-spin">
        <circle 
          cx="50" 
          cy="50" 
          r="45" 
          fill="none" 
          stroke="var(--hud-primary)" 
          strokeWidth="2"
          strokeDasharray="10 20 50 10 30 40"
          className="opacity-70"
        />
        <circle 
          cx="50" 
          cy="50" 
          r="38" 
          fill="none" 
          stroke="var(--gold-accent)" 
          strokeWidth="1"
          strokeDasharray="5 15 25"
          className="opacity-50"
          style={{ animationDirection: "reverse", animationDuration: "3s" }}
        />
        <circle 
          cx="50" 
          cy="50" 
          r="30" 
          fill="none" 
          stroke="var(--hud-glow)" 
          strokeWidth="4"
          strokeDasharray="60 40"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-heading text-[10px] text-[var(--hud-primary)] uppercase">
        Scan
      </div>
    </div>
  );
}
