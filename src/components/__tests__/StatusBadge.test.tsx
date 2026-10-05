// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { StatusBadge } from "../StatusBadge";

afterEach(() => {
  cleanup();
});

describe("StatusBadge", () => {
  it("renders correctly for VERIFIED", () => {
    render(<StatusBadge status="VERIFIED" />);
    expect(screen.getByText("Verified")).toBeDefined();
  });

  it("renders correctly for UNCLEAR", () => {
    render(<StatusBadge status="UNCLEAR" />);
    expect(screen.getByText("Unclear")).toBeDefined();
  });

  it("renders correctly for NOT_VERIFIED", () => {
    render(<StatusBadge status="NOT_VERIFIED" />);
    expect(screen.getByText("Not Verified")).toBeDefined();
  });

  it("renders correctly for RISK", () => {
    render(<StatusBadge status="RISK" />);
    expect(screen.getByText("Risk")).toBeDefined();
  });

  it("includes ruleId in title and aria-label if provided", () => {
    render(<StatusBadge status="VERIFIED" ruleId="test.rule" />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("title")).toBe("Rule: test.rule");
    expect(el.getAttribute("aria-label")).toContain("test.rule");
  });
});
