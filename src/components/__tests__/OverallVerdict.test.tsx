// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { OverallVerdict } from "../OverallVerdict";

afterEach(() => {
  cleanup();
});

describe("OverallVerdict", () => {
  it("renders the verdict correctly", () => {
    const { container } = render(<OverallVerdict verdict="HIGH_RISK" why="Test why" />);
    expect(screen.getByText("HIGH RISK")).toBeDefined();
    expect(screen.getByText("Test why")).toBeDefined();
    
    // Check banned words
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain("100%");
    expect(html).not.toContain("safe");
    expect(html).not.toContain("legit");
    expect(html).not.toContain("genuine");
  });

  it("always includes decision support disclaimer", () => {
    const { container } = render(<OverallVerdict verdict="NO_RED_FLAGS_FOUND" why="" />);
    expect(container.textContent).toContain("Decision support, not a guarantee.");
  });
});
