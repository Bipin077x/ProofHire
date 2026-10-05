// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Header } from "../Header";

const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname()
}));

vi.mock("next/link", () => ({
  default: ({ children, href, "aria-current": ariaCurrent }: any) => (
    <a href={href} aria-current={ariaCurrent}>{children}</a>
  )
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Header", () => {
  it("nav shows aria-current for active page", () => {
    mockPathname.mockReturnValue("/history");
    render(<Header />);
    const scanLink = screen.getByText("Scan");
    const historyLink = screen.getByText("History");
    const howLink = screen.getByText("How It Works");

    expect(scanLink.getAttribute("aria-current")).toBeNull();
    expect(historyLink.getAttribute("aria-current")).toBe("page");
    expect(howLink.getAttribute("aria-current")).toBeNull();
  });
});
