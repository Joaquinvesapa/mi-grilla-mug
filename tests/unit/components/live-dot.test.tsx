import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveDot } from "@/components/live-dot";

describe("LiveDot", () => {
  it("es un punto love decorativo cuyo halo solo late si se permite movimiento", () => {
    const { container } = render(<LiveDot className="size-3" />);
    const dot = container.querySelector("[data-live-dot]");

    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass("bg-rp-love", "size-3");
    expect(dot?.firstElementChild).toHaveClass("motion-safe:animate-live-ping");
    expect(dot?.textContent).toBe("");
  });
});
