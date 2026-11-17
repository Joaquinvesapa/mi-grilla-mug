import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InstallGuide } from "@/components/install-guide";

const STEPS = [/Safari/, /Compartir/, /Agregar a pantalla de inicio/];

function getTrigger() {
  return screen.getByRole("button", { name: "Cómo instalarla" });
}

afterEach(cleanup);

describe("InstallGuide", () => {
  it("starts closed: the trigger is collapsed and the steps are hidden", () => {
    render(<InstallGuide />);

    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows the 3 iPhone steps when the trigger is tapped", () => {
    render(<InstallGuide />);

    fireEvent.click(getTrigger());

    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    STEPS.forEach((step, index) => {
      expect(items[index]).toHaveTextContent(step);
      expect(items[index]).toBeVisible();
    });
  });

  it("hides the steps again when the trigger is tapped a second time", () => {
    render(<InstallGuide />);

    fireEvent.click(getTrigger());
    fireEvent.click(getTrigger());

    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("gives touch feedback on the trigger through data-pressed", () => {
    render(<InstallGuide />);

    fireEvent.pointerDown(getTrigger());
    expect(getTrigger()).toHaveAttribute("data-pressed", "true");

    fireEvent.pointerCancel(getTrigger());
    expect(getTrigger()).not.toHaveAttribute("data-pressed");
  });
});
