import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BASE, FOAM } from "@/lib/palette";

// Vitest runs from the repo root.
const GLOBALS_CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function cssToken(name: string): string | undefined {
  return new RegExp(`--color-rp-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(GLOBALS_CSS)?.[1];
}

describe("palette", () => {
  it("BASE es el base de Rosé Pine, el mismo que el token de globals.css", () => {
    expect(BASE).toBe("#191724");
    expect(BASE).toBe(cssToken("base"));
  });

  it("FOAM es el foam de Rosé Pine, el mismo que el token de globals.css", () => {
    expect(FOAM).toBe("#9ccfd8");
    expect(FOAM).toBe(cssToken("foam"));
  });
});
