import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OfflinePendingNotice } from "@/components/offline-pending-notice";

afterEach(cleanup);

describe("OfflinePendingNotice", () => {
  it("test-notice-content: role status con el título y el cuerpo que sugiere el fondo de pantalla", () => {
    render(<OfflinePendingNotice />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Guardado solo en este celular");
    expect(notice).toHaveTextContent(
      "Tus cambios se suben solos cuando vuelva la conexión. Mientras tanto, descargá la grilla como fondo de pantalla para tenerla a mano.",
    );
    // It only informs: nothing to tap (mobile-native, "Never Ship").
    expect(notice.querySelector("button, a, input")).toBeNull();
    // The icon is decoration: the text says it all.
    expect(notice.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
