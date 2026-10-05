import React from "react";

export function HudPanel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative hud-panel p-6 clip-chamfer ${className}`} style={style}>
      {/* Corner Brackets */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[var(--hud-primary)] opacity-50" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[var(--hud-primary)] opacity-50" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[var(--hud-primary)] opacity-50" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[var(--hud-primary)] opacity-50" />
      
      {children}
    </div>
  );
}
