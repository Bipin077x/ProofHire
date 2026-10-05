// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ClaimRow } from "../ClaimRow";
import { Claim } from "@prisma/client";
import userEvent from "@testing-library/user-event";

describe("ClaimRow", () => {
  it("includes specific text for UNCLEAR role", async () => {
    const claim: Claim = {
      id: "1",
      scanId: "s1",
      key: "role",
      status: "UNCLEAR",
      evidence: "unknown",
      ruleId: "role.unknown",
      nextAction: null,
      limitations: null,
      sourcesJson: null
    };

    render(<ClaimRow claim={claim} />);
    
    // Expand row
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    
    expect(screen.getByText(/Not found in the sources we checked is not the same as fake\. Many real internships are not publicly listed\./)).toBeDefined();
  });
});
