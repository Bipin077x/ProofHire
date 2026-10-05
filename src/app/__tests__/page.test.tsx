// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import HomePage from "../page";
import userEvent from "@testing-library/user-event";
import { copy } from "../../content/copy";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mockPush })
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("next/link", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // Mock URL.createObjectURL for jsdom
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn();
  }
});

afterEach(() => {
  cleanup();
});

function isDisabled(el: HTMLElement): boolean {
  return el.hasAttribute("disabled");
}

describe("HomePage", () => {
  it("has no Coming soon text", () => {
    const { container } = render(<HomePage />);
    expect(container.textContent?.toLowerCase()).not.toContain("coming soon");
  });

  it("hero text matches copy.ts", () => {
    render(<HomePage />);
    expect(screen.getByText(copy.hero.headline)).toBeDefined();
    expect(screen.getByText(copy.hero.subtitle)).toBeDefined();
  });

  it("privacy note matches accurate copy", () => {
    render(<HomePage />);
    expect(screen.getByText(copy.privacy.note)).toBeDefined();
  });

  it("screenshot tab is selected by default and submit is disabled", () => {
    render(<HomePage />);
    const submitBtn = screen.getByRole("button", { name: /Analyze Now/i });
    expect(isDisabled(submitBtn)).toBe(true);
    // Screenshot tab has active styling
    const screenshotTab = screen.getByRole("button", { name: /Screenshot/i });
    expect(screenshotTab.className).toContain("text-[var(--hud-primary)]");
  });

  it("switches to text tab and enables submit when text is entered", async () => {
    render(<HomePage />);
    const submitBtn = screen.getByRole("button", { name: /Analyze Now/i });
    
    const textTab = screen.getByRole("button", { name: /Text/i });
    await userEvent.click(textTab);
    expect(isDisabled(submitBtn)).toBe(true);
    
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "abc");
    expect(isDisabled(submitBtn)).toBe(false);
  });

  it("switches to link tab and validates URL format", async () => {
    render(<HomePage />);
    const submitBtn = screen.getByRole("button", { name: /Analyze Now/i });

    const linkTab = screen.getByRole("button", { name: /Link/i });
    await userEvent.click(linkTab);
    expect(isDisabled(submitBtn)).toBe(true);
    
    const input = screen.getByPlaceholderText("https://example.com/job");
    await userEvent.type(input, "invalid url");
    expect(isDisabled(submitBtn)).toBe(true); // must include http
    
    await userEvent.clear(input);
    await userEvent.type(input, "http://valid.com");
    expect(isDisabled(submitBtn)).toBe(false);

    // Link note is displayed
    expect(screen.getByText(copy.tabs.linkNote)).toBeDefined();
  });

  it("stores verdict and id in history upon successful analyze", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn((url: string) => {
      if (url === "/api/analyze") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ passportId: "pass-123" })
        });
      }
      if (url === "/api/passport/pass-123") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ 
            verdict: "HIGH_RISK",
            claims: [{ key: "company", status: "VERIFIED", evidence: "Google" }]
          })
        });
      }
      return Promise.reject("Unknown URL");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    render(<HomePage />);
    const textTab = screen.getByRole("button", { name: /Text/i });
    await userEvent.click(textTab);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "job offer");
    const submitBtn = screen.getByRole("button", { name: /Analyze Now/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      const history = JSON.parse(localStorage.getItem("proofhire-history") || "[]");
      expect(history.length).toBe(1);
      expect(history[0].id).toBe("pass-123");
      expect(history[0].verdict).toBe("HIGH_RISK");
      expect(history[0].title).toBe("Google");
    });
  });
});
