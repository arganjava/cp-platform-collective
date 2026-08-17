import { describe, expect, it } from "vitest";
import { cn, formatDate, generateId, getInitials } from "./utils";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateId", () => {
  it("returns a valid RFC 4122 v4 UUID", () => {
    expect(generateId()).toMatch(UUID_V4);
  });

  it("returns unique ids across calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("cn", () => {
  it("joins class names and drops falsy values", () => {
    expect(cn("a", "b", false && "c", undefined, null, "d")).toBe("a b d");
  });

  it("tailwind-merge dedupes conflicting utilities", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("getInitials", () => {
  it("takes the first letters of the first two words", () => {
    expect(getInitials("Vincent Lim")).toBe("VL");
    expect(getInitials("Lim Lee Lee")).toBe("LL");
  });

  it("handles single names", () => {
    expect(getInitials("Cher")).toBe("C");
  });
});

describe("formatDate", () => {
  it("formats a date string as en-SG", () => {
    expect(formatDate("2026-06-01")).toBe("1 Jun 2026");
  });

  it("accepts Date objects", () => {
    expect(formatDate(new Date("2026-07-15T10:00:00Z"))).toBe("15 Jul 2026");
  });
});
