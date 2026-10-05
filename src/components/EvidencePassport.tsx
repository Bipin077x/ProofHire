import React from "react";
import { Claim } from "@prisma/client";
import { ClaimRow } from "./ClaimRow";

export function EvidencePassport({ claims }: { claims: Claim[] }) {
  // Sort claims to ensure consistent order: company, role, contact, link, payment, pressure, reports
  const order = ["company", "role", "contact", "link", "payment", "pressure", "reports"];
  const sorted = [...claims].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return (
    <div className="mt-8">
      <h2 className="text-xl font-heading uppercase text-[var(--gold-accent)] mb-4 flex items-center gap-2">
        Evidence Passport
        <div className="flex-1 h-px bg-gradient-to-r from-[var(--hud-primary)] to-transparent opacity-50" />
      </h2>
      <div className="space-y-1">
        {sorted.map(c => <ClaimRow key={c.id} claim={c} />)}
      </div>
    </div>
  );
}
