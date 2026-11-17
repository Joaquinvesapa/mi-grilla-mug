import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfflineRetry } from "@/components/offline-retry";

function getRetry() {
  return screen.getByRole("button", { name: "Reintentar" });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("OfflineRetry", () => {
  it('"Reintentar" recarga la página en la que está', () => {
    const reload = vi.fn();
    render(<OfflineRetry onReload={reload} />);

    fireEvent.click(getRetry());

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("recarga sola cuando vuelve la señal", () => {
    const reload = vi.fn();
    render(<OfflineRetry onReload={reload} />);
    expect(reload).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("online"));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("deja de escuchar la señal al desmontarse", () => {
    const reload = vi.fn();
    const { unmount } = render(<OfflineRetry onReload={reload} />);
    // Guard: it was listening while mounted.
    window.dispatchEvent(new Event("online"));
    expect(reload).toHaveBeenCalledTimes(1);

    unmount();
    window.dispatchEvent(new Event("online"));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("es un botón de 44 px o más (tamaño lg de Button)", () => {
    render(<OfflineRetry onReload={vi.fn()} />);

    expect(getRetry()).toHaveAttribute("data-size", "lg");
  });

  // The default, `window.location.reload()`, is not observable in jsdom (its `location` cannot be
  // spied on and its "not implemented" notice does not go through console): the E2E of
  // tests/e2e/pwa.spec.ts covers it in a real browser.
});
