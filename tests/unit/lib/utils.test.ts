import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names and resolves conflicting Tailwind classes", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-sm text-muted-foreground", { "text-primary": true })).toBe(
      "text-sm text-primary",
    );
    expect(cn(["flex", "items-center"], "gap-2")).toBe("flex items-center gap-2");
  });

  it("ignores invalid or falsy values without throwing", () => {
    expect(() => cn(undefined, false, null, "", "block")).not.toThrow();
    expect(cn(undefined, false, null, "", "block")).toBe("block");
    expect(cn({ hidden: false, flex: true }, undefined)).toBe("flex");
    expect(cn()).toBe("");
  });
});
