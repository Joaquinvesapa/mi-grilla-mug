import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingBar } from "@/components/pending-bar";

afterEach(cleanup);

function renderBar(props: Partial<Parameters<typeof PendingBar>[0]> = {}) {
  const onSave = vi.fn<() => void>();
  const onDiscard = vi.fn<() => void>();
  render(
    <PendingBar
      count={1}
      saving={false}
      error={null}
      onSave={onSave}
      onDiscard={onDiscard}
      {...props}
    />,
  );
  return { onSave, onDiscard, region: screen.getByRole("region", { name: "Cambios sin guardar" }) };
}

describe("PendingBar", () => {
  it("cuenta los cambios en singular y en plural", () => {
    const { region } = renderBar({ count: 1 });
    expect(region).toHaveTextContent("1 cambio sin guardar");
    cleanup();

    const plural = renderBar({ count: 3 });
    expect(plural.region).toHaveTextContent("3 cambios sin guardar");
  });

  it("Guardar y Descartar llaman a sus handlers", () => {
    const { onSave, onDiscard, region } = renderBar();

    fireEvent.click(within(region).getByRole("button", { name: "Guardar" }));
    fireEvent.click(within(region).getByRole("button", { name: "Descartar" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("mientras guarda, los botones quedan deshabilitados y Guardar avisa que está ocupado", () => {
    const { region } = renderBar({ saving: true });

    const save = within(region).getByRole("button", { name: /Guardando/ });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(within(region).getByRole("button", { name: "Descartar" })).toBeDisabled();
  });

  it("muestra el error en un role=alert", () => {
    renderBar({ error: "No pudimos guardar. Probá de nuevo en un rato." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos guardar. Probá de nuevo en un rato.",
    );
  });
});
