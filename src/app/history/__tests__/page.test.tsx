// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import HistoryPage from "../page";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/history"
}));

describe("HistoryPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("handles malformed localStorage gracefully", () => {
    localStorage.setItem("proofhire-history", "not valid json");
    render(<HistoryPage />);
    expect(screen.getByText("No History Found")).toBeDefined();
  });

  it("shows legacy history items", () => {
    localStorage.setItem("proofhire-history", JSON.stringify([{ id: "test-id", date: "2026-10-04T00:00:00.000Z" }]));
    render(<HistoryPage />);
    expect(screen.getByText("Older scan")).toBeDefined();
    expect(screen.getByText("Legacy")).toBeDefined();
  });

  it("shows history items with verdict and title", () => {
    localStorage.setItem("proofhire-history", JSON.stringify([{ 
      id: "pass-123", 
      verdict: "HIGH_RISK", 
      title: "Google Software Engineer",
      createdAt: "2026-10-04T00:00:00.000Z" 
    }]));
    render(<HistoryPage />);
    expect(screen.getByText("Google Software Engineer")).toBeDefined();
    expect(screen.getByText("Risk")).toBeDefined();
  });
});
