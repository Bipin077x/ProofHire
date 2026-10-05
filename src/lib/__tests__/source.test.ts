import { describe, it, expect } from "vitest";
import { Source } from "../verify/types";

describe("Source type", () => {
  it("allows kind to be assigned correctly", () => {
    const s1: Source = { label: "Official", url: "http://example.com", kind: "official" };
    const s2: Source = { label: "Search", url: "http://example.com", kind: "search_result" };
    const s3: Source = { label: "Post", url: "http://example.com", kind: "user_post" };
    const s4: Source = { label: "Other", url: "http://example.com", kind: "other" };
    const s5: Source = { label: "No kind", url: "http://example.com" };

    expect(s1.kind).toBe("official");
    expect(s2.kind).toBe("search_result");
    expect(s3.kind).toBe("user_post");
    expect(s4.kind).toBe("other");
    expect(s5.kind).toBeUndefined();
  });
});
