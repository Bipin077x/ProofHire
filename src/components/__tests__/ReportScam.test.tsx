// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReportScam } from "../ReportScam";
import userEvent from "@testing-library/user-event";

describe("ReportScam", () => {
  it("enforces 300 char limit on note and submits indicatorType", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    render(<ReportScam passportId="p1" />);
    
    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "email");
    expect((select as HTMLSelectElement).value).toBe("email");

    const textarea = screen.getByRole("textbox");
    expect(textarea.getAttribute("maxLength")).toBe("300");

    await userEvent.type(textarea, "test note");
    
    const button = screen.getByRole("button", { name: /Submit Report/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/report", expect.objectContaining({
        body: JSON.stringify({ passportId: "p1", indicatorType: "email", note: "test note" })
      }));
    });
  });
});
