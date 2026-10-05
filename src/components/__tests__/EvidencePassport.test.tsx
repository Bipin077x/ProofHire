// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EvidencePassport } from "../EvidencePassport";
import { Claim } from "@prisma/client";
import userEvent from "@testing-library/user-event";

describe("EvidencePassport", () => {
  it("renders without dangerouslySetInnerHTML escaping XSS safely", async () => {
    const claims: Claim[] = [
      {
        id: "1",
        scanId: "s1",
        key: "company",
        status: "VERIFIED",
        evidence: "<script>alert('xss')</script>",
        ruleId: "company.known_with_proof",
        nextAction: null,
        limitations: null,
        sourcesJson: null
      }
    ];

    const { container } = render(<EvidencePassport claims={claims} />);
    const html = container.innerHTML;
    // The script tag should be escaped as string
    expect(html).not.toContain("<script>alert('xss')</script>");
    expect(screen.getByText("<script>alert('xss')</script>")).toBeDefined();
  });
});
