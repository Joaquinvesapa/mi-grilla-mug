import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppIcon } from "@/components/app-icon";

afterEach(cleanup);

describe("AppIcon", () => {
  it('dibuja el monograma "MG" en foam sobre el fondo base, a sangre', () => {
    const { container } = render(<AppIcon size={512} />);

    const tile = container.firstElementChild as HTMLElement;
    expect(screen.getByText("MG")).toBeInTheDocument();
    expect(tile.style.width).toBe("100%");
    expect(tile.style.height).toBe("100%");
    expect(tile.style.backgroundColor).toBe("rgb(25, 23, 36)");
    expect(screen.getByText("MG").style.color).toBe("rgb(156, 207, 216)");
  });

  it("no declara un peso de letra que next/og no puede dibujar (su fuente solo trae el regular)", () => {
    render(<AppIcon size={512} />);

    expect(screen.getByText("MG").style.fontWeight).toBe("");
  });

  it("escala la letra con el tamaño del ícono", () => {
    const { rerender } = render(<AppIcon size={180} />);
    const small = Number.parseFloat(screen.getByText("MG").style.fontSize);

    rerender(<AppIcon size={512} />);
    const large = Number.parseFloat(screen.getByText("MG").style.fontSize);

    expect(small).toBeGreaterThan(0);
    expect(large / small).toBeCloseTo(512 / 180, 1);
  });

  it("deja el monograma dentro de la zona segura de un ícono maskable (círculo del 80 %)", () => {
    render(<AppIcon size={512} />);
    const fontSize = Number.parseFloat(screen.getByText("MG").style.fontSize);

    // Two capitals in a sans are at most ~1.7 em wide and ~0.75 em tall: half the box's diagonal
    // has to fit in the safe circle's radius (40 % of the side).
    const halfWidth = (1.7 * fontSize) / 2;
    const halfHeight = (0.75 * fontSize) / 2;
    expect(Math.hypot(halfWidth, halfHeight)).toBeLessThanOrEqual(0.4 * 512);
  });
});
