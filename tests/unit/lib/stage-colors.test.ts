import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BASE, GOLD, IRIS, LOVE, PINE, ROSE, FOAM, TEXT, SUBTLE } from "@/lib/palette";
import { dayTint, stageStyle, stageTint } from "@/lib/stage-colors";

// Vitest runs from the repo root.
const GLOBALS_CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function cssToken(name: string): string | undefined {
  return new RegExp(`--color-rp-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(GLOBALS_CSS)?.[1];
}

describe("stage-colors", () => {
  it("las constantes nuevas de la paleta coinciden con los tokens de globals.css", () => {
    expect(GOLD).toBe(cssToken("gold"));
    expect(ROSE).toBe(cssToken("rose"));
    expect(PINE).toBe(cssToken("pine"));
    expect(IRIS).toBe(cssToken("iris"));
    expect(LOVE).toBe(cssToken("love"));
  });

  it("cada escenario tiene su color de Rosé Pine y el color del texto que va encima", () => {
    expect(stageTint("flow")).toEqual({ color: FOAM, onColor: BASE });
    expect(stageTint("samsung")).toEqual({ color: GOLD, onColor: BASE });
    expect(stageTint("alternative")).toEqual({ color: ROSE, onColor: BASE });
    expect(stageTint("perrys")).toEqual({ color: PINE, onColor: TEXT });
    expect(stageTint("kidzapalooza")).toEqual({ color: IRIS, onColor: BASE });
  });

  it("un escenario desconocido cae en un neutro, nunca en love", () => {
    expect(stageTint("otro")).toEqual({ color: SUBTLE, onColor: BASE });
  });

  it("cada día tiene su color: viernes gold, sábado rose, domingo pine", () => {
    expect(dayTint("fri")).toEqual({ color: GOLD, onColor: BASE });
    expect(dayTint("sat")).toEqual({ color: ROSE, onColor: BASE });
    expect(dayTint("sun")).toEqual({ color: PINE, onColor: TEXT });
    expect(dayTint("otro")).toEqual({ color: SUBTLE, onColor: BASE });
  });

  it("love queda reservado para En vivo: ningún escenario ni día lo usa", () => {
    for (const id of ["flow", "samsung", "alternative", "perrys", "kidzapalooza"]) {
      expect(stageTint(id).color).not.toBe(LOVE);
    }
    for (const id of ["fri", "sat", "sun"]) expect(dayTint(id).color).not.toBe(LOVE);
  });

  it("stageStyle expone el color como variables CSS --stage y --on-stage", () => {
    expect(stageStyle("perrys")).toEqual({ "--stage": PINE, "--on-stage": TEXT });
  });
});
